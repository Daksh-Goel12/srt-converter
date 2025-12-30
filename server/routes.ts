import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import FormData from "form-data";
import axios from "axios";
import { WebSocketServer, WebSocket } from "ws";
import { io as SocketIOClient } from "socket.io-client";
import { createReadStream, unlinkSync } from "fs";

const PYTHON_HOST = process.env.PYTHON_SERVICE_HOST;
const PYTHON_PORT = process.env.PYTHON_SERVICE_PORT || "5000";
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL ||
  (PYTHON_HOST ? `http://${PYTHON_HOST}:${PYTHON_PORT}` : "http://localhost:5001");

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // Store WebSocket connections by job ID
  const wsConnections = new Map<string, Set<WebSocket>>();

  // Connect to Python service WebSocket
  const pythonSocket = SocketIOClient(PYTHON_SERVICE_URL, {
    transports: ["websocket"],
    reconnection: true,
  });

  pythonSocket.on("connect", () => {
    console.log("Connected to Python transcription service");
  });

  pythonSocket.on("disconnect", () => {
    console.log("Disconnected from Python transcription service");
  });

  // Forward progress updates from Python to connected clients
  pythonSocket.on("progress", (data: any) => {
    const jobId = data.job_id;
    const clients = wsConnections.get(jobId);

    if (clients) {
      const message = JSON.stringify({
        type: "progress",
        data,
      });

      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  });

  pythonSocket.on("completed", (data: any) => {
    const jobId = data.job_id;
    const clients = wsConnections.get(jobId);

    if (clients) {
      const message = JSON.stringify({
        type: "completed",
        data,
      });

      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  });

  pythonSocket.on("error", (data: any) => {
    const jobId = data.job_id;
    const clients = wsConnections.get(jobId);

    if (clients) {
      const message = JSON.stringify({
        type: "error",
        data,
      });

      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  });

  // Handle WebSocket connections
  wss.on("connection", (ws: WebSocket) => {
    console.log("Client connected to WebSocket");

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message.toString());

        // Subscribe to job updates
        if (data.type === "subscribe" && data.jobId) {
          if (!wsConnections.has(data.jobId)) {
            wsConnections.set(data.jobId, new Set());
          }
          wsConnections.get(data.jobId)!.add(ws);

          ws.send(JSON.stringify({
            type: "subscribed",
            jobId: data.jobId,
          }));
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      // Remove this connection from all job subscriptions
      wsConnections.forEach((clients, jobId) => {
        clients.delete(ws);
        if (clients.size === 0) {
          wsConnections.delete(jobId);
        }
      });
    });
  });

  // Health check for Python service
  app.get("/api/health", async (_req, res) => {
    try {
      const response = await axios.get(`${PYTHON_SERVICE_URL}/health`, {
        timeout: 5000,
      });
      res.json({
        status: "healthy",
        pythonService: response.data,
      });
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        error: "Python service unavailable",
      });
    }
  });

  // Upload and transcribe audio file
  app.post("/api/transcribe", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { modelSize = "base", language, task = "transcribe", use_claude_correction, source_language } = req.body;

      // Create form data to send to Python service
      const formData = new FormData();
      formData.append("file", createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });
      formData.append("model_size", modelSize);
      if (language) formData.append("language", language);
      formData.append("task", task);
      if (use_claude_correction) formData.append("use_claude_correction", use_claude_correction);
      if (source_language) formData.append("source_language", source_language);

      // Forward to Python service
      const response = await axios.post(
        `${PYTHON_SERVICE_URL}/transcribe`,
        formData,
        {
          headers: formData.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      // Clean up uploaded file
      unlinkSync(req.file.path);

      res.status(202).json(response.data);
    } catch (error: any) {
      console.error("Transcription error:", error);

      // Clean up uploaded file on error
      if (req.file) {
        try {
          unlinkSync(req.file.path);
        } catch (e) {
          console.error("Error cleaning up file:", e);
        }
      }

      res.status(500).json({
        error: "Transcription failed",
        message: error.response?.data?.error || error.message,
      });
    }
  });

  // Get transcription status
  app.get("/api/status/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const response = await axios.get(`${PYTHON_SERVICE_URL}/status/${jobId}`);
      res.json(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.status(500).json({
        error: "Failed to get status",
        message: error.message,
      });
    }
  });

  // Download SRT file
  app.get("/api/download/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      console.log(`[Proxy] Requesting download for job: ${jobId}`);
      console.log(`[Proxy] Target URL: ${PYTHON_SERVICE_URL}/download/${jobId}`);

      const response = await axios.get(
        `${PYTHON_SERVICE_URL}/download/${jobId}`,
        {
          responseType: "stream",
        }
      );

      console.log(`[Proxy] Python service responded with status: ${response.status}`);
      console.log(`[Proxy] Content-Type: ${response.headers["content-type"]}`);

      // Forward headers
      res.setHeader(
        "Content-Disposition",
        response.headers["content-disposition"] || "attachment; filename=transcript.srt"
      );
      res.setHeader("Content-Type", "text/plain; charset=utf-8");

      // Pipe the response
      response.data.pipe(res);
    } catch (error: any) {
      console.error("[Proxy] Download error:", error.message);
      if (error.response) {
        console.error("[Proxy] Python service error status:", error.response.status);
        console.error("[Proxy] Python service error data:", error.response.data);
      }

      if (error.response?.status === 404) {
        return res.status(404).json({ error: "SRT file not found" });
      }
      res.status(500).json({
        error: "Failed to download SRT",
        message: error.message,
      });
    }
  });

  // Clean up job
  app.delete("/api/cleanup/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      await axios.delete(`${PYTHON_SERVICE_URL}/cleanup/${jobId}`);
      res.json({ message: "Job cleaned up successfully" });
    } catch (error: any) {
      res.status(500).json({
        error: "Failed to clean up job",
        message: error.message,
      });
    }
  });

  return httpServer;
}

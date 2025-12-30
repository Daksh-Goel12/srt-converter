# Quick Start Guide

## Services Running

✅ **Frontend**: http://localhost:5000  
✅ **Node.js Backend**: http://localhost:9000  
✅ **Python Service**: http://localhost:5001  

## Current Terminal Sessions

1. **Terminal 1**: `npm run dev:client` - Frontend (port 5000)
2. **Terminal 2**: `python app.py` - Python transcription service (port 5001)
3. **Terminal 3**: `$env:PORT='9000'; tsx server/index.ts` - Node.js backend (port 9000)

## Testing the Application

1. Open your browser to: **http://localhost:5000**
2. You should see the SonicScript interface
3. Drag and drop an audio file (MP3, WAV, M4A, etc.)
4. Watch the real-time progress as it transcribes
5. Download the generated SRT file when complete

## API Endpoints

- Health Check: http://localhost:9000/api/health
- Transcribe: POST http://localhost:9000/api/transcribe
- Status: GET http://localhost:9000/api/status/:jobId
- Download: GET http://localhost:9000/api/download/:jobId

## Troubleshooting

### If Frontend Can't Connect to Backend
- Verify all three services are running
- Check that Vite proxy is configured to port 9000
- Restart the frontend: `npm run dev:client`

### If Transcription Fails
- Check Python service logs in Terminal 2
- Verify FFmpeg is installed: `ffmpeg -version`
- Check file format is supported

### If WebSocket Disconnects
- Restart Node.js backend (Terminal 3)
- Check browser console for errors

## Model Download

The first transcription will download the Whisper model (~150MB for base model). This is normal and only happens once.

## Performance Tips

- **CPU**: Expect 2-3x real-time speed
- **GPU**: Can achieve 10x+ real-time speed (requires CUDA setup)
- Use smaller models (tiny/base) for faster processing
- Use larger models (medium/large) for better accuracy

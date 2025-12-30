import { useState, useEffect, useCallback, useRef } from 'react';

interface TranscriptionProgress {
    stage: string;
    progress: number;
    message: string;
    speed?: string;
    elapsed?: number;
}

interface TranscriptionMetadata {
    language: string;
    language_probability: number;
    duration: number;
    processing_time: number;
    speed_ratio: number;
    segment_count: number;
}

interface TranscriptionSegment {
    id: number;
    start: number;
    end: number;
    text: string;
}

interface UseTranscriptionReturn {
    transcribe: (file: File, options?: TranscriptionOptions) => Promise<void>;
    progress: TranscriptionProgress | null;
    status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
    metadata: TranscriptionMetadata | null;
    segments: TranscriptionSegment[];
    error: string | null;
    jobId: string | null;
    downloadSRT: () => void;
}

interface TranscriptionOptions {
    modelSize?: 'tiny' | 'base' | 'small' | 'medium' | 'large-v2' | 'large-v3';
    language?: string;
    task?: 'transcribe' | 'translate';
    useClaudeCorrection?: boolean;
    sourceLanguage?: string;
}

export function useTranscription(): UseTranscriptionReturn {
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>('idle');
    const [progress, setProgress] = useState<TranscriptionProgress | null>(null);
    const [metadata, setMetadata] = useState<TranscriptionMetadata | null>(null);
    const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    // WebSocket connection
    const connectWebSocket = useCallback((jobId: string) => {
        // Use environment variable for API URL if available (production), otherwise fallback to current host (local proxy)
        const apiUrl = import.meta.env.VITE_API_URL || '';
        let wsUrl: string;

        if (apiUrl) {
            // Production: Use provided API URL but switch protocol to wss/ws
            const url = new URL(apiUrl);
            const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${protocol}//${url.host}/ws`;
        } else {
            // Local Development: Use current host
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${protocol}//${window.location.host}/ws`;
        }

        console.log('Connecting to WebSocket at:', wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket connected');
            // Subscribe to job updates
            ws.send(JSON.stringify({
                type: 'subscribe',
                jobId: jobId,
            }));
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                switch (message.type) {
                    case 'subscribed':
                        console.log('Subscribed to job:', message.jobId);
                        break;

                    case 'progress':
                        setProgress(message.data);
                        if (message.data.stage === 'transcribing' || message.data.stage === 'generating_srt') {
                            setStatus(prev => prev === 'completed' ? prev : 'processing');
                        }
                        // Fallback: If progress reaches 100%, fetch the final status
                        if (message.data.progress >= 100 || message.data.stage === 'completed') {
                            setTimeout(() => fetchTranscript(jobId), 1000);
                        }
                        break;

                    case 'completed':
                        setStatus('completed');
                        if (message.data.metadata) {
                            setMetadata(message.data.metadata);
                        }
                        if (message.data.segments) {
                            setSegments(message.data.segments);
                        }
                        // Also fetch to ensure we have everything
                        fetchTranscript(jobId);
                        break;

                    case 'error':
                        setStatus('error');
                        setError(message.data.error || 'Transcription failed');
                        break;
                }
            } catch (err) {
                console.error('Error parsing WebSocket message:', err);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setStatus('error');
            setError('WebSocket connection error');
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
        };

        return ws;
    }, []);

    // Base API URL
    const API_BASE_URL = import.meta.env.VITE_API_URL || '';

    // Fetch transcript segments
    const fetchTranscript = async (jobId: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/status/${jobId}`);
            const data = await response.json();

            if (data.status === 'completed') {
                if (data.metadata) {
                    setMetadata(data.metadata);
                }
                if (data.segments) {
                    setSegments(data.segments);
                }
            }
        } catch (err) {
            console.error('Error fetching transcript:', err);
        }
    };

    // Transcribe function
    const transcribe = useCallback(async (
        file: File,
        options: TranscriptionOptions = {}
    ) => {
        try {
            setStatus('uploading');
            setError(null);
            setProgress({
                stage: 'uploading',
                progress: 0,
                message: 'Uploading file...',
            });

            const formData = new FormData();
            formData.append('file', file);
            formData.append('model_size', options.modelSize || 'base');
            if (options.language) formData.append('language', options.language);
            formData.append('task', options.task || 'transcribe');
            if (options.useClaudeCorrection) formData.append('use_claude_correction', 'true');
            if (options.sourceLanguage) formData.append('source_language', options.sourceLanguage);



            const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Transcription failed');
            }

            const data = await response.json();
            setJobId(data.job_id);

            // Check if this is a cached result (duplicate file)
            if (data.cached && data.status === 'completed') {
                console.log('Cache hit! Loading cached transcription...');
                setStatus('completed');
                if (data.metadata) {
                    setMetadata(data.metadata);
                }
                if (data.segments) {
                    setSegments(data.segments);
                }
                // No need to connect WebSocket for cached results
                return;
            }

            // Connect to WebSocket for progress updates (new transcription)
            connectWebSocket(data.job_id);

            setStatus('processing');
            setProgress({
                stage: 'processing',
                progress: 10,
                message: 'Processing started...',
            });
        } catch (err: any) {
            setStatus('error');
            setError(err.message || 'Failed to start transcription');
            console.error('Transcription error:', err);
        }
    }, [connectWebSocket]);

    // Download SRT
    const downloadSRT = useCallback(() => {
        if (!jobId) {
            console.error('No job ID available');
            return;
        }

        const link = document.createElement('a');
        link.href = `${API_BASE_URL}/api/download/${jobId}`;
        link.download = 'transcript.srt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [jobId]);

    // Cleanup WebSocket on unmount
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    return {
        transcribe,
        progress,
        status,
        metadata,
        segments,
        error,
        jobId,
        downloadSRT,
    };
}

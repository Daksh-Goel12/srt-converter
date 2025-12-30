import { motion } from 'framer-motion';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface TranscriptionProgress {
  stage: string;
  progress: number;
  message: string;
  speed?: string;
  elapsed?: number;
}

interface ProcessingStatusProps {
  progress: TranscriptionProgress | null;
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
}

export function ProcessingStatus({ progress, status }: ProcessingStatusProps) {
  const progressValue = progress?.progress || 0;
  const message = progress?.message || 'Processing...';
  const speed = progress?.speed;
  const stage = progress?.stage || 'initializing';

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-card border border-border/50 rounded-xl shadow-lg">
      <div className="flex flex-col items-center text-center space-y-4">
        {status === 'completed' ? (
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        <div>
          <h3 className="text-lg font-medium">
            {status === 'uploading' && 'Uploading Audio...'}
            {status === 'processing' && (
              <>
                {stage === 'loading_model' && 'Loading AI Model...'}
                {stage === 'model_loaded' && 'Model Ready'}
                {stage === 'transcribing' && 'Generating Transcript...'}
                {stage === 'generating_srt' && 'Creating SRT File...'}
                {stage === 'completed' && 'Transcription Complete!'}
              </>
            )}
            {status === 'completed' && 'Transcription Complete!'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {message}
          </p>
          {speed && (
            <p className="text-xs text-primary mt-1 font-mono">
              Processing at {speed} real-time speed
            </p>
          )}
        </div>

        <div className="w-full space-y-2">
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progressValue}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>{progressValue}%</span>
            <span>{status === 'completed' ? 'Complete' : 'Processing...'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

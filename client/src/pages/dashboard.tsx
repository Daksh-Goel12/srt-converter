import { useState, useCallback, useRef, memo } from 'react';
import { FileUpload } from '@/components/file-upload';
import { AudioPlayer, AudioPlayerRef } from '@/components/audio-player';
import { TranscriptEditor } from '@/components/transcript-editor';
import { ProcessingStatus } from '@/components/processing-status';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Download, ChevronRight, Zap, RefreshCw, AudioLines, Languages } from 'lucide-react';
import { useTranscription } from '@/hooks/useTranscription';

// Memoized action buttons to prevent re-renders
const ActionButtons = memo(({
  fileName,
  onReset,
  onDownload
}: {
  fileName: string;
  onReset: () => void;
  onDownload: () => void;
}) => {
  // Debug: Log every render
  console.log('🔵 ActionButtons rendered');

  return (
    <>
      <h2 className="text-2xl font-semibold flex items-center gap-2 font-display">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
        {fileName}
      </h2>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onReset} className="hover:bg-muted/50">
          <RefreshCw className="w-4 h-4 mr-2" />
          New Project
        </Button>
        <Button size="sm" onClick={onDownload} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(56,189,248,0.3)]">
          <Download className="w-4 h-4" />
          Export SRT
        </Button>
      </div>
    </>
  );
});

ActionButtons.displayName = 'ActionButtons';

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [, forceUpdate] = useState({});
  const [modelSize, setModelSize] = useState<'tiny' | 'base' | 'small' | 'medium'>('base');
  const [language, setLanguage] = useState<string>('hi'); // Default to Hindi
  const [translateToEnglish, setTranslateToEnglish] = useState(true); // Default to translate
  const [useClaudeCorrection, setUseClaudeCorrection] = useState(true); // Default to enabled

  // Use ref for currentTime to avoid re-renders
  const currentTimeRef = useRef(0);

  // Ref to control audio player imperatively
  const audioPlayerRef = useRef<AudioPlayerRef>(null);

  const {
    transcribe,
    progress,
    status,
    metadata,
    error,
    downloadSRT,
    segments,
  } = useTranscription();

  // Debug: Count Dashboard renders
  const dashboardRenderCount = useRef(0);
  dashboardRenderCount.current++;
  console.log(`🔴 Dashboard render #${dashboardRenderCount.current}`, { progress, status });

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);

    // Start transcription with translation
    await transcribe(selectedFile, {
      modelSize,
      language: language || undefined,
      task: translateToEnglish ? 'translate' : 'transcribe',
      useClaudeCorrection,
      sourceLanguage: 'Hindi', // Explicitly setting Hindi for best context
    });
  };

  // Ref to track last time update to throttle state changes
  const lastTimeUpdateRef = useRef(0);
  const timeUpdateCallbacksRef = useRef<Set<(time: number) => void>>(new Set());

  // Stabilize callbacks to prevent re-renders - use ref instead of state
  const handleTimeUpdate = useCallback((time: number) => {
    currentTimeRef.current = time;

    // Throttle callbacks to reduce re-renders (update every 200ms instead of 100ms)
    const now = Date.now();
    if (now - lastTimeUpdateRef.current >= 200) {
      // Notify subscribers (TranscriptEditor)
      timeUpdateCallbacksRef.current.forEach(callback => callback(time));
      lastTimeUpdateRef.current = now;
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    // Imperatively seek the audio player
    // This avoids the circular dependency of state updates triggering seeks
    if (audioPlayerRef.current) {
      audioPlayerRef.current.seek(time);
    }
    // Update ref immediately for responsiveness
    currentTimeRef.current = time;
    // Notify subscribers immediately on seek
    timeUpdateCallbacksRef.current.forEach(callback => callback(time));
  }, []);

  const handleDurationChange = useCallback((duration: number) => {
    // Optional: store duration in state if needed
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    currentTimeRef.current = 0;
    window.location.reload(); // Simple reset for now
  }, []);

  // Subscription mechanism for TranscriptEditor
  const subscribeToTimeUpdates = useCallback((callback: (time: number) => void) => {
    timeUpdateCallbacksRef.current.add(callback);
    return () => {
      timeUpdateCallbacksRef.current.delete(callback);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Navbar */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={reset}>
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <AudioLines className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-xl tracking-tight font-display">SonicScript</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hidden sm:flex">
              Documentation
            </Button>
            <Button size="sm" className="gap-2 rounded-full px-6 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 hover:border-primary/50 border shadow-[0_0_15px_rgba(56,189,248,0.15)]">
              <Zap className="w-4 h-4 fill-current" />
              Pro Mode
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col">
        {(!status || status === 'idle') && (
          <div className="max-w-4xl mx-auto w-full space-y-12 flex-1 flex flex-col justify-center animate-in fade-in duration-500">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20 mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                v2.0 Model Live
              </div>

              <h1 className="text-4xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/60 pb-2 font-display">
                Subtitle Conversion <br />
                <span className="text-primary glow-text">with</span>
              </h1>

              <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 delay-100">
                {translateToEnglish && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium border border-green-500/20">
                    <Languages className="w-4 h-4" />
                    Hindi → English Translation Enabled
                  </div>
                )}

                <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-card/50 border border-primary/20 shadow-sm backdrop-blur-sm transition-all hover:bg-card/80">
                  <div className="flex items-center gap-2">
                    <Zap className={cn("w-4 h-4", useClaudeCorrection ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
                    <Label htmlFor="ai-mode" className="font-medium cursor-pointer">
                      Using <span className="text-primary font-bold">Claude AI</span> for 99% Accuracy
                    </Label>
                  </div>
                  <Switch
                    id="ai-mode"
                    checked={useClaudeCorrection}
                    onCheckedChange={setUseClaudeCorrection}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </div>

              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Generate 99% accurate subtitles for your videos in seconds.
                Powered by our next-gen acoustic engine.
              </p>
            </div>

            <FileUpload onFileSelect={handleFileSelect} />

            <div className="grid md:grid-cols-3 gap-6 pt-8">
              {[
                { title: 'Lightning Fast', desc: 'Process 1 hour of audio in less than 6 minutes.' },
                { title: '99% Accuracy', desc: 'Enterprise-grade speech recognition models.' },
                { title: 'Auto-Sync', desc: 'Timestamps are automatically aligned to the millisecond.' },
              ].map((feature, i) => (
                <div key={i} className="p-6 rounded-xl border border-border/50 bg-card/30 hover:bg-card/50 transition-colors backdrop-blur-sm">
                  <h3 className="font-semibold text-lg mb-2 font-display">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(status === 'uploading' || status === 'processing') && (
          <div className="flex items-center justify-center flex-1 min-h-[60vh] animate-in fade-in zoom-in-95 duration-300">
            <ProcessingStatus progress={progress} status={status} />
          </div>
        )}

        {status === 'completed' || file ? (
          <div className={`grid lg:grid-cols-[1fr_400px] gap-6 h-[calc(100vh-140px)] animate-in fade-in slide-in-from-bottom-4 duration-500 ${status === 'completed' ? '' : 'hidden'}`}>
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between shrink-0">
                <ActionButtons
                  fileName={file?.name || 'Untitled Audio'}
                  onReset={reset}
                  onDownload={downloadSRT}
                />
              </div>

              <div className="flex-1 bg-card/30 rounded-xl overflow-hidden flex flex-col relative border border-border/50 shadow-2xl">
                <div className="flex-1 flex flex-col justify-center p-8 bg-gradient-to-br from-card/50 to-background/50 backdrop-blur-md">
                  <AudioPlayer
                    ref={audioPlayerRef}
                    file={file}
                    onTimeUpdate={handleTimeUpdate}
                    onDurationChange={handleDurationChange}
                  />
                </div>
              </div>
            </div>

            <div className="h-full bg-card/20 rounded-xl border border-border/50 overflow-hidden shadow-xl backdrop-blur-md">
              <TranscriptEditor
                getCurrentTime={() => currentTimeRef.current}
                subscribeToTimeUpdates={subscribeToTimeUpdates}
                onSeek={handleSeek}
                segments={segments}
              />
            </div>
          </div>
        ) : null}

        {/* 
          Keep other sections conditional for now as they are lightweight.
          But Editor block above is CRITICAL to stay stable if status flips.
          Actually, wait. If 'status' FLIPS to 'processing', the ternary 'status === completed ? ... : null' WILL unmount it!
          
          I must use:
          <div className={cn("...", status !== 'completed' && "hidden")}>
           ...
          </div>
        */}
      </main>
    </div>
  );
}

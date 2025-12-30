import { useState, useEffect, useRef, forwardRef, useImperativeHandle, memo } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AudioPlayerProps {
  file: File | null;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
}

export interface AudioPlayerRef {
  seek: (time: number) => void;
}

const AudioPlayerComponent = forwardRef<AudioPlayerRef, AudioPlayerProps>(
  ({ file, onTimeUpdate, onDurationChange }, ref) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Expose seek method to parent
    useImperativeHandle(ref, () => ({
      seek: (time: number) => {
        if (audioRef.current) {
          audioRef.current.currentTime = time;
          setCurrentTime(time);
        }
      },
    }));

    useEffect(() => {
      if (!file || !audioRef.current) return;

      const audio = audioRef.current;
      const url = URL.createObjectURL(file);
      audio.src = url;

      const handleLoadedMetadata = () => {
        const dur = audio.duration || 0;
        setDuration(dur);
        onDurationChange(dur);
      };

      const handleTimeUpdate = () => {
        const time = audio.currentTime;
        setCurrentTime(time);
        onTimeUpdate(time);
      };

      const handleEnded = () => {
        setIsPlaying(false);
      };

      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
        audio.pause();
        URL.revokeObjectURL(url);
      };
    }, [file, onTimeUpdate, onDurationChange]);

    const togglePlayPause = () => {
      if (!audioRef.current) return;

      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const time = percentage * duration;

      audioRef.current.currentTime = time;
      setCurrentTime(time);
    };

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div className="w-full bg-card/30 rounded-xl p-6 border border-border/50">
        <audio ref={audioRef} />

        {/* Simple progress bar */}
        <div
          className="w-full h-32 bg-muted/30 rounded-lg mb-4 cursor-pointer relative overflow-hidden"
          onClick={handleSeek}
        >
          <div
            className="absolute inset-y-0 left-0 bg-primary/20"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary"
            style={{ left: `${progress}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              size="icon"
              onClick={togglePlayPause}
              className="h-12 w-12 rounded-full"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>

            <div className="text-sm font-mono text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {file?.name || 'No file loaded'}
          </div>
        </div>
      </div>
    );
  }
);

AudioPlayerComponent.displayName = 'AudioPlayer';

export const AudioPlayer = memo(AudioPlayerComponent);

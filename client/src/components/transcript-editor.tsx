import { useEffect, useRef, useMemo, memo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface TranscriptEditorProps {
  getCurrentTime: () => number;
  subscribeToTimeUpdates: (callback: (time: number) => void) => () => void;
  onSeek: (time: number) => void;
  segments?: TranscriptSegment[];
}

const SegmentItem = memo(({ segment, isActive, onClick }: {
  segment: TranscriptSegment;
  isActive: boolean;
  onClick: (time: number) => void;
}) => {
  const activeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active segment
  useEffect(() => {
    if (isActive && activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [isActive]);

  return (
    <div
      ref={isActive ? activeRef : null}
      onClick={() => onClick(segment.start)}
      className={cn(
        "p-3 rounded-lg cursor-pointer border group", // Removed transition-all
        isActive
          ? "bg-primary/10 border-primary/50 shadow-sm"
          : "bg-transparent border-transparent hover:bg-muted/30 hover:border-border/30"
      )}
    >
      <div className="flex items-center gap-3 mb-1">
        <span className={cn(
          "text-xs font-mono px-1.5 py-0.5 rounded",
          isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        )}>
          {formatTime(segment.start)}
        </span>
      </div>
      <p className={cn(
        "text-sm leading-relaxed outline-none focus:ring-1 focus:ring-primary rounded p-1 -m-1",
        isActive ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground/80"
      )} contentEditable suppressContentEditableWarning>
        {segment.text}
      </p>
    </div>
  );
});

SegmentItem.displayName = 'SegmentItem';

const TranscriptEditorComponent = ({ getCurrentTime, subscribeToTimeUpdates, onSeek, segments = [] }: TranscriptEditorProps) => {
  // Use local state for currentTime that updates via subscription
  const [currentTime, setCurrentTime] = useState(getCurrentTime());

  // Subscribe to time updates
  useEffect(() => {
    const unsubscribe = subscribeToTimeUpdates((time) => {
      setCurrentTime(time);
    });
    return unsubscribe;
  }, [subscribeToTimeUpdates]);

  // Memoize active segment calculation with throttling to prevent excessive re-renders
  const activeId = useMemo(() => {
    // Round to nearest 100ms to reduce re-computation frequency
    const roundedTime = Math.round(currentTime * 10) / 10;
    return segments.find(seg => roundedTime >= seg.start && roundedTime <= seg.end)?.id;
  }, [segments, Math.round(currentTime * 10) / 10]);

  // Show message if no segments available
  if (segments.length === 0) {
    return (
      <div className="flex flex-col h-full bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border/50 bg-muted/20 flex justify-between items-center">
          <h3 className="font-semibold text-foreground">Transcript</h3>
          <span className="text-xs text-muted-foreground font-mono">EN-US</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-muted-foreground text-center">
            Transcription will appear here once processing is complete.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-border/50 bg-muted/20 flex justify-between items-center">
        <h3 className="font-semibold text-foreground">Transcript</h3>
        <span className="text-xs text-muted-foreground font-mono">EN-US</span>
      </div>

      <ScrollArea className="flex-1 p-4 h-[400px]">
        <div className="space-y-4 pr-4">
          {segments.map((segment) => (
            <SegmentItem
              key={segment.id}
              segment={segment}
              isActive={activeId === segment.id}
              onClick={onSeek}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

// Export memoized version to prevent unnecessary re-renders
export const TranscriptEditor = memo(TranscriptEditorComponent);

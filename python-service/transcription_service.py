"""
Transcription service using Faster Whisper for audio-to-SRT conversion.
"""
import os
import time
from typing import Callable, Optional, Dict, List
from faster_whisper import WhisperModel
from datetime import timedelta


class TranscriptionService:
    """Service for transcribing audio files to SRT format using Faster Whisper."""
    
    def __init__(self, model_size: str = "base", device: str = "cpu", compute_type: str = "int8"):
        """
        Initialize the transcription service.
        
        Args:
            model_size: Size of the Whisper model (tiny, base, small, medium, large-v2, large-v3)
            device: Device to run on ("cpu" or "cuda")
            compute_type: Computation type ("int8", "float16", "float32")
        """
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.model: Optional[WhisperModel] = None
        
    def load_model(self, progress_callback: Optional[Callable] = None):
        """Load the Whisper model."""
        if progress_callback:
            progress_callback({
                "stage": "loading_model",
                "progress": 0,
                "message": f"Loading {self.model_size} model..."
            })
        
        self.model = WhisperModel(
            self.model_size,
            device=self.device,
            compute_type=self.compute_type
        )
        
        if progress_callback:
            progress_callback({
                "stage": "model_loaded",
                "progress": 10,
                "message": "Model loaded successfully"
            })
    
    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        task: str = "transcribe",
        progress_callback: Optional[Callable] = None
    ) -> Dict:
        """
        Transcribe an audio file.
        
        Args:
            audio_path: Path to the audio file
            language: Language code (e.g., "en", "es", "fr") or None for auto-detection
            task: "transcribe" or "translate" (translate to English)
            progress_callback: Callback function for progress updates
            
        Returns:
            Dictionary containing segments and metadata
        """
        if not self.model:
            self.load_model(progress_callback)
        
        start_time = time.time()
        
        if progress_callback:
            progress_callback({
                "stage": "transcribing",
                "progress": 15,
                "message": "Starting transcription..."
            })
        
        # Get audio duration for progress estimation
        try:
            import subprocess
            result = subprocess.run(
                ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                 '-of', 'default=noprint_wrappers=1:nokey=1', audio_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            audio_duration = float(result.stdout.strip()) if result.stdout.strip() else 0
        except:
            audio_duration = 0
        
        # Transcribe
        segments, info = self.model.transcribe(
            audio_path,
            language=language,
            task=task,
            beam_size=1, # Greedy search (saves HUGE memory)
            vad_filter=True,  # Voice activity detection
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        
        # Convert segments to list and track progress
        segment_list = []
        total_segments_estimate = 100  # Initial estimate
        
        for i, segment in enumerate(segments):
            segment_dict = {
                "id": segment.id,
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
                "words": [
                    {
                        "start": word.start,
                        "end": word.end,
                        "word": word.word,
                        "probability": word.probability
                    }
                    for word in (segment.words or [])
                ] if hasattr(segment, 'words') and segment.words else []
            }
            segment_list.append(segment_dict)
            
            # Update progress
            if progress_callback:  # Update on every segment for better feedback
                # Calculate progress (15% to 90%)
                progress = min(15 + int((i / max(total_segments_estimate, 1)) * 75), 90)
                elapsed = time.time() - start_time
                speed = segment.end / elapsed if elapsed > 0 else 0
                
                progress_callback({
                    "stage": "transcribing",
                    "progress": progress,
                    "message": f"Transcribing... ({i+1} segments)",
                    "speed": f"{speed:.1f}x",
                    "elapsed": elapsed
                })
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        result = {
            "segments": segment_list,
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
            "processing_time": processing_time,
            "speed_ratio": info.duration / processing_time if processing_time > 0 else 0
        }
        
        if progress_callback:
            progress_callback({
                "stage": "generating_srt",
                "progress": 95,
                "message": "Generating SRT file...",
                "speed": f"{result['speed_ratio']:.1f}x"
            })
        
        return result
    
    @staticmethod
    def format_timestamp(seconds: float) -> str:
        """
        Format seconds to SRT timestamp format (HH:MM:SS,mmm).
        
        Args:
            seconds: Time in seconds
            
        Returns:
            Formatted timestamp string
        """
        td = timedelta(seconds=seconds)
        hours = int(td.total_seconds() // 3600)
        minutes = int((td.total_seconds() % 3600) // 60)
        secs = int(td.total_seconds() % 60)
        millis = int((seconds % 1) * 1000)
        
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
    
    @staticmethod
    def generate_srt(segments: List[Dict]) -> str:
        """
        Generate SRT content from segments.
        
        Args:
            segments: List of segment dictionaries
            
        Returns:
            SRT formatted string
        """
        srt_content = []
        
        for i, segment in enumerate(segments, start=1):
            start_time = TranscriptionService.format_timestamp(segment["start"])
            end_time = TranscriptionService.format_timestamp(segment["end"])
            text = segment["text"]
            
            srt_content.append(f"{i}")
            srt_content.append(f"{start_time} --> {end_time}")
            srt_content.append(text)
            srt_content.append("")  # Empty line between segments
        
        return "\n".join(srt_content)
    
    def transcribe_to_srt(
        self,
        audio_path: str,
        output_path: Optional[str] = None,
        language: Optional[str] = None,
        task: str = "transcribe",
        progress_callback: Optional[Callable] = None,
        use_claude_correction: bool = False,
        source_language: str = "Hindi"
    ) -> tuple[str, Dict]:
        """
        Transcribe audio file and generate SRT file.
        
        Args:
            audio_path: Path to the audio file
            output_path: Path for output SRT file (optional)
            language: Language code or None for auto-detection
            task: "transcribe" or "translate"
            progress_callback: Callback for progress updates
            use_claude_correction: Whether to use Claude API for post-processing corrections
            source_language: Source language name for Claude correction (e.g., "Hindi", "Tamil")
            
        Returns:
            Tuple of (srt_content, metadata)
        """
        # Transcribe
        result = self.transcribe(audio_path, language, task, progress_callback)
        
        # Apply Claude correction if enabled and task is translate
        claude_corrected = False
        if use_claude_correction and task == "translate":
            try:
                from claude_correction_service import ClaudeCorrectionService, is_claude_available
                
                if is_claude_available():
                    if progress_callback:
                        progress_callback({
                            "stage": "claude_correction",
                            "progress": 90,
                            "message": "Preparing AI-powered correction..."
                        })
                    
                    claude_service = ClaudeCorrectionService()
                    result["segments"] = claude_service.correct_translation(
                        result["segments"],
                        source_language=source_language,
                        target_language="English",
                        progress_callback=progress_callback
                    )
                    claude_corrected = True
                else:
                    print("Claude API key not configured, skipping correction")
            except Exception as e:
                print(f"Claude correction failed: {e}")
                print("Continuing with original translation...")
        
        # Generate SRT
        srt_content = self.generate_srt(result["segments"])
        
        # Save to file if output path provided
        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(srt_content)
        
        if progress_callback:
            progress_callback({
                "stage": "completed",
                "progress": 100,
                "message": "Transcription completed!" + (" (AI-corrected)" if claude_corrected else ""),
                "speed": f"{result['speed_ratio']:.1f}x"
            })
        
        metadata = {
            "language": result["language"],
            "language_probability": result["language_probability"],
            "duration": result["duration"],
            "processing_time": result["processing_time"],
            "speed_ratio": result["speed_ratio"],
            "segment_count": len(result["segments"]),
            "claude_corrected": claude_corrected
        }
        
        return srt_content, metadata, result["segments"]


if __name__ == "__main__":
    # Test the service
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python transcription_service.py <audio_file>")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    
    def print_progress(data):
        print(f"[{data['stage']}] {data['progress']}% - {data['message']}")
    
    service = TranscriptionService(model_size="base")
    srt_content, metadata = service.transcribe_to_srt(
        audio_file,
        progress_callback=print_progress
    )
    
    print("\n=== Metadata ===")
    print(f"Language: {metadata['language']} ({metadata['language_probability']:.2%})")
    print(f"Duration: {metadata['duration']:.2f}s")
    print(f"Processing Time: {metadata['processing_time']:.2f}s")
    print(f"Speed: {metadata['speed_ratio']:.1f}x real-time")
    print(f"Segments: {metadata['segment_count']}")
    
    print("\n=== SRT Preview (first 500 chars) ===")
    print(srt_content[:500])

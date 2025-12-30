"""
Claude API service for post-processing and correcting translations.
Improves accuracy by providing context-aware corrections for transcribed segments.
"""
import os
import json
from typing import List, Dict, Optional, Callable
from anthropic import Anthropic


class ClaudeCorrectionService:
    """Service for correcting translations using Claude API."""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "claude-3-5-sonnet-20241022",
        max_tokens: int = 4096
    ):
        """
        Initialize the Claude correction service.
        
        Args:
            api_key: Claude API key (reads from CLAUDE_API_KEY env var if not provided)
            model: Claude model to use
            max_tokens: Maximum tokens for Claude response
        """
        self.api_key = api_key or os.environ.get("CLAUDE_API_KEY")
        if not self.api_key:
            raise ValueError("Claude API key not provided. Set CLAUDE_API_KEY environment variable.")
        
        self.model = model
        self.max_tokens = max_tokens
        self.client = Anthropic(api_key=self.api_key)
    
    def correct_translation(
        self,
        segments: List[Dict],
        source_language: str = "Hindi",
        target_language: str = "English",
        progress_callback: Optional[Callable] = None
    ) -> List[Dict]:
        """
        Correct translated segments using Claude API.
        
        Args:
            segments: List of segment dictionaries with 'id', 'start', 'end', 'text'
            source_language: Source language name (e.g., "Hindi", "Tamil")
            target_language: Target language name (default: "English")
            progress_callback: Optional callback for progress updates
            
        Returns:
            List of corrected segments with same structure
        """
        if not segments:
            return segments
        
        if progress_callback:
            progress_callback({
                "stage": "claude_correction",
                "progress": 91,
                "message": "Starting AI-powered correction..."
            })
        
        # Process in batches for efficiency (10 segments at a time)
        batch_size = 10
        corrected_segments = []
        total_batches = (len(segments) + batch_size - 1) // batch_size
        
        for batch_idx in range(0, len(segments), batch_size):
            batch = segments[batch_idx:batch_idx + batch_size]
            batch_num = (batch_idx // batch_size) + 1
            
            if progress_callback:
                progress = 91 + int((batch_num / total_batches) * 8)  # 91-99%
                progress_callback({
                    "stage": "claude_correction",
                    "progress": progress,
                    "message": f"AI correction in progress... (batch {batch_num}/{total_batches})"
                })
            
            # Get context segments (2 before and 2 after)
            context_before = segments[max(0, batch_idx - 2):batch_idx]
            context_after = segments[batch_idx + batch_size:batch_idx + batch_size + 2]
            
            # Correct this batch
            corrected_batch = self._correct_batch(
                batch,
                context_before,
                context_after,
                source_language,
                target_language
            )
            
            corrected_segments.extend(corrected_batch)
        
        if progress_callback:
            progress_callback({
                "stage": "claude_correction",
                "progress": 99,
                "message": "AI correction completed!"
            })
        
        return corrected_segments
    
    def _correct_batch(
        self,
        batch: List[Dict],
        context_before: List[Dict],
        context_after: List[Dict],
        source_language: str,
        target_language: str
    ) -> List[Dict]:
        """
        Correct a batch of segments with context.
        
        Args:
            batch: Segments to correct
            context_before: Previous segments for context
            context_after: Following segments for context
            source_language: Source language name
            target_language: Target language name
            
        Returns:
            Corrected batch of segments
        """
        prompt = self._build_correction_prompt(
            batch,
            context_before,
            context_after,
            source_language,
            target_language
        )
        
        try:
            # Call Claude API
            message = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=0.3,  # Lower temperature for more consistent corrections
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            # Parse response
            response_text = message.content[0].text
            corrected_batch = self._parse_claude_response(response_text, batch)
            
            return corrected_batch
            
        except Exception as e:
            print(f"Claude API error: {e}")
            print("Falling back to original translations...")
            return batch  # Fallback to original on error
    
    def _build_correction_prompt(
        self,
        batch: List[Dict],
        context_before: List[Dict],
        context_after: List[Dict],
        source_language: str,
        target_language: str
    ) -> str:
        """
        Build a context-aware prompt for Claude.
        
        Args:
            batch: Segments to correct
            context_before: Previous segments for context
            context_after: Following segments for context
            source_language: Source language name
            target_language: Target language name
            
        Returns:
            Formatted prompt string
        """
        prompt_parts = [
            f"You are an expert translator specializing in {source_language} to {target_language} translation for video subtitles.",
            f"Your Goal: Produce a faithful, accurate English translation that captures EXACTLY what the speaker is saying in {source_language}.",
            "",
            "Context: This is a transcription from an Indian video involving Hinglish (Hindi+English). The initial text often mishears Indian names and terms phonetically.",
            "",
            "Your Task: Review and correct the segments below. You MUST:",
            "1. CAPTURE THE EXACT MEANING: Do not summarize. Translate every detail.",
            "2. RESTORE INDIAN NAMES/TERMS: Fix phonetic misspellings of common Indian names, cities, and cultural terms (e.g., 'Kurbari' -> 'Karobari' or 'Warikoo', 'Pune', 'Niti Aayog'). Use the context to guess the correct entity.",
            "3. FIX GRAMMAR: Make the English natural but KEEP the original speaker's tone.",
            "4. HANDLE HINGLISH: If the speaker uses Hindi words, translate them accurately to English unless they are specific cultural terms.",
            "5. PRESERVE TIMING/SEGMENTATION: Keep the exact same number of segments.",
            "6. Return ONLY valid JSON with the corrected segments.",
            "7. NO HALLUCINATED PREFIXES: Do NOT add segment numbers.",
            "",
            "CRITICAL: Look out for phonetic errors in Indian names. If you see 'Nithi Ayyog', correct it to 'NITI Aayog'.",
            "CRITICAL: Do not start lines with numbers unless explicitly spoken.",
            ""
        ]
        
        # Add context before
        if context_before:
            prompt_parts.append("Previous context:")
            for seg in context_before:
                prompt_parts.append(f"  [{seg['id']}]: \"{seg['text']}\"")
            prompt_parts.append("")
        
        # Add segments to correct
        prompt_parts.append("SEGMENTS TO CORRECT:")
        for seg in batch:
            prompt_parts.append(f"  [{seg['id']}]: \"{seg['text']}\"")
        prompt_parts.append("")
        
        # Add context after
        if context_after:
            prompt_parts.append("Following context:")
            for seg in context_after:
                prompt_parts.append(f"  [{seg['id']}]: \"{seg['text']}\"")
            prompt_parts.append("")
        
        # Add output format instructions
        prompt_parts.extend([
            "Return corrections as a JSON array:",
            "[",
            "  {",
            "    \"id\": <same_id_as_input>,",
            "    \"text\": \"<corrected_exact_translation>\"",
            "  }",
            "]",
            "",
            "Return ONLY the JSON. No preamble."
        ])
        
        return "\n".join(prompt_parts)
    
    def _parse_claude_response(
        self,
        response_text: str,
        original_batch: List[Dict]
    ) -> List[Dict]:
        """
        Parse Claude's response and merge with original segment data.
        
        Args:
            response_text: Claude's response text
            original_batch: Original segments with timing info
            
        Returns:
            Corrected segments with preserved timing
        """
        try:
            # Extract JSON from response (handle cases where Claude adds explanation)
            response_text = response_text.strip()
            
            # Find JSON array in response
            start_idx = response_text.find('[')
            end_idx = response_text.rfind(']') + 1
            
            if start_idx == -1 or end_idx == 0:
                print("No JSON array found in Claude response")
                return original_batch
            
            json_text = response_text[start_idx:end_idx]
            corrections = json.loads(json_text)
            
            # Create a mapping of corrections by ID
            correction_map = {c['id']: c['text'] for c in corrections}
            
            # Merge corrections with original segments (preserve timing)
            corrected_batch = []
            for seg in original_batch:
                corrected_seg = seg.copy()
                if seg['id'] in correction_map:
                    # Clean the text: Remove leading numbers/bullets that Claude might hallucinate
                    import re
                    clean_text = correction_map[seg['id']].strip()
                    clean_text = re.sub(r'^\s*\d+[\.\)]\s*', '', clean_text)  # Remove "9.", "1)", etc.
                    clean_text = re.sub(r'^\s*[\-\*]\s*', '', clean_text)      # Remove "- ", "* "
                    corrected_seg['text'] = clean_text
                corrected_batch.append(corrected_seg)
            
            return corrected_batch
            
        except json.JSONDecodeError as e:
            print(f"Failed to parse Claude response as JSON: {e}")
            print(f"Response: {response_text[:200]}...")
            return original_batch
        except Exception as e:
            print(f"Error parsing Claude response: {e}")
            return original_batch


def is_claude_available() -> bool:
    """
    Check if Claude API is available (API key is set).
    
    Returns:
        True if Claude API key is configured, False otherwise
    """
    return bool(os.environ.get("CLAUDE_API_KEY"))

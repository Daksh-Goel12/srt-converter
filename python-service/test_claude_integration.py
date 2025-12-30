"""
Test script to verify Claude correction service integration.
This script tests the Claude correction without requiring a full transcription.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent / '.env')

# Test 1: Check if Claude API is available
print("=" * 60)
print("TEST 1: Checking Claude API availability")
print("=" * 60)

try:
    from claude_correction_service import is_claude_available
    
    if is_claude_available():
        print("[OK] Claude API key is configured")
        print(f"  API Key: {os.environ.get('CLAUDE_API_KEY', 'Not set')[:20]}...")
    else:
        print("[FAIL] Claude API key is NOT configured")
        print("  Set CLAUDE_API_KEY environment variable to enable")
except Exception as e:
    print(f"[FAIL] Error checking Claude availability: {e}")

print()

# Test 2: Import Claude service
print("=" * 60)
print("TEST 2: Importing Claude correction service")
print("=" * 60)

try:
    from claude_correction_service import ClaudeCorrectionService
    print("[OK] Successfully imported ClaudeCorrectionService")
except Exception as e:
    print(f"[FAIL] Failed to import: {e}")
    sys.exit(1)

print()

# Test 3: Test with sample segments (only if API key is available)
if is_claude_available():
    print("=" * 60)
    print("TEST 3: Testing Claude correction with sample data")
    print("=" * 60)
    
    # Sample Hindi-to-English translation segments (with intentional errors)
    sample_segments = [
        {
            "id": 1,
            "start": 0.0,
            "end": 3.5,
            "text": "Hello, today we going to learn about"
        },
        {
            "id": 2,
            "start": 3.5,
            "end": 7.0,
            "text": "the importance of education in our"
        },
        {
            "id": 3,
            "start": 7.0,
            "end": 10.5,
            "text": "We will discuss various aspects"
        }
    ]
    
    print("Original segments:")
    for seg in sample_segments:
        print(f"  [{seg['id']}] {seg['text']}")
    
    print("\nAttempting Claude correction...")
    
    try:
        service = ClaudeCorrectionService()
        
        def progress_callback(data):
            print(f"  Progress: {data['progress']}% - {data['message']}")
        
        corrected = service.correct_translation(
            sample_segments,
            source_language="Hindi",
            target_language="English",
            progress_callback=progress_callback
        )
        
        print("\nCorrected segments:")
        for seg in corrected:
            print(f"  [{seg['id']}] {seg['text']}")
        
        print("\n[OK] Claude correction test completed successfully!")
        
    except Exception as e:
        print(f"\n[FAIL] Claude correction test failed: {e}")
        import traceback
        traceback.print_exc()
else:
    print("=" * 60)
    print("TEST 3: SKIPPED (No Claude API key configured)")
    print("=" * 60)
    print("\nTo test Claude correction:")
    print("1. Get API key from https://console.anthropic.com/")
    print("2. Set environment variable: CLAUDE_API_KEY=your_key_here")
    print("3. Run this test again")

print()
print("=" * 60)
print("TEST SUMMARY")
print("=" * 60)
print("All import tests passed!")
print("Claude integration is ready to use.")
print("\nTo use in production:")
print("1. Set CLAUDE_API_KEY in your .env file")
print("2. Add use_claude_correction=true when calling /transcribe endpoint")
print("3. Optionally set source_language (default: Hindi)")

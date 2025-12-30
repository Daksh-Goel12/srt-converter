"""
Simple Claude API test - just verify it works
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env')

print("Testing Claude API Integration...")
print("-" * 50)

# Check API key
api_key = os.environ.get('CLAUDE_API_KEY')
if not api_key or api_key == 'your_claude_api_key_here':
    print("[FAIL] Claude API key not configured properly")
    exit(1)

print(f"[OK] API Key found: {api_key[:15]}...")

# Try to import and initialize
try:
    from claude_correction_service import ClaudeCorrectionService
    print("[OK] Imported ClaudeCorrectionService")
    
    service = ClaudeCorrectionService()
    print("[OK] Initialized Claude service")
    
    # Test with minimal data
    test_segments = [
        {"id": 1, "start": 0.0, "end": 3.0, "text": "Hello today we going learn"}
    ]
    
    print("\nTesting correction...")
    print(f"Original: {test_segments[0]['text']}")
    
    corrected = service.correct_translation(
        test_segments,
        source_language="Hindi",
        target_language="English"
    )
    
    print(f"Corrected: {corrected[0]['text']}")
    print("\n[SUCCESS] Claude integration is working!")
    
except Exception as e:
    print(f"\n[FAIL] Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

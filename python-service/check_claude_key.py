"""
Quick verification script to check if Claude API key is properly configured.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env')

print("=" * 60)
print("Claude API Configuration Check")
print("=" * 60)

api_key = os.environ.get('CLAUDE_API_KEY')

if not api_key:
    print("❌ CLAUDE_API_KEY not found in environment")
    print("\nPlease check:")
    print("1. .env file exists in the project root")
    print("2. CLAUDE_API_KEY is set in .env file")
    print("3. The value is not 'your_claude_api_key_here'")
elif api_key == 'your_claude_api_key_here':
    print("❌ CLAUDE_API_KEY is still set to placeholder value")
    print("\nPlease update .env file with your actual API key:")
    print("CLAUDE_API_KEY=sk-ant-api03-xxxxxxxxxxxxx")
elif not api_key.startswith('sk-ant-'):
    print(f"⚠️  CLAUDE_API_KEY format looks unusual: {api_key[:20]}...")
    print("\nClaude API keys typically start with 'sk-ant-'")
    print("Please verify your API key is correct")
else:
    print(f"✅ CLAUDE_API_KEY is configured")
    print(f"   Key prefix: {api_key[:20]}...")
    print(f"   Key length: {len(api_key)} characters")
    
    # Try to import and initialize Claude service
    try:
        from claude_correction_service import ClaudeCorrectionService
        service = ClaudeCorrectionService()
        print("\n✅ Claude service initialized successfully!")
        print("\nYou're ready to use Claude correction!")
        print("\nNext steps:")
        print("1. Run: python test_claude_integration.py")
        print("2. Or start the server and test with real audio")
    except Exception as e:
        print(f"\n❌ Error initializing Claude service: {e}")
        print("\nPlease check your API key is valid")

print("=" * 60)

# SRT Converter - Audio to SRT Transcription

A modern web application that converts audio files to SRT subtitle format using Faster Whisper AI model. Features real-time progress tracking and achieves processing speeds of up to 10x real-time on GPU.

## Features

- 🎯 **High Accuracy**: 90%+ transcription accuracy using Faster Whisper
- 🤖 **AI-Powered Correction**: Optional Claude API integration for 98%+ accuracy on translations (Hindi/Indian languages)
- ⚡ **Fast Processing**: Target speed of 1/10th audio duration (10x real-time on GPU)
- 🌍 **Multi-language Support**: Auto-detect or manually select from 99+ languages
- 📊 **Real-time Progress**: WebSocket-based live progress updates
- 🎨 **Modern UI**: Beautiful, responsive interface built with React and TailwindCSS
- 📝 **SRT Export**: Download properly formatted SRT subtitle files
- 🔄 **Multiple Model Sizes**: Choose from tiny, base, small, medium, or large models

## Tech Stack

**Frontend:**
- React 19 with TypeScript
- TailwindCSS for styling
- Framer Motion for animations
- WebSocket for real-time updates

**Backend:**
- Node.js/Express for API server
- Python/Flask for transcription service
- Faster Whisper for AI transcription
- WebSocket for progress streaming

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.8+ and pip
- **FFmpeg** (required by Faster Whisper)

### Installing FFmpeg

**Windows:**
```bash
# Using Chocolatey
choco install ffmpeg

# Or download from https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update
sudo apt install ffmpeg
```

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd SRT-Converter
```

### 2. Install Node.js dependencies
```bash
npm install
```

### 3. Install Python dependencies
```bash
cd python-service
pip install -r requirements.txt
cd ..
```

**Note:** First-time model download will happen automatically when you run your first transcription. The base model is ~150MB.

## Running the Application

You need to run both the Node.js server and the Python service.

### Option 1: Run both services separately

**Terminal 1 - Node.js Server:**
```bash
npm run dev
```

**Terminal 2 - Python Service:**
```bash
npm run dev:python
```

**Terminal 3 - Frontend (if needed):**
```bash
npm run dev:client
```

### Option 2: Use a process manager (recommended)

Install `concurrently`:
```bash
npm install -g concurrently
```

Then add this script to `package.json`:
```json
"dev:all": "concurrently \"npm run dev\" \"npm run dev:python\""
```

Run:
```bash
npm run dev:all
```

## Usage

1. Open your browser to `http://localhost:5000`
2. Drag and drop an audio file (MP3, WAV, M4A, etc.) or click to browse
3. (Optional) Select model size and language
4. Wait for transcription to complete
5. Review the transcript in the editor
6. Click "Export SRT" to download your subtitle file

## Model Sizes

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| tiny | ~75MB | Fastest | Good | Quick drafts, testing |
| base | ~150MB | Fast | Better | General use (default) |
| small | ~500MB | Medium | Great | High quality |
| medium | ~1.5GB | Slow | Excellent | Professional use |
| large-v3 | ~3GB | Slowest | Best | Maximum accuracy |

## Performance

- **CPU**: Base model typically achieves 2-3x real-time speed
- **GPU**: Base model can achieve 10x+ real-time speed
- **Example**: A 10-minute audio file processes in ~1 minute on CPU, ~30 seconds on GPU

To enable GPU support:
1. Install CUDA toolkit
2. Update `python-service/app.py` line 223: change `device="cpu"` to `device="cuda"`

## API Endpoints

### POST `/api/transcribe`
Upload and transcribe an audio file.

**Form Data:**
- `file`: Audio file (required)
- `model_size`: Model size (default: "base")
- `language`: Language code (optional, auto-detect if not provided)
- `task`: "transcribe" or "translate" (default: "transcribe")

**Response:**
```json
{
  "job_id": "uuid-string",
  "status": "queued",
  "message": "Transcription started"
}
```

### GET `/api/status/:jobId`
Get transcription status.

**Response:**
```json
{
  "job_id": "uuid-string",
  "status": "completed",
  "progress": 100,
  "metadata": {
    "language": "en",
    "duration": 120.5,
    "processing_time": 15.2,
    "speed_ratio": 7.9
  }
}
```

### GET `/api/download/:jobId`
Download the generated SRT file.

### WebSocket `/ws`
Real-time progress updates.

**Subscribe:**
```json
{
  "type": "subscribe",
  "jobId": "uuid-string"
}
```

**Progress Event:**
```json
{
  "type": "progress",
  "data": {
    "stage": "transcribing",
    "progress": 45,
    "message": "Transcribing... (23 segments processed)",
    "speed": "8.2x"
  }
}
```

## Troubleshooting

### Python service won't start
- Ensure Python 3.8+ is installed: `python --version`
- Check if all dependencies are installed: `pip list`
- Verify FFmpeg is installed: `ffmpeg -version`

### Transcription fails
- Check file format is supported (MP3, WAV, M4A, AAC, MP4, MOV, WEBM)
- Ensure file size is under 500MB
- Check Python service logs for errors

### WebSocket connection fails
- Ensure both Node.js and Python services are running
- Check firewall settings
- Verify port 5001 is not in use by another application

### Slow processing
- Try a smaller model size (tiny or base)
- Enable GPU support if available
- Reduce audio file quality/bitrate before uploading

## Environment Variables

Create a `.env` file in the root directory:

```env
# Python service URL (default: http://localhost:5001)
PYTHON_SERVICE_URL=http://localhost:5001

# Python service port
PYTHON_SERVICE_PORT=5001

# Node.js server port (default: 5000)
PORT=5000

# Claude API Configuration (optional - for improved translation accuracy)
# Get your API key from: https://console.anthropic.com/
CLAUDE_API_KEY=your_claude_api_key_here
CLAUDE_MODEL=claude-3-5-sonnet-20241022
CLAUDE_MAX_TOKENS=4096
```

### Claude API Setup (Optional - for 98%+ Translation Accuracy)

To enable AI-powered translation correction for Hindi and other Indian languages:

1. **Get a Claude API key** from [Anthropic Console](https://console.anthropic.com/)
2. **Create a `.env` file** in the root directory (copy from `.env.example`)
3. **Add your API key** to the `.env` file:
   ```
   CLAUDE_API_KEY=sk-ant-api03-...
   ```
4. **Use the correction feature** by adding `use_claude_correction=true` when transcribing

**Cost Estimate**: ~$0.15-$0.30 per 10-minute audio file using Claude 3.5 Sonnet

**Benefits**:
- Fixes missing words and phrases
- Improves contextual accuracy
- Better handling of cultural/idiomatic expressions
- Consistent terminology across segments

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [Faster Whisper](https://github.com/guillaumekln/faster-whisper) - Fast Whisper implementation
- [OpenAI Whisper](https://github.com/openai/whisper) - Original Whisper model
- [shadcn/ui](https://ui.shadcn.com/) - UI components

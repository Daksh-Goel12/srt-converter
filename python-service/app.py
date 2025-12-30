"""
Flask application for audio transcription service.
Provides REST API and WebSocket support for real-time progress updates.
"""
import os
import uuid
import json
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
from transcription_service import TranscriptionService
import threading

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent / '.env')

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")

# Configuration
UPLOAD_FOLDER = Path("uploads")
OUTPUT_FOLDER = Path("outputs")
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'm4a', 'aac', 'mp4', 'mov', 'webm', 'flac', 'ogg'}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB

UPLOAD_FOLDER.mkdir(exist_ok=True)
OUTPUT_FOLDER.mkdir(exist_ok=True)

# Job persistence
JOBS_FILE = Path("jobs.json")

def save_jobs():
    """Save jobs to disk for persistence."""
    try:
        with open(JOBS_FILE, 'w', encoding='utf-8') as f:
            json.dump(jobs, f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving jobs: {e}")

def load_jobs():
    """Load jobs from disk."""
    if JOBS_FILE.exists():
        try:
            with open(JOBS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading jobs: {e}")
            return {}
    return {}

# Load existing jobs on startup
jobs = load_jobs()
print(f"Loaded {len(jobs)} existing jobs from storage")


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_file_hash(file_path):
    """Calculate SHA256 hash of a file for deduplication."""
    import hashlib
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        # Read file in chunks to handle large files
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def find_cached_job(file_hash):
    """Find a completed job with the same file hash."""
    for job_id, job in jobs.items():
        if job.get("file_hash") == file_hash and job.get("status") == "completed":
            return job_id, job
    return None, None


def cleanup_files(job_id):
    """Clean up temporary files for a job."""
    if job_id in jobs:
        job = jobs[job_id]
        
        # Remove audio file
        if 'audio_path' in job and os.path.exists(job['audio_path']):
            try:
                os.remove(job['audio_path'])
            except Exception as e:
                print(f"Error removing audio file: {e}")
        
        # Remove SRT file after some time (keep for download)
        # This should be called after a delay or when explicitly requested


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "service": "transcription"}), 200


@app.route('/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe an audio file to SRT format.
    
    Form data:
        - file: Audio file
        - model_size: Model size (tiny, base, small, medium, large-v2, large-v3)
        - language: Language code (optional, auto-detect if not provided)
        - task: "transcribe" or "translate"
    """
    try:
        # Validate file
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"}), 400
        
        # Get parameters
        model_size = request.form.get('model_size', 'base')
        language = request.form.get('language', None)
        task = request.form.get('task', 'transcribe')
        use_claude_correction = request.form.get('use_claude_correction', 'false').lower() == 'true'
        source_language = request.form.get('source_language', 'Hindi')
        
        # Validate model size
        valid_models = ['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3']
        if model_size not in valid_models:
            return jsonify({"error": f"Invalid model size. Valid options: {', '.join(valid_models)}"}), 400
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Save uploaded file
        filename = secure_filename(file.filename)
        audio_path = UPLOAD_FOLDER / f"{job_id}_{filename}"
        file.save(str(audio_path))
        
        # Calculate file hash for deduplication
        file_hash = get_file_hash(str(audio_path))
        
        # Check if this file has been transcribed before
        # SIMPLIFIED: Disable cache to force re-run with new code/prompts
        # cached_job_id, cached_job = find_cached_job(file_hash)
        # if cached_job_id:
        #     print(f"Cache hit! Returning cached result from job {cached_job_id}")
        #     try:
        #         os.remove(str(audio_path))
        #     except Exception as e:
        #         print(f"Error removing duplicate file: {e}")
        #     return jsonify(cached_job)
            
            # Return the cached job result immediately
            # return jsonify({
            #     "job_id": cached_job_id,
            #     "status": "completed",
            #     "message": "File already transcribed - returning cached result",
            #     "cached": True,
            #     "metadata": cached_job.get("metadata", {}),
            #     "segments": cached_job.get("segments", [])
            # }), 200
        
        # Initialize job with file hash
        jobs[job_id] = {
            "id": job_id,
            "status": "queued",
            "progress": 0,
            "filename": filename,
            "audio_path": str(audio_path),
            "model_size": model_size,
            "language": language,
            "task": task,
            "file_hash": file_hash  # Store hash for future deduplication
        }
        save_jobs()  # Persist to disk
        
        # Start transcription in background task (compatible with eventlet)
        socketio.start_background_task(
            process_transcription,
            job_id,
            str(audio_path),
            model_size,
            language,
            task,
            use_claude_correction,
            source_language
        )
        
        return jsonify({
            "job_id": job_id,
            "status": "queued",
            "message": "Transcription started"
        }), 202
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Internal Server Error: {str(e)}"}), 500


def process_transcription(job_id, audio_path, model_size, language, task, use_claude_correction=False, source_language="Hindi"):
    """Process transcription in background thread."""
    try:
        # Update job status
        jobs[job_id]["status"] = "processing"
        save_jobs()  # Persist to disk
        
        # Progress callback
        def progress_callback(data):
            jobs[job_id]["progress"] = data["progress"]
            jobs[job_id]["stage"] = data["stage"]
            jobs[job_id]["message"] = data["message"]
            
            # Emit progress via WebSocket
            socketio.emit('progress', {
                "job_id": job_id,
                **data
            }, namespace='/')
        
        # Create transcription service
        service = TranscriptionService(
            model_size=model_size,
            device="cpu",  # Change to "cuda" if GPU available
            compute_type="int8"
        )
        
        # Transcribe and generate SRT (with optional Claude correction)
        output_path = OUTPUT_FOLDER / f"{job_id}.srt"
        srt_content, metadata, segments = service.transcribe_to_srt(
            audio_path,
            output_path=str(output_path),
            language=language,
            task=task,
            progress_callback=progress_callback,
            use_claude_correction=use_claude_correction,
            source_language=source_language
        )
        
        # Update job with results
        jobs[job_id].update({
            "status": "completed",
            "progress": 100,
            "srt_path": str(output_path),
            "metadata": metadata,
            "segments": segments  # Store segments for frontend
        })
        save_jobs()  # Persist to disk
        
        # Emit completion
        socketio.emit('completed', {
            "job_id": job_id,
            "metadata": metadata,
            "segments": segments  # Send segments via WebSocket
        }, namespace='/')
        
        # Clean up audio file
        try:
            os.remove(audio_path)
        except Exception as e:
            print(f"Error removing audio file: {e}")
            
    except Exception as e:
        # Update job with error
        jobs[job_id].update({
            "status": "failed",
            "error": str(e)
        })
        save_jobs()  # Persist to disk
        
        # Emit error
        socketio.emit('error', {
            "job_id": job_id,
            "error": str(e)
        }, namespace='/')
        
        print(f"Transcription error for job {job_id}: {e}")


@app.route('/status/<job_id>', methods=['GET'])
def get_status(job_id):
    """Get the status of a transcription job."""
    if job_id not in jobs:
        return jsonify({"error": "Job not found"}), 404
    
    job = jobs[job_id]
    response = {
        "job_id": job_id,
        "status": job["status"],
        "progress": job.get("progress", 0),
        "stage": job.get("stage", ""),
        "message": job.get("message", "")
    }
    
    if job["status"] == "completed":
        response["metadata"] = job.get("metadata", {})
        response["segments"] = job.get("segments", [])  # Include segments
    elif job["status"] == "failed":
        response["error"] = job.get("error", "Unknown error")
    
    return jsonify(response), 200


@app.route('/download/<job_id>', methods=['GET'])
def download_srt(job_id):
    """Download the generated SRT file."""
    if job_id not in jobs:
        return jsonify({"error": "Job not found"}), 404
    
    job = jobs[job_id]
    
    if job["status"] != "completed":
        return jsonify({"error": "Transcription not completed"}), 400
    
    srt_path = job.get("srt_path")
    if not srt_path or not os.path.exists(srt_path):
        return jsonify({"error": "SRT file not found"}), 404
    
    return send_file(
        srt_path,
        as_attachment=True,
        download_name=f"{job['filename'].rsplit('.', 1)[0]}.srt",
        mimetype='text/plain'
    )


@app.route('/cleanup/<job_id>', methods=['DELETE'])
def cleanup_job(job_id):
    """Clean up files for a completed job."""
    if job_id not in jobs:
        return jsonify({"error": "Job not found"}), 404
    
    cleanup_files(job_id)
    del jobs[job_id]
    
    return jsonify({"message": "Job cleaned up successfully"}), 200


@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection."""
    print('Client connected')
    emit('connected', {'message': 'Connected to transcription service'})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection."""
    print('Client disconnected')


if __name__ == '__main__':
    port = int(os.environ.get('PYTHON_SERVICE_PORT', 5001))
    print(f"Starting transcription service on port {port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=True, use_reloader=False, allow_unsafe_werkzeug=True)

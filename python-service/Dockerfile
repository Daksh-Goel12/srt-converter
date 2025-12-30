FROM python:3.11-slim

# Install system dependencies including ffmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set up a new user named "user" with user ID 1000
RUN useradd -m -u 1000 user

# Switch to the "user" user
USER user

# Set home to the user's home directory
ENV HOME=/home/user \
	PATH=/home/user/.local/bin:$PATH

# Set the working directory to the user's home directory
WORKDIR $HOME/app

# Copy the current directory contents into the container at $HOME/app setting the owner to the user
COPY --chown=user . $HOME/app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn

# Create necessary directories
RUN mkdir -p uploads outputs

# Expose port 7860 for Hugging Face Spaces
EXPOSE 7860

# Start the application using gunicorn on port 7860
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "--timeout", "1000", "--bind", "0.0.0.0:7860", "app:app"]

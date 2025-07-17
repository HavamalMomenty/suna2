FROM ghcr.io/astral-sh/uv:python3.11-alpine

ENV ENV_MODE production
WORKDIR /app

# Install Python dependencies
COPY pyproject.toml uv.lock ./
ENV UV_LINK_MODE=copy
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --quiet

# Install critical dependencies directly
RUN pip install structlog==25.4.0 python-dotenv==1.0.1

# Install much older stable versions without broken dependencies
RUN pip install --no-cache-dir llama-parse==0.4.9 llama-index-core==0.10.57
# Install matching versions
#RUN pip install --no-cache-dir \
#      llama-cloud-services==0.6.46 \
#      llama-index-core==0.12.49

# Copy application code
COPY . .


# ensure the venv has pip (create if empty), then install
RUN if [ ! -x /app/.venv/bin/pip ]; then \
        python -m venv /app/.venv; \
    fi \
    && /app/.venv/bin/pip install --upgrade pip \
    && /app/.venv/bin/pip install llama-cloud-services==0.6.46
#RUN rm -rf /app/.venv

# make sure the package is installed globally
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir llama-cloud-services==0.6.46


# Calculate optimal worker count based on 16 vCPUs
# Using (2*CPU)+1 formula for CPU-bound applications
ENV WORKERS=33
ENV THREADS=2
ENV WORKER_CONNECTIONS=2000

ENV PYTHONPATH=/app

EXPOSE 8000

# Gunicorn configuration
CMD ["sh", "-c", "uv run gunicorn api:app \
  --workers $WORKERS \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 1800 \
  --graceful-timeout 600 \
  --keep-alive 1800 \
  --max-requests 0 \
  --max-requests-jitter 0 \
  --forwarded-allow-ips '*' \
  --worker-connections $WORKER_CONNECTIONS \
  --worker-tmp-dir /dev/shm \
  --preload \
  --log-level info \
  --access-logfile - \
  --error-logfile - \
  --capture-output \
  --enable-stdio-inheritance \
  --threads $THREADS"]

#RUN pip install debugpy



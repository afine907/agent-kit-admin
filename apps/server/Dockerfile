FROM python:3.11-slim

WORKDIR /app

# Install system deps for cryptography (passlib) and DB (asyncpg)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps: build from pyproject.toml (single source of truth, no manual sync)
COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

# Copy source (cached separately; only rebuilds when app/ changes)
COPY app/ app/

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

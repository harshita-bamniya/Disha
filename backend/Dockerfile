FROM python:3.12-slim

WORKDIR /app

# System deps for psycopg2 and compilation
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# fastembed (ONNX embeddings) installed separately — avoids silent conflict resolution
# with onnxruntime's transitive deps when installed alongside other packages in one pass
RUN pip install --no-cache-dir fastembed==0.4.2

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

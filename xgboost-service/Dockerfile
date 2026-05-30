FROM python:3.11-slim-bookworm

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

ENV MODEL_PATH=/models/model.json

EXPOSE 7888

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7888/health')" || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7888"]

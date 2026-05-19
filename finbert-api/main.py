import os
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch

MODEL_ID = os.getenv("FINBERT_MODEL_ID", "ProsusAI/finbert")
API_KEY = os.getenv("FINBERT_API_KEY", "")
HF_HOME = os.getenv("HF_HOME", "/models")

tokenizer: AutoTokenizer | None = None
model: AutoModelForSequenceClassification | None = None
label_map: dict[int, str] = {}


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=8192)


class AnalyzeResponse(BaseModel):
    label: Literal["positive", "negative", "neutral"]
    scores: dict[str, float]


class BatchItem(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    text: str = Field(min_length=1, max_length=8192)


class BatchAnalyzeRequest(BaseModel):
    items: list[BatchItem] = Field(min_length=1, max_length=32)


class BatchAnalyzeResult(BaseModel):
    id: str
    label: Literal["positive", "negative", "neutral"] | None = None
    scores: dict[str, float] | None = None
    error: str | None = None


class BatchAnalyzeResponse(BaseModel):
    results: list[BatchAnalyzeResult]


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if not API_KEY:
        return
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid api key")


@asynccontextmanager
async def lifespan(_: FastAPI):
    global tokenizer, model, label_map
    cache_dir = HF_HOME
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, cache_dir=cache_dir)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID, cache_dir=cache_dir)
    model.eval()
    label_map = {int(k): v for k, v in model.config.id2label.items()}
    yield


app = FastAPI(title="FinBERT API", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    ready = model is not None and tokenizer is not None
    return {"status": "ok" if ready else "starting"}


def _analyze_text(text: str) -> AnalyzeResponse:
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="model loading")
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        logits = model(**inputs).logits[0]
    probs = torch.softmax(logits, dim=0).tolist()
    scores = {label_map[i]: round(float(p), 6) for i, p in enumerate(probs)}
    label = max(scores, key=scores.get)
    return AnalyzeResponse(label=label, scores=scores)


@app.post("/analyze", response_model=AnalyzeResponse, dependencies=[Depends(require_api_key)])
def analyze(body: AnalyzeRequest) -> AnalyzeResponse:
    return _analyze_text(body.text)


@app.post("/analyze/batch", response_model=BatchAnalyzeResponse, dependencies=[Depends(require_api_key)])
def analyze_batch(body: BatchAnalyzeRequest) -> BatchAnalyzeResponse:
    results: list[BatchAnalyzeResult] = []
    for item in body.items:
        try:
            out = _analyze_text(item.text)
            results.append(
                BatchAnalyzeResult(id=item.id, label=out.label, scores=out.scores)
            )
        except HTTPException as exc:
            results.append(BatchAnalyzeResult(id=item.id, error=str(exc.detail)))
        except Exception as exc:  # noqa: BLE001
            results.append(BatchAnalyzeResult(id=item.id, error=str(exc)))
    return BatchAnalyzeResponse(results=results)

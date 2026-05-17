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


@app.post("/analyze", response_model=AnalyzeResponse, dependencies=[Depends(require_api_key)])
def analyze(body: AnalyzeRequest) -> AnalyzeResponse:
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="model loading")

    inputs = tokenizer(body.text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        logits = model(**inputs).logits[0]
    probs = torch.softmax(logits, dim=0).tolist()

    scores = {label_map[i]: round(float(p), 6) for i, p in enumerate(probs)}
    label = max(scores, key=scores.get)
    return AnalyzeResponse(label=label, scores=scores)

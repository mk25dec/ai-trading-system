import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
import xgboost as xgb

MODEL_PATH = os.getenv("MODEL_PATH", "/models/model.json")

model: xgb.XGBClassifier | None = None


class PredictionRequest(BaseModel):
    features: list[float]


@asynccontextmanager
async def lifespan(_: FastAPI):
    global model
    if os.path.isfile(MODEL_PATH):
        loaded = xgb.XGBClassifier()
        loaded.load_model(MODEL_PATH)
        model = loaded
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok" if model is not None else "no_model"}


@app.post("/predict")
def predict(data: PredictionRequest):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail=f"model not loaded; place file at {MODEL_PATH}",
        )

    X = np.array([data.features])
    prediction = model.predict(X)[0]
    probability = model.predict_proba(X)[0].tolist()

    return {
        "prediction": int(prediction),
        "probability": probability,
    }

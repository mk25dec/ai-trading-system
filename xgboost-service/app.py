from fastapi import FastAPI
from pydantic import BaseModel
import xgboost as xgb
import numpy as np

app = FastAPI()

model = xgb.XGBClassifier()
model.load_model("model.json")

class PredictionRequest(BaseModel):
    features: list[float]

@app.post("/predict")
def predict(data: PredictionRequest):

    X = np.array([data.features])

    prediction = model.predict(X)[0]
    probability = model.predict_proba(X)[0].tolist()

    return {
        "prediction": int(prediction),
        "probability": probability
    }

@app.get("/")
def health():
    return {"status": "running"}
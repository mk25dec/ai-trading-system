package calibration

import (
	"encoding/json"
	"math"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/services"
)

// ParseSnapshotFeatures unmarshals snapshot JSON maps into typed feature structs.
func ParseSnapshotFeatures(snap models.SymbolFeatureSnapshot) (*models.MarketFeatures, *models.NewsFeatures) {
	var mf *models.MarketFeatures
	var nf *models.NewsFeatures

	if len(snap.MarketFeatures) > 0 {
		mf = &models.MarketFeatures{Symbol: snap.Symbol, Timestamp: snap.Timestamp}
		b, _ := json.Marshal(snap.MarketFeatures)
		_ = json.Unmarshal(b, mf)
	}
	if len(snap.NewsFeatures) > 0 {
		nf = &models.NewsFeatures{Symbol: snap.Symbol, Timestamp: snap.Timestamp}
		b, _ := json.Marshal(snap.NewsFeatures)
		_ = json.Unmarshal(b, nf)
	}
	return mf, nf
}

// ReplayDecision runs the decision engine with optional calibration params.
func ReplayDecision(symbol string, mf *models.MarketFeatures, nf *models.NewsFeatures, p Params) models.DecisionView {
	ApplyParams(p)
	return services.ComputeDecision(symbol, mf, nf)
}

// FeatureVector extracts scalar features for backtest correlation.
func FeatureVector(d models.DecisionView, nf *models.NewsFeatures) map[string]float64 {
	out := map[string]float64{
		"composite":  d.CompositeScore,
		"confidence": d.Confidence,
		"p_up_proxy": ProbUpProxy(d),
	}
	for _, h := range d.Horizons {
		switch h.ID {
		case "short":
			out["horizon_3d"] = h.Score
		case "swing":
			out["horizon_1w"] = h.Score
		case "position":
			out["horizon_1m"] = h.Score
		}
	}
	if nf != nil {
		if s, c, ok := services.FinbertCategoryScore(nf); ok {
			out["finbert_score"] = s
			out["finbert_conf"] = c
		}
	}
	return out
}

// ProbUpProxy mirrors web price-outlook logistic mapping using active calibration params.
func ProbUpProxy(d models.DecisionView) float64 {
	p := services.CalibrationParamsActive()
	if d.CompositeScore <= 0 && d.Confidence <= 0.2 {
		return 0.5
	}
	logistic := 1 / (1 + math.Exp(-(d.CompositeScore-p.LogisticCenter)/p.LogisticScale))
	var short, swing, pos float64
	for _, h := range d.Horizons {
		switch h.ID {
		case "short":
			short = h.Score
		case "swing":
			swing = h.Score
		case "position":
			pos = h.Score
		}
	}
	if short <= 0 {
		short = d.CompositeScore
	}
	if swing <= 0 {
		swing = d.CompositeScore
	}
	if pos <= 0 {
		pos = d.CompositeScore
	}
	prior := (short*0.2 + swing*0.35 + pos*0.45) / 100
	v := logistic*0.5 + prior*0.35 + d.Confidence*0.1
	return clamp(v, 0.04, 0.96)
}

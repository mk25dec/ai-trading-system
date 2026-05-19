package services

import (
	"math"
	"time"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

const highConfidenceThreshold = 0.7

type SentimentRow struct {
	Symbol       string
	Label        string
	Score        float64
	Confidence   float64
	ProbPositive float64
	ProbNegative float64
	ProbNeutral  float64
	Relevance    float64
	At           time.Time
}

type finbertWindow struct {
	count              int
	posProbs           []float64
	negProbs           []float64
	neuProbs           []float64
	confidences        []float64
	scores             []float64
	posLabels          int
	negLabels          int
	neuLabels          int
	highConfPos        int
	highConfNeg        int
	weightedNum        float64
	weightedDen        float64
	maxPos             float64
	maxNeg             float64
	maxConf            float64
	sumPosProb         float64
	sumNegProb         float64
	sumNeuProb         float64
	probWeightSum      float64
}

func articleWeight(rel, confidence float64) float64 {
	if rel <= 0 {
		rel = 0.5
	}
	return clamp(rel, 0.2, 1) * clamp(confidence, 0.05, 1)
}

func (w *finbertWindow) add(r SentimentRow) {
	w.count++
	wt := articleWeight(r.Relevance, r.Confidence)

	w.posProbs = append(w.posProbs, r.ProbPositive)
	w.negProbs = append(w.negProbs, r.ProbNegative)
	w.neuProbs = append(w.neuProbs, r.ProbNeutral)
	w.confidences = append(w.confidences, r.Confidence)
	w.scores = append(w.scores, r.Score)

	w.sumPosProb += r.ProbPositive * wt
	w.sumNegProb += r.ProbNegative * wt
	w.sumNeuProb += r.ProbNeutral * wt
	w.probWeightSum += wt

	if r.ProbPositive > w.maxPos {
		w.maxPos = r.ProbPositive
	}
	if r.ProbNegative > w.maxNeg {
		w.maxNeg = r.ProbNegative
	}
	if r.Confidence > w.maxConf {
		w.maxConf = r.Confidence
	}
	if r.Confidence >= highConfidenceThreshold {
		switch r.Label {
		case "positive":
			w.highConfPos++
		case "negative":
			w.highConfNeg++
		}
	}
	w.weightedNum += r.Score * wt
	w.weightedDen += wt

	switch r.Label {
	case "positive":
		w.posLabels++
	case "negative":
		w.negLabels++
	default:
		w.neuLabels++
	}
}

func weightedAvg(sum, weightSum float64, fallback []float64) float64 {
	if weightSum > 0 {
		return sum / weightSum
	}
	return avg(fallback)
}

func AggregateFinbertMetrics(symbol string, rows []SentimentRow, now time.Time) models.FinbertMetrics {
	var w1h, w4h, w24h finbertWindow

	for _, r := range rows {
		if r.Symbol != symbol {
			continue
		}
		age := now.Sub(r.At)
		if age <= time.Hour {
			w1h.add(r)
		}
		if age <= 4*time.Hour {
			w4h.add(r)
		}
		if age <= 24*time.Hour {
			w24h.add(r)
		}
	}

	m := models.FinbertMetrics{}
	applyWindow(&m, "1h", w1h)
	applyWindow(&m, "4h", w4h)
	applyWindow(&m, "24h", w24h)
	return m
}

func applyWindow(m *models.FinbertMetrics, window string, w finbertWindow) {
	if w.count == 0 {
		return
	}
	n := float64(w.count)
	posPct := float64(w.posLabels) / n
	negPct := float64(w.negLabels) / n
	neuPct := float64(w.neuLabels) / n
	avgPos := weightedAvg(w.sumPosProb, w.probWeightSum, w.posProbs)
	avgNeg := weightedAvg(w.sumNegProb, w.probWeightSum, w.negProbs)
	avgNeu := weightedAvg(w.sumNeuProb, w.probWeightSum, w.neuProbs)
	avgConf := avg(w.confidences)
	var weighted *float64
	if w.weightedDen > 0 {
		v := w.weightedNum / w.weightedDen
		weighted = &v
	}

	switch window {
	case "1h":
		m.AvgProbPositive1h = &avgPos
		m.AvgProbNegative1h = &avgNeg
		m.AvgProbNeutral1h = &avgNeu
		m.AvgConfidence1h = &avgConf
		m.PositiveLabelPct1h = &posPct
		m.NegativeLabelPct1h = &negPct
		m.NeutralLabelPct1h = &neuPct
		if w.maxPos > 0 {
			m.MaxProbPositive1h = &w.maxPos
		}
		if w.maxNeg > 0 {
			m.MaxProbNegative1h = &w.maxNeg
		}
		m.HighConfPositive1h = w.highConfPos
		m.HighConfNegative1h = w.highConfNeg
		m.WeightedSentiment1h = weighted
	case "4h":
		m.AvgProbPositive4h = &avgPos
		m.AvgProbNegative4h = &avgNeg
		m.AvgProbNeutral4h = &avgNeu
		m.AvgConfidence4h = &avgConf
	case "24h":
		m.AvgProbPositive24h = &avgPos
		m.AvgProbNegative24h = &avgNeg
		m.AvgProbNeutral24h = &avgNeu
		m.AvgConfidence24h = &avgConf
		m.PositiveLabelPct24h = &posPct
		m.NegativeLabelPct24h = &negPct
		m.NeutralLabelPct24h = &neuPct
		if w.maxPos > 0 {
			m.MaxProbPositive24h = &w.maxPos
		}
		if w.maxNeg > 0 {
			m.MaxProbNegative24h = &w.maxNeg
		}
		if w.maxConf > 0 {
			m.MaxConfidence24h = &w.maxConf
		}
		m.HighConfPositive24h = w.highConfPos
		m.HighConfNegative24h = w.highConfNeg
		m.WeightedSentiment24h = weighted
		ent := labelEntropy(posPct, negPct, neuPct)
		m.LabelEntropy24h = &ent
	}
}

func labelEntropy(pos, neg, neu float64) float64 {
	ent := 0.0
	for _, p := range []float64{pos, neg, neu} {
		if p > 0 {
			ent -= p * math.Log2(p)
		}
	}
	return ent
}

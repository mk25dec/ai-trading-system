package services

import (
	"math"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

const (
	// PriceProjectionMinBars is minimum history before emitting predicted_price1.
	PriceProjectionMinBars = 8
	// PriceProjectionHorizonDays matches web PROJECTION_HORIZONS 1M (21 trading days).
	PriceProjectionHorizonDays = 21
)

// PredictedPrice1 computes the Sprint D center price for a forward horizon using the
// same formula family as web/src/lib/price-outlook.ts (expected return + vol band).
// lastPrice is the anchor close; score100 is the horizon score (0–100).
func PredictedPrice1(
	lastPrice float64,
	score100 float64,
	days int,
	annualizedVol float64,
	trendSlopePerDay float64,
	finbertEdge float64,
) float64 {
	if lastPrice <= 0 || days <= 0 {
		return 0
	}
	cp := CalibrationParamsActive()
	mu := expectedReturnPctGo(score100, days, annualizedVol, trendSlopePerDay, lastPrice, finbertEdge, cp.PUpsideFinbertWeight)
	return lastPrice * (1 + mu/100)
}

func expectedReturnPctGo(
	score100 float64,
	days int,
	annualizedVol float64,
	trendSlopePerDay float64,
	lastPrice float64,
	finbertEdge float64,
	pUpFinbertWeight float64,
) float64 {
	edge := score100/100 - 0.5 + finbertEdge*pUpFinbertWeight
	dailyVol := annualizedVol / math.Sqrt(252)
	volComponent := edge * dailyVol * math.Sqrt(float64(days)) * 100 * 1.25
	trendComponent := 0.0
	if lastPrice > 0 {
		trendComponent = (trendSlopePerDay / lastPrice) * float64(days) * 100
	}
	return volComponent + trendComponent
}

func projectionBandPricesGo(last float64, days int, muPct, annualizedVol float64) (center, upper, lower float64) {
	mu := muPct / 100
	sigma := (annualizedVol / math.Sqrt(252)) * math.Sqrt(float64(days))
	center = last * (1 + mu)
	upper = last * (1 + mu + sigma)
	lower = last * (1 + mu - sigma)
	return center, upper, lower
}

func clampFloat(v, lo, hi float64) float64 {
	return math.Min(hi, math.Max(lo, v))
}

func linearSlopeGo(values []float64) float64 {
	n := len(values)
	if n < 2 {
		return 0
	}
	var sumX, sumY, sumXY, sumXX float64
	for i := 0; i < n; i++ {
		x := float64(i)
		sumX += x
		sumY += values[i]
		sumXY += x * values[i]
		sumXX += x * x
	}
	denom := float64(n)*sumXX - sumX*sumX
	if denom == 0 {
		return 0
	}
	return (float64(n)*sumXY - sumX*sumY) / denom
}

func horizonScoreFromDecision(d models.DecisionView, id string, fallback float64) float64 {
	for _, h := range d.Horizons {
		if h.ID == id && h.Score > 0 {
			return h.Score
		}
	}
	return fallback
}

func finbertEdgeForProjection(nf *models.NewsFeatures) float64 {
	if nf == nil {
		return 0
	}
	if s := finbertSignedScore(nf.Finbert); s != nil {
		return clampFloat(*s, -1, 1)
	}
	s, _ := finbertHorizonScore(nf, sentimentWindow{h1: 0.10, h4: 0.25, h24: 0.65})
	return clampFloat((s-50)/50, -1, 1)
}

// BackfillPredictedPrices walks daily bars oldest-first and sets predicted_price1 on each row
// using only candles up to the prior bar (walk-forward). Uses latest news features when provided.
func BackfillPredictedPrices(asc []models.MarketCandle, nf *models.NewsFeatures) []float64 {
	n := len(asc)
	out := make([]float64, n)
	for i := range out {
		out[i] = math.NaN()
	}
	if n < PriceProjectionMinBars+1 {
		return out
	}
	for i := PriceProjectionMinBars; i < n; i++ {
		prefix := asc[:i]
		last := prefix[len(prefix)-1].Close
		reversed := reverseCandles(prefix)
		mf := ComputeMarketFeatures(reversed, "1Day")
		var vol float64 = 0.22
		var rsi float64 = 50
		if mf != nil {
			if mf.Volatility != nil {
				vol = clampFloat(*mf.Volatility, 0.08, 0.85)
			}
			if mf.RSI != nil {
				rsi = *mf.RSI
			}
		}
		meanRev := 0.0
		if rsi > 68 {
			meanRev = -0.08
		} else if rsi < 32 {
			meanRev = 0.08
		}
		decision := ComputeDecision(prefix[0].Symbol, mf, nf)
		score := horizonScoreFromDecision(decision, "position", decision.CompositeScore)
		fbEdge := finbertEdgeForProjection(nf)
		tail := make([]float64, 0, 20)
		start := i - 20
		if start < 0 {
			start = 0
		}
		for j := start; j < i; j++ {
			tail = append(tail, asc[j].Close)
		}
		slope := linearSlopeGo(tail)
		cp := CalibrationParamsActive()
		mu := expectedReturnPctGo(score, PriceProjectionHorizonDays, vol, slope, last, fbEdge, cp.PUpsideFinbertWeight)
		mu += meanRev * (float64(PriceProjectionHorizonDays) / 21.0)
		out[i] = last * (1 + mu/100)
	}
	return out
}

func reverseCandles(in []models.MarketCandle) []models.MarketCandle {
	out := make([]models.MarketCandle, len(in))
	for i := range in {
		out[i] = in[len(in)-1-i]
	}
	return out
}

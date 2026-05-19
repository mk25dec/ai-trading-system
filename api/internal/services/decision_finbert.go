package services

import (
	"math"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

const (
	weightTechnical = 0.35
	weightTrend     = 0.12
	weightNews      = 0.48
	weightRisk      = 0.05
)

// finbertHorizonScore blends FinBERT windows (1h/4h/24h) per horizon weights.
// Uses softmax edges, weighted sentiment, entropy discount, and tail/high-conf signals.
func finbertHorizonScore(nf *models.NewsFeatures, sw sentimentWindow) (score float64, conf float64) {
	if nf == nil {
		return 0, 0
	}
	fb := nf.Finbert

	type win struct {
		weight float64
		count  int
	}

	wins := []struct {
		w   win
		edge func() *float64
		conf func() *float64
	}{
		{win{sw.h1, nf.NewsCount1h}, func() *float64 { return finbertWindowEdge(fb, "1h") }, func() *float64 { return fb.AvgConfidence1h }},
		{win{sw.h4, nf.NewsCount4h}, func() *float64 { return finbertWindowEdge(fb, "4h") }, func() *float64 { return fb.AvgConfidence4h }},
		{win{sw.h24, nf.NewsCount24h}, func() *float64 { return finbertWindowEdge(fb, "24h") }, func() *float64 { return fb.AvgConfidence24h }},
	}

	var acc, wsum float64
	var confParts []float64

	for _, x := range wins {
		if x.w.weight <= 0 || x.w.count == 0 {
			continue
		}
		edge := x.edge()
		if edge == nil {
			continue
		}
		coverage := math.Min(1, float64(x.w.count)/3)
		edgeVal := *edge
		if x.w.count >= 24 || x.w.weight == sw.h24 {
			edgeVal = applyEntropyDiscount(edgeVal, fb.LabelEntropy24h)
		}
		acc += edgeVal * x.w.weight * coverage
		wsum += x.w.weight * coverage
		if c := x.conf(); c != nil {
			confParts = append(confParts, *c)
		}
	}

	if wsum == 0 {
		if s := finbertSignedScore(fb); s != nil {
			acc, wsum = *s, 1
		} else if s := finbertLabelScore(fb); s != nil {
			acc, wsum = *s, 1
		} else {
			return 0, 0
		}
	} else {
		acc /= wsum
	}

	score = clamp(acc, -1, 1)
	score += finbertTailAdjustment(fb)
	score += finbertHighConfAdjustment(fb, sw)
	if nf.PositiveNewsSpike {
		score = clamp(score+0.2, -1, 1)
	}
	if nf.NegativeNewsSpike {
		score = clamp(score-0.28, -1, 1)
	}

	n := nf.NewsCount24h
	if n == 0 {
		n = nf.NewsCount1h + nf.NewsCount4h
	}
	conf = 0.45
	if fb.MaxConfidence24h != nil {
		conf = math.Max(conf, clamp(*fb.MaxConfidence24h, 0.35, 0.95))
	}
	if fb.AvgConfidence24h != nil {
		conf = combineConfidence(conf, *fb.AvgConfidence24h)
	}
	if n > 0 && fb.PositiveLabelPct24h != nil {
		pos := int(*fb.PositiveLabelPct24h * float64(n))
		conf = combineConfidence(conf, wilsonLowerBound(pos, n, 1.96), sampleConfidence(n, 5))
	}
	if len(confParts) > 0 {
		conf = combineConfidence(append(confParts, conf)...)
	}
	if fb.LabelEntropy24h != nil && *fb.LabelEntropy24h > 1.35 {
		conf *= 0.85
	}

	return score, clamp(conf, 0.2, 0.95)
}

func finbertWindowEdge(fb models.FinbertMetrics, window string) *float64 {
	switch window {
	case "1h":
		if fb.WeightedSentiment1h != nil {
			return fb.WeightedSentiment1h
		}
		return probEdge(fb.AvgProbPositive1h, fb.AvgProbNegative1h, fb.AvgProbNeutral1h)
	case "4h":
		return probEdge(fb.AvgProbPositive4h, fb.AvgProbNegative4h, fb.AvgProbNeutral4h)
	case "24h":
		if fb.WeightedSentiment24h != nil {
			return fb.WeightedSentiment24h
		}
		return probEdge(fb.AvgProbPositive24h, fb.AvgProbNegative24h, fb.AvgProbNeutral24h)
	default:
		return nil
	}
}

func probEdge(pos, neg, neu *float64) *float64 {
	if pos == nil && neg == nil {
		return nil
	}
	p, n, u := 0.0, 0.0, 0.0
	if pos != nil {
		p = *pos
	}
	if neg != nil {
		n = *neg
	}
	if neu != nil {
		u = *neu
	}
	s := p - n
	if u > 0.55 {
		s *= 0.5
	}
	out := clamp(s, -1, 1)
	return &out
}

func applyEntropyDiscount(score float64, entropy *float64) float64 {
	if entropy == nil {
		return score
	}
	// High entropy ≈ mixed labels → dampen 24h edge (max entropy log2(3) ≈ 1.58).
	if *entropy > 1.2 {
		factor := 1 - (*entropy-1.2)*0.35
		if factor < 0.55 {
			factor = 0.55
		}
		return score * factor
	}
	return score
}

func finbertTailAdjustment(fb models.FinbertMetrics) float64 {
	var adj float64
	if fb.MaxProbNegative24h != nil && *fb.MaxProbNegative24h > 0.75 {
		adj -= 0.12 * (*fb.MaxProbNegative24h - 0.75) / 0.25
	}
	if fb.MaxProbPositive24h != nil && *fb.MaxProbPositive24h > 0.75 {
		adj += 0.08 * (*fb.MaxProbPositive24h - 0.75) / 0.25
	}
	if fb.MaxProbNegative1h != nil && *fb.MaxProbNegative1h > 0.8 {
		adj -= 0.08
	}
	return adj
}

func finbertHighConfAdjustment(fb models.FinbertMetrics, sw sentimentWindow) float64 {
	var adj float64
	if sw.h1 > 0.3 {
		if fb.HighConfPositive1h >= 2 {
			adj += 0.06
		}
		if fb.HighConfNegative1h >= 2 {
			adj -= 0.08
		}
	}
	if sw.h24 > 0.3 {
		if fb.HighConfPositive24h >= 3 {
			adj += 0.05
		}
		if fb.HighConfNegative24h >= 3 {
			adj -= 0.07
		}
	}
	return adj
}

// finalHorizonRaw implements Σᵢ (CategoryScoreᵢ × Weightᵢ × Confidenceᵢ) with horizon-specific news.
func finalHorizonRaw(cats []models.CategoryScore, nf *models.NewsFeatures, sw sentimentWindow, hw horizonWeights) float64 {
	var sum float64
	techBundle := 0.0

	for _, c := range cats {
		score := c.Score
		conf := c.Confidence

		switch c.ID {
		case "finbert", "sentiment":
			s, cfb := finbertHorizonScore(nf, sw)
			if cfb > 0 {
				score, conf = s, cfb
			} else if c.ID == "sentiment" {
				score = horizonSentiment(nf, sw)
				conf = clamp(0.35+sampleConfidence(nf.NewsCount24h, 5)*0.4, 0.25, 0.85)
			} else {
				continue
			}
			sum += score * c.Weight * conf * hw.sentiment / weightNews
		case "technical", "trend":
			techBundle += score * c.Weight * conf
		case "risk":
			if score < 0 {
				sum += score * c.Weight * conf * hw.risk / weightRisk
			}
		}
	}

	if techBundle != 0 {
		sum += techBundle * hw.technical / (weightTechnical + weightTrend)
	}
	return sum
}

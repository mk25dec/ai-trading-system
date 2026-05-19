package services

import (
	"math"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

// inferNewsScore returns a signed sentiment in [−1,1] and confidence in [0,1].
func inferNewsScore(nf *models.NewsFeatures) (*float64, float64) {
	if nf == nil {
		return nil, 0
	}

	type window struct {
		score    *float64
		weight   float64
		count    int
		modelConf *float64
	}

	windows := []window{
		{nf.AvgSentiment1h, decayWeight(0.5, 6) * 1.2, nf.NewsCount1h, nf.Finbert.AvgConfidence1h},
		{nf.AvgSentiment4h, decayWeight(2, 12) * 1.0, nf.NewsCount4h, nf.Finbert.AvgConfidence4h},
		{nf.AvgSentiment24h, decayWeight(12, 24) * 0.85, nf.NewsCount24h, nf.Finbert.AvgConfidence24h},
	}

	var acc, w float64
	var confParts []float64
	totalArticles := nf.NewsCount1h + nf.NewsCount4h + nf.NewsCount24h

	for _, win := range windows {
		if win.score == nil || win.count == 0 || win.weight == 0 {
			continue
		}
		coverage := math.Min(1, float64(win.count)/3)
		acc += clamp(*win.score, -1, 1) * win.weight * coverage
		w += win.weight * coverage
		if win.modelConf != nil {
			confParts = append(confParts, *win.modelConf)
		}
	}

	if s := finbertSignedScore(nf.Finbert); s != nil {
		fbW := 1.35
		if w > 0 {
			acc = acc/w*0.55 + *s*fbW*0.45
			w = 1
		} else {
			acc = *s
			w = fbW
		}
		if nf.Finbert.AvgConfidence24h != nil {
			confParts = append(confParts, *nf.Finbert.AvgConfidence24h)
		} else if nf.Finbert.AvgConfidence1h != nil {
			confParts = append(confParts, *nf.Finbert.AvgConfidence1h)
		}
	} else if labelScore := finbertLabelScore(nf.Finbert); labelScore != nil {
		if w > 0 {
			acc = acc/w*0.6 + *labelScore*0.4
		} else {
			acc = *labelScore
		}
		w = 1
		confParts = append(confParts, 0.45)
	}

	if w > 0 {
		score := clamp(acc, -1, 1)
		if nf.PositiveNewsSpike {
			score = clamp(score+0.2, -1, 1)
		}
		if nf.NegativeNewsSpike {
			score = clamp(score-0.28, -1, 1)
		}
		conf := combineConfidence(sampleConfidence(totalArticles, 5), combineConfidence(confParts...))
		return &score, conf
	}

	return nil, sampleConfidence(totalArticles, 5)
}

func finbertLabelScore(fb models.FinbertMetrics) *float64 {
	pos, neg := fb.PositiveLabelPct24h, fb.NegativeLabelPct24h
	if pos == nil && neg == nil {
		pos, neg = fb.PositiveLabelPct1h, fb.NegativeLabelPct1h
	}
	if pos == nil && neg == nil {
		return nil
	}
	p, n := 0.0, 0.0
	if pos != nil {
		p = *pos
	}
	if neg != nil {
		n = *neg
	}
	s := p - n
	return &s
}

func newsStanceFromFeatures(nf *models.NewsFeatures) (string, *float64) {
	if nf == nil {
		return "no_news", nil
	}
	articles := nf.NewsCount24h
	if articles == 0 {
		articles = nf.NewsCount4h
	}
	if articles == 0 {
		articles = nf.NewsCount1h
	}
	if articles == 0 {
		return "no_news", nil
	}

	if score, conf := inferNewsScore(nf); score != nil {
		c := conf
		return stanceFromScore(*score), &c
	}

	// Articles exist but no scored sentiment yet (FinBERT backlog).
	low := 0.22
	return "neutral", &low
}

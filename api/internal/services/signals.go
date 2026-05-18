package services

import (
	"fmt"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

type Recommendation struct {
	Action     string
	Score      float64
	Confidence float64
	Reasons    []map[string]any
	Bullets    []string
}

func ComputeRecommendation(symbol string, mf *models.MarketFeatures, nf *models.NewsFeatures) Recommendation {
	return RecommendationFromDecision(symbol, mf, nf)
}

func BuildAnalysisBullets(symbol, action string, mf *models.MarketFeatures, nf *models.NewsFeatures) []string {
	var bullets []string

	label := recommendationLabel(action)
	bullets = append(bullets, fmt.Sprintf("Recommendation: %s for %s (research signal, not auto-trade).", label, symbol))

	if mf != nil {
		if mf.PriceChange24h != nil {
			bullets = append(bullets, fmt.Sprintf("Price change (24h): %+.2f%%.", *mf.PriceChange24h))
		}
		if mf.PriceChange5d != nil {
			bullets = append(bullets, fmt.Sprintf("Price change (5d): %+.2f%%.", *mf.PriceChange5d))
		}
		if mf.RSI != nil {
			bullets = append(bullets, fmt.Sprintf("RSI (14): %.1f.", *mf.RSI))
		}
		if mf.VolumeRatio != nil {
			bullets = append(bullets, fmt.Sprintf("Volume vs 20d avg: %.2fx.", *mf.VolumeRatio))
		}
		if mf.SMA20 != nil && mf.DistanceSMA20 != nil {
			bullets = append(bullets, fmt.Sprintf("Distance from 20d SMA: %+.2f%%.", *mf.DistanceSMA20))
		}
	} else {
		bullets = append(bullets, "Market data missing — run refresh after adding Alpaca credentials.")
	}

	if nf != nil {
		if nf.AvgSentiment24h != nil {
			tone := sentimentTone(*nf.AvgSentiment24h)
			bullets = append(bullets, fmt.Sprintf("FinBERT news tone (24h avg): %s (score %.2f).", tone, *nf.AvgSentiment24h))
		}
		bullets = append(bullets, fmt.Sprintf("News mentions: %d (1h), %d (24h).", nf.NewsCount1h, nf.NewsCount24h))
		if nf.PositiveNewsSpike {
			bullets = append(bullets, "Positive news spike detected in the last hour.")
		}
		if nf.NegativeNewsSpike {
			bullets = append(bullets, "Negative news spike detected in the last hour.")
		}
	} else {
		bullets = append(bullets, "No recent news sentiment for this symbol — FinBERT runs when related articles are ingested.")
	}

	return bullets
}

func recommendationLabel(action string) string {
	switch action {
	case "buy_candidate":
		return "Buy candidate"
	case "sell_candidate":
		return "Sell candidate"
	case "avoid":
		return "Avoid"
	default:
		return "Watch"
	}
}

func sentimentTone(score float64) string {
	switch {
	case score > 0.2:
		return "bullish"
	case score < -0.2:
		return "bearish"
	default:
		return "neutral"
	}
}

func WorkspaceSignalFromRecommendation(workspaceID, symbol string, rec Recommendation) models.WorkspaceSignal {
	reasons := make([]any, len(rec.Reasons))
	for i, r := range rec.Reasons {
		reasons[i] = r
	}
	return models.WorkspaceSignal{
		WorkspaceID: workspaceID,
		Symbol:      symbol,
		Action:      rec.Action,
		Direction:   "long",
		Score:       rec.Score,
		Confidence:  rec.Confidence,
		Reasons:     reasons,
	}
}

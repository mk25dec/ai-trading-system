package services

import (
	"testing"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

func TestComputeRecommendation_buyOnMomentumAndSentiment(t *testing.T) {
	ch24 := 3.5
	sent := 0.5
	mf := &models.MarketFeatures{PriceChange24h: &ch24}
	nf := &models.NewsFeatures{AvgSentiment24h: &sent}

	rec := ComputeRecommendation("IBM", mf, nf)
	if rec.Action != "buy_candidate" {
		t.Fatalf("expected buy_candidate, got %s", rec.Action)
	}
	if len(rec.Bullets) < 2 {
		t.Fatalf("expected analysis bullets, got %d", len(rec.Bullets))
	}
}

func TestComputeRecommendation_avoidOnNegativeSentiment(t *testing.T) {
	sent := -0.55
	nf := &models.NewsFeatures{AvgSentiment24h: &sent, NegativeNewsSpike: true}

	rec := ComputeRecommendation("IBM", nil, nf)
	if rec.Action != "avoid" {
		t.Fatalf("expected avoid, got %s", rec.Action)
	}
}

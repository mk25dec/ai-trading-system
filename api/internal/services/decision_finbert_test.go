package services

import (
	"testing"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

func TestFinbertHorizonScore_shortWindowPrefers1h(t *testing.T) {
	sent1h := 0.7
	sent24h := -0.25
	fb := models.FinbertMetrics{
		WeightedSentiment1h:  &sent1h,
		WeightedSentiment24h: &sent24h,
		AvgConfidence1h:      ptrFloat(0.8),
		AvgConfidence24h:     ptrFloat(0.75),
	}
	nf := &models.NewsFeatures{
		NewsCount1h:  4,
		NewsCount24h: 5,
		Finbert:      fb,
	}
	shortSW := sentimentWindow{h1: 0.65, h4: 0.25, h24: 0.10}
	longSW := sentimentWindow{h1: 0.10, h4: 0.25, h24: 0.65}

	shortScore, _ := finbertHorizonScore(nf, shortSW)
	longScore, _ := finbertHorizonScore(nf, longSW)
	if shortScore <= longScore {
		t.Fatalf("short horizon should weight 1h more: short=%v long=%v", shortScore, longScore)
	}
}

func TestScoreCategories_finbertNotDuplicatedWithSentiment(t *testing.T) {
	sent := 0.3
	nf := &models.NewsFeatures{
		NewsCount24h:    3,
		AvgSentiment24h: &sent,
		Finbert: models.FinbertMetrics{
			WeightedSentiment24h: &sent,
			AvgConfidence24h:     ptrFloat(0.7),
		},
	}
	cats := scoreCategories(nil, nf)
	hasFinbert, hasSentiment := false, false
	for _, c := range cats {
		if c.ID == "finbert" {
			hasFinbert = true
		}
		if c.ID == "sentiment" {
			hasSentiment = true
		}
	}
	if !hasFinbert || hasSentiment {
		t.Fatalf("expected finbert only, finbert=%v sentiment=%v", hasFinbert, hasSentiment)
	}
}

func TestScoreCategories_sentimentFallbackWithoutFinbert(t *testing.T) {
	sent := 0.2
	nf := &models.NewsFeatures{NewsCount24h: 2, AvgSentiment24h: &sent}
	cats := scoreCategories(nil, nf)
	hasSentiment := false
	for _, c := range cats {
		if c.ID == "sentiment" {
			hasSentiment = true
		}
		if c.ID == "finbert" {
			t.Fatal("unexpected finbert without FinBERT metrics")
		}
	}
	if !hasSentiment {
		t.Fatal("expected sentiment fallback")
	}
}

func TestApplyEntropyDiscount_highEntropy(t *testing.T) {
	ent := 1.5
	got := applyEntropyDiscount(0.8, &ent)
	if got >= 0.8 {
		t.Fatalf("expected dampening, got %v", got)
	}
}

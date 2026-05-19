package services

import (
	"testing"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

func TestComputeDecision_bullishAlignment(t *testing.T) {
	ch24, ch5, rsi, sent := 3.0, 4.0, 55.0, 0.45
	mf := &models.MarketFeatures{PriceChange24h: &ch24, PriceChange5d: &ch5, RSI: &rsi}
	nf := &models.NewsFeatures{
		NewsCount24h:    5,
		AvgSentiment24h: &sent,
		Finbert: models.FinbertMetrics{
			WeightedSentiment24h: &sent,
			AvgConfidence24h:     ptrFloat(0.72),
		},
	}

	d := ComputeDecision("NVDA", mf, nf)
	if d.PrimaryAction != "buy_candidate" && d.PrimaryAction != "watch" {
		t.Fatalf("expected buy or watch on bullish setup, got %s", d.PrimaryAction)
	}
	if d.CompositeScore < 55 {
		t.Fatalf("expected composite >= 55, got %.1f", d.CompositeScore)
	}
	if len(d.Horizons) != 3 {
		t.Fatalf("expected 3 horizons, got %d", len(d.Horizons))
	}
}

func TestComputeDecision_avoidOnBearishNews(t *testing.T) {
	sent := -0.6
	nf := &models.NewsFeatures{
		NewsCount24h:      4,
		AvgSentiment24h:   &sent,
		NegativeNewsSpike: true,
		Finbert: models.FinbertMetrics{
			WeightedSentiment24h: &sent,
			AvgProbNegative24h:   ptrFloat(0.7),
			AvgConfidence24h:     ptrFloat(0.8),
		},
	}

	d := ComputeDecision("IBM", nil, nf)
	rec := RecommendationFromDecision("IBM", nil, nf)
	if d.PrimaryAction != "avoid" && d.PrimaryAction != "sell_candidate" {
		t.Fatalf("expected avoid/sell, got %s", d.PrimaryAction)
	}
	if rec.Action != d.PrimaryAction {
		t.Fatalf("recommendation mismatch: %s vs %s", rec.Action, d.PrimaryAction)
	}
}

func TestComputeDecision_conflictPriceVsNews(t *testing.T) {
	ch := 3.0
	sent := -0.35
	mf := &models.MarketFeatures{PriceChange24h: &ch}
	nf := &models.NewsFeatures{NewsCount24h: 3, AvgSentiment24h: &sent}

	d := ComputeDecision("AAPL", mf, nf)
	if !d.Conflict {
		t.Fatal("expected conflict between price up and bearish news")
	}
}

func TestNewsStance_labelPctOnly(t *testing.T) {
	pos, neg := 0.55, 0.25
	nf := &models.NewsFeatures{
		NewsCount24h: 4,
		Finbert: models.FinbertMetrics{
			PositiveLabelPct24h: &pos,
			NegativeLabelPct24h: &neg,
		},
	}
	stance, conf := newsStanceFromFeatures(nf)
	if stance == "unknown" {
		t.Fatalf("expected stance from label pct, got unknown")
	}
	if stance != "bullish" {
		t.Fatalf("expected bullish, got %s", stance)
	}
	if conf == nil || *conf <= 0 {
		t.Fatal("expected positive confidence")
	}
}

func TestNewsStance_articlesNoScoreYet(t *testing.T) {
	nf := &models.NewsFeatures{NewsCount24h: 2}
	stance, conf := newsStanceFromFeatures(nf)
	if stance != "neutral" {
		t.Fatalf("expected neutral for unscored articles, got %s", stance)
	}
	if conf == nil {
		t.Fatal("expected low confidence")
	}
}

func TestNewsStance_noNews(t *testing.T) {
	stance, conf := newsStanceFromFeatures(nil)
	if stance != "no_news" || conf != nil {
		t.Fatalf("expected no_news, got %s", stance)
	}
}

func ptrFloat(v float64) *float64 { return &v }

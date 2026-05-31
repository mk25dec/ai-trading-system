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

func TestCategoryFinbert_requiresRecentArticles(t *testing.T) {
	pos, neg := 0.6, 0.2
	nf := &models.NewsFeatures{
		Finbert: models.FinbertMetrics{
			PositiveLabelPct24h: &pos,
			NegativeLabelPct24h: &neg,
		},
	}
	score, conf := categoryFinbert(nf)
	if score != 0 || conf != 0 {
		t.Fatalf("expected no finbert category without articles, got score=%v conf=%v", score, conf)
	}

	nf.NewsCount24h = 3
	score, conf = categoryFinbert(nf)
	if conf <= 0 {
		t.Fatalf("expected finbert category with articles, got score=%v conf=%v", score, conf)
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

func TestComputeDecision_emptyMarketStructNotScorable(t *testing.T) {
	d := ComputeDecision("EMPTY", &models.MarketFeatures{}, nil)
	if d.CompositeScore != 0 {
		t.Fatalf("empty market features should yield composite 0, got %.1f", d.CompositeScore)
	}
	for _, h := range d.Horizons {
		if h.Score != 0 {
			t.Fatalf("horizon %s should be 0 without signal, got %.1f", h.Label, h.Score)
		}
	}
}

func TestComputeDecision_insufficientWithoutMarketOrNews(t *testing.T) {
	d := ComputeDecision("FAKE", nil, nil)
	if d.CompositeScore != 0 {
		t.Fatalf("expected composite 0 without data, got %.1f", d.CompositeScore)
	}
	if d.PrimaryOutlook != "No data" {
		t.Fatalf("expected No data outlook, got %s", d.PrimaryOutlook)
	}
}

func TestNewsStance_noNews(t *testing.T) {
	stance, conf := newsStanceFromFeatures(nil)
	if stance != "no_news" || conf != nil {
		t.Fatalf("expected no_news, got %s", stance)
	}
}

func TestOutlookToAction_lowConfidenceForcesWatch(t *testing.T) {
	// Market-only watchlist: composite can be directional but trade action stays watch.
	mf := &models.MarketFeatures{PriceChange24h: ptrFloat(28.33), PriceChange5d: ptrFloat(30), RSI: ptrFloat(72)}
	d := ComputeDecision("HIVE", mf, &models.NewsFeatures{NewsCount24h: 1, AvgSentiment24h: ptrFloat(0.1)})
	if d.CompositeScore < 45 || d.CompositeScore >= 62 {
		t.Fatalf("expected mid-band composite, got %.1f", d.CompositeScore)
	}
	if d.PrimaryOutlook != "Watch" {
		t.Fatalf("expected Watch outlook in 45–61 band, got %s", d.PrimaryOutlook)
	}
	if d.PrimaryAction != "watch" {
		t.Fatalf("expected watch action when conf < 0.35, got %s (conf=%.2f)", d.PrimaryAction, d.Confidence)
	}
	if d.Confidence >= 0.35 {
		t.Fatalf("expected suppressed confidence without news coverage, got %.2f", d.Confidence)
	}
}

func TestApplyOverrides_buyOnStrongMomentumAndSentiment(t *testing.T) {
	ch, sent := 28.0, 0.35
	mf := &models.MarketFeatures{PriceChange24h: &ch, RSI: ptrFloat(72)}
	nf := &models.NewsFeatures{NewsCount24h: 5, AvgSentiment24h: &sent, AvgSentiment1h: ptrFloat(0.4)}
	d := ComputeDecision("HIVE", mf, nf)
	if d.PrimaryAction != "buy_candidate" {
		t.Fatalf("expected buy_candidate on momentum+sentiment override, got %s", d.PrimaryAction)
	}
}

func ptrFloat(v float64) *float64 { return &v }

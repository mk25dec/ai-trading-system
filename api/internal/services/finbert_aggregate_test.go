package services

import (
	"testing"
	"time"
)

func TestAggregateFinbertMetrics_probabilities(t *testing.T) {
	now := time.Now().UTC()
	rows := []SentimentRow{
		{
			Symbol: "NVDA", Label: "positive", Score: 0.9, Confidence: 0.9,
			ProbPositive: 0.9, ProbNegative: 0.05, ProbNeutral: 0.05,
			At: now.Add(-30 * time.Minute),
		},
		{
			Symbol: "NVDA", Label: "negative", Score: -0.8, Confidence: 0.8,
			ProbPositive: 0.1, ProbNegative: 0.8, ProbNeutral: 0.1,
			At: now.Add(-2 * time.Hour),
		},
	}

	m := AggregateFinbertMetrics("NVDA", rows, now)
	if m.AvgProbPositive1h == nil || *m.AvgProbPositive1h != 0.9 {
		t.Fatalf("expected avg prob positive 1h 0.9, got %v", m.AvgProbPositive1h)
	}
	if m.HighConfPositive1h != 1 {
		t.Fatalf("expected 1 high conf positive 1h")
	}
	if m.AvgProbNegative24h == nil {
		t.Fatalf("expected 24h negative prob avg")
	}
}

func TestAggregateFinbertMetrics_relevanceWeighting(t *testing.T) {
	now := time.Now().UTC()
	rows := []SentimentRow{
		{
			Symbol: "X", Label: "positive", Score: 0.9, Confidence: 0.9,
			ProbPositive: 0.9, ProbNegative: 0.05, ProbNeutral: 0.05,
			Relevance: 1.0, At: now.Add(-10 * time.Minute),
		},
		{
			Symbol: "X", Label: "negative", Score: -0.9, Confidence: 0.9,
			ProbPositive: 0.1, ProbNegative: 0.9, ProbNeutral: 0.0,
			Relevance: 0.15, At: now.Add(-20 * time.Minute),
		},
	}
	m := AggregateFinbertMetrics("X", rows, now)
	if m.AvgProbPositive1h == nil || *m.AvgProbPositive1h < 0.65 {
		t.Fatalf("high-relevance positive should dominate, got %v", m.AvgProbPositive1h)
	}
}

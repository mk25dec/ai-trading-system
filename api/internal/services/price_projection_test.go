package services

import (
	"math"
	"testing"
	"time"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

func TestPredictedPrice1_positiveScore(t *testing.T) {
	p := PredictedPrice1(100, 70, 21, 0.25, 0.05, 0.1)
	if p <= 100 {
		t.Fatalf("expected price above last with bullish score, got %v", p)
	}
}

func TestBackfillPredictedPrices_insufficientHistory(t *testing.T) {
	asc := make([]models.MarketCandle, 5)
	for i := range asc {
		asc[i] = models.MarketCandle{Symbol: "TEST", Close: 100 + float64(i)}
	}
	out := BackfillPredictedPrices(asc, nil, "1Day")
	for _, v := range out {
		if !math.IsNaN(v) {
			t.Fatal("expected all NaN for short series")
		}
	}
}

func TestBuildForwardChartPoints_threeDays(t *testing.T) {
	anchor := time.Date(2026, 5, 30, 20, 0, 0, 0, time.UTC)
	asc := make([]models.MarketCandle, 30)
	for i := range asc {
		asc[i] = models.MarketCandle{Symbol: "TEST", Close: 100 + float64(i)*0.5}
	}
	out := BuildForwardChartPoints(anchor, 115, "TEST", asc, nil)
	if len(out) == 0 {
		t.Fatal("expected forward points")
	}
	last := out[len(out)-1]
	if last.Timestamp.Before(anchor) {
		t.Fatalf("forward timestamps must be after anchor, got %v", last.Timestamp)
	}
	maxHorizon := anchor.Add(ChartForwardHorizonDays * 24 * time.Hour)
	if last.Timestamp.After(maxHorizon) {
		t.Fatalf("last forward point beyond horizon: %v", last.Timestamp)
	}
	for _, p := range out {
		if p.Close <= 0 {
			t.Fatalf("invalid projected price %v", p.Close)
		}
	}
}

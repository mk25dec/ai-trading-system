package services

import (
	"math"
	"testing"

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

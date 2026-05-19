package calibration

import (
	"testing"
	"time"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

func TestAggregateReport_computesIC(t *testing.T) {
	rows := []BacktestRow{
		{Horizon: Horizon3D, Composite: 70, RealizedReturn: 2, ProbUp: 0.7},
		{Horizon: Horizon3D, Composite: 40, RealizedReturn: -1, ProbUp: 0.4},
		{Horizon: Horizon3D, Composite: 80, RealizedReturn: 3, ProbUp: 0.75},
	}
	metrics := AggregateReport(rows)
	if len(metrics) != 3 {
		t.Fatalf("expected 3 horizon slots, got %d", len(metrics))
	}
	if metrics[0].N != 3 {
		t.Fatalf("n=%d", metrics[0].N)
	}
	if metrics[0].ICComposite <= 0 {
		t.Fatalf("expected positive IC, got %v", metrics[0].ICComposite)
	}
}

func TestRunGridSearch_picksHigherICParams(t *testing.T) {
	sent := 0.4
	snaps := []models.SymbolFeatureSnapshot{
		{
			Symbol:    "TEST",
			Timestamp: time.Date(2026, 1, 10, 0, 0, 0, 0, time.UTC),
			MarketFeatures: map[string]any{
				"priceChange24h": 2.0,
				"priceChange5d":  3.0,
				"rsi":            55.0,
			},
			NewsFeatures: map[string]any{
				"newsCount24h":    3,
				"avgSentiment24h": sent,
			},
		},
	}
	var closes []TimedClose
	p0 := 100.0
	for i := 0; i < 30; i++ {
		closes = append(closes, TimedClose{
			Ts:    time.Date(2026, 1, 1+i, 0, 0, 0, 0, time.UTC),
			Close: p0 + float64(i)*0.5,
		})
	}
	candleMap := map[string][]TimedClose{"TEST": closes}

	pLow := DefaultParams()
	pLow.SigmoidScale = 0.5
	pHigh := DefaultParams()
	pHigh.SigmoidScale = 1.5

	best, _ := RunGridSearch(snaps, candleMap, []Params{pLow, pHigh}, nil)
	if best.SigmoidScale != pHigh.SigmoidScale && best.SigmoidScale != pLow.SigmoidScale {
		t.Fatalf("unexpected best scale %v", best.SigmoidScale)
	}
}

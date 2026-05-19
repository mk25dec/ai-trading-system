package calibration

import (
	"testing"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

func TestParseSnapshotFeatures_roundTrip(t *testing.T) {
	sent := 0.35
	snap := models.SymbolFeatureSnapshot{
		Symbol: "AAPL",
		MarketFeatures: map[string]any{
			"priceChange24h": 1.5,
			"rsi":            48.0,
		},
		NewsFeatures: map[string]any{
			"newsCount24h":    2,
			"avgSentiment24h": sent,
		},
	}
	mf, nf := ParseSnapshotFeatures(snap)
	if mf == nil || mf.PriceChange24h == nil {
		t.Fatal("expected market features")
	}
	if nf == nil || nf.AvgSentiment24h == nil {
		t.Fatal("expected news features")
	}
	d := ReplayDecision("AAPL", mf, nf, DefaultParams())
	if d.CompositeScore <= 0 && d.Confidence <= 0.2 {
		t.Fatalf("expected scorable decision, got composite=%v", d.CompositeScore)
	}
}

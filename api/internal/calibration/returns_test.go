package calibration

import (
	"math"
	"testing"
)

func TestForwardReturnPct_3TradingDays(t *testing.T) {
	closes := []float64{100, 101, 102, 103, 104}
	got, ok := ForwardReturnPct(closes, 0, Horizon3D)
	if !ok {
		t.Fatal("expected ok")
	}
	want := 3.0 // (103-100)/100 * 100
	if math.Abs(got-want) > 0.01 {
		t.Fatalf("got %v want %v", got, want)
	}
}

func TestForwardReturnPct_insufficientBars(t *testing.T) {
	closes := []float64{100, 101}
	_, ok := ForwardReturnPct(closes, 0, Horizon1M)
	if ok {
		t.Fatal("expected not ok")
	}
}

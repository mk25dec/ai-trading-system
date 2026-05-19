package calibration

import "testing"

func TestPearsonIC_PerfectPositive(t *testing.T) {
	xs := []float64{1, 2, 3, 4, 5}
	ys := []float64{2, 4, 6, 8, 10}
	ic := PearsonIC(xs, ys)
	if ic < 0.99 {
		t.Fatalf("ic=%v", ic)
	}
}

func TestBrierScore_Perfect(t *testing.T) {
	p := []float64{1, 0, 1, 0}
	y := []float64{1, 0, 1, 0}
	if BrierScore(p, y) > 0.001 {
		t.Fatal("expected ~0")
	}
}

func TestHitRate_Direction(t *testing.T) {
	pred := []float64{0.6, -0.2, 0.1}
	real := []float64{5.0, -1.0, -2.0}
	if HitRate(pred, real) != 2.0/3.0 {
		t.Fatal()
	}
}

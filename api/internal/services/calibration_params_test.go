package services

import "testing"

func TestCalibrationParams_normalized(t *testing.T) {
	p := CalibrationParams{
		CompositeSwing:    0.9,
		CompositeShort:    0.9,
		CompositePosition: 0.9,
	}
	p = p.normalized()
	sum := p.CompositeSwing + p.CompositeShort + p.CompositePosition
	if sum < 0.99 || sum > 1.01 {
		t.Fatalf("weights should sum to 1, got %v", sum)
	}
}

func TestLoadCalibrationParamsFromFile(t *testing.T) {
	SetCalibrationParams(DefaultCalibrationParams())
}

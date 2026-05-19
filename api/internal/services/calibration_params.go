package services

import (
	"encoding/json"
	"math"
	"os"
	"sync"
)

// CalibrationParams holds tunable decision-engine constants (Sprint A).
type CalibrationParams struct {
	SigmoidScale          float64 `json:"sigmoid_scale"`
	CompositeSwing        float64 `json:"composite_swing"`
	CompositeShort        float64 `json:"composite_short"`
	CompositePosition     float64 `json:"composite_position"`
	HorizonFinbertBlend   float64 `json:"horizon_finbert_blend"`
	LogisticCenter        float64 `json:"logistic_center"`
	LogisticScale         float64 `json:"logistic_scale"`
	PUpsideFinbertWeight  float64 `json:"p_up_finbert_weight"`
}

// DefaultCalibrationParams matches pre-calibration engine behavior.
func DefaultCalibrationParams() CalibrationParams {
	return CalibrationParams{
		SigmoidScale:         1.15,
		CompositeSwing:       0.45,
		CompositeShort:       0.30,
		CompositePosition:    0.25,
		HorizonFinbertBlend:  0.65,
		LogisticCenter:       50,
		LogisticScale:        10,
		PUpsideFinbertWeight: 0,
	}
}

var (
	calibrationMu     sync.RWMutex
	calibrationParams = DefaultCalibrationParams()
)

// CalibrationParamsActive returns a copy of the active parameters.
func CalibrationParamsActive() CalibrationParams {
	calibrationMu.RLock()
	defer calibrationMu.RUnlock()
	return calibrationParams
}

// SetCalibrationParams replaces active tuning parameters.
func SetCalibrationParams(p CalibrationParams) {
	p = p.normalized()
	calibrationMu.Lock()
	calibrationParams = p
	calibrationMu.Unlock()
}

// LoadCalibrationParamsFromFile reads JSON calibration config (yaml can be converted externally).
func LoadCalibrationParamsFromFile(path string) error {
	if path == "" {
		return nil
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var p CalibrationParams
	if err := json.Unmarshal(b, &p); err != nil {
		return err
	}
	SetCalibrationParams(p)
	return nil
}

func (p CalibrationParams) normalized() CalibrationParams {
	d := DefaultCalibrationParams()
	if p.SigmoidScale <= 0 {
		p.SigmoidScale = d.SigmoidScale
	}
	if p.CompositeSwing <= 0 && p.CompositeShort <= 0 && p.CompositePosition <= 0 {
		p.CompositeSwing, p.CompositeShort, p.CompositePosition = d.CompositeSwing, d.CompositeShort, d.CompositePosition
	}
	sum := p.CompositeSwing + p.CompositeShort + p.CompositePosition
	if sum > 0 && math.Abs(sum-1) > 0.001 {
		p.CompositeSwing /= sum
		p.CompositeShort /= sum
		p.CompositePosition /= sum
	}
	if p.HorizonFinbertBlend <= 0 || p.HorizonFinbertBlend > 1 {
		p.HorizonFinbertBlend = d.HorizonFinbertBlend
	}
	if p.LogisticScale <= 0 {
		p.LogisticCenter = d.LogisticCenter
		p.LogisticScale = d.LogisticScale
	}
	return p
}

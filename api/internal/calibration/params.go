package calibration

import (
	"github.com/joeydekruis/ai-trading-system/api/internal/services"
)

// Params is an alias for services tuning struct used in backtests.
type Params = services.CalibrationParams

// DefaultParams returns baseline engine parameters.
func DefaultParams() Params {
	return services.DefaultCalibrationParams()
}

// ApplyParams sets active engine parameters for replay.
func ApplyParams(p Params) {
	services.SetCalibrationParams(p)
}

package calibration

// HorizonID labels forward-return and decision horizons.
type HorizonID string

const (
	Horizon3D HorizonID = "3D"
	Horizon1W HorizonID = "1W"
	Horizon1M HorizonID = "1M"
)

// AllHorizons is evaluation order for reports.
var AllHorizons = []HorizonID{Horizon3D, Horizon1W, Horizon1M}

// TradingDays returns the number of trading sessions for forward return.
func (h HorizonID) TradingDays() int {
	switch h {
	case Horizon3D:
		return 3
	case Horizon1W:
		return 5
	case Horizon1M:
		return 21
	default:
		return 5
	}
}

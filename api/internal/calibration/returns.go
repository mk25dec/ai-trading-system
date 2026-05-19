package calibration

import "time"

// ForwardReturnPct returns percent change from closes[startIdx] to closes[startIdx+h.TradingDays()].
// ok is false when there are not enough bars after startIdx.
func ForwardReturnPct(closes []float64, startIdx int, h HorizonID) (pct float64, ok bool) {
	days := h.TradingDays()
	endIdx := startIdx + days
	if startIdx < 0 || endIdx >= len(closes) || closes[startIdx] == 0 {
		return 0, false
	}
	pct = (closes[endIdx] - closes[startIdx]) / closes[startIdx] * 100
	return pct, true
}

// CloseIndexAtOrBefore returns the last index i where series[i].Ts <= t.
func CloseIndexAtOrBefore(series []TimedClose, t time.Time) int {
	best := -1
	for i, c := range series {
		if c.AtOrBefore(t) {
			best = i
		}
	}
	return best
}

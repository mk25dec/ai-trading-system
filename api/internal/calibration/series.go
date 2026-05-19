package calibration

import (
	"time"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

// TimedClose is a single daily close for backtests.
type TimedClose struct {
	Ts    time.Time
	Close float64
}

// AtOrBefore reports whether c.Ts is on or before t.
func (c TimedClose) AtOrBefore(t time.Time) bool {
	return !c.Ts.After(t)
}

// FromDailyCloses converts store rows to calibration series.
func FromDailyCloses(rows []models.DailyClose) []TimedClose {
	out := make([]TimedClose, len(rows))
	for i, r := range rows {
		out[i] = TimedClose{Ts: r.Timestamp, Close: r.Close}
	}
	return out
}

// Closes extracts close prices in order.
func Closes(series []TimedClose) []float64 {
	out := make([]float64, len(series))
	for i, c := range series {
		out[i] = c.Close
	}
	return out
}

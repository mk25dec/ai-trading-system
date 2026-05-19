package calibration

import (
	"context"
	"time"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

// SnapshotSource loads historical feature snapshots.
type SnapshotSource interface {
	ListFeatureSnapshots(ctx context.Context, since time.Time, symbols []string) ([]models.SymbolFeatureSnapshot, error)
}

// CandleSource loads daily closes for forward returns.
type CandleSource interface {
	DailyClosesAsc(ctx context.Context, symbol string, from, to time.Time) ([]models.DailyClose, error)
}

// BacktestOptions configures a calibration run.
type BacktestOptions struct {
	Since           time.Time
	Symbols         []string
	HoldoutSymbols  map[string]bool
	Params          Params
	ForwardBufferDays int
}

// BacktestRow is one scored snapshot aligned to a forward return.
type BacktestRow struct {
	Symbol         string
	SnapshotTS     time.Time
	Horizon        HorizonID
	Composite      float64
	FinbertScore   float64
	FinbertConf    float64
	ProbUp         float64
	RealizedReturn float64
}

// HorizonMetrics summarizes backtest quality for one horizon.
type HorizonMetrics struct {
	Horizon     HorizonID
	N           int
	ICComposite float64
	ICFinbert   float64
	HitRate     float64
	Brier       float64
}

// Report is the full backtest output.
type Report struct {
	ByHorizon []HorizonMetrics
	Rows      []BacktestRow
}

// RunBacktest replays decisions on snapshots and joins forward returns from daily candles.
func RunBacktest(ctx context.Context, snaps SnapshotSource, candles CandleSource, opts BacktestOptions) (Report, error) {
	if opts.ForwardBufferDays <= 0 {
		opts.ForwardBufferDays = 35
	}
	snapshots, err := snaps.ListFeatureSnapshots(ctx, opts.Since, opts.Symbols)
	if err != nil {
		return Report{}, err
	}

	cache := map[string][]TimedClose{}
	var rows []BacktestRow

	for _, snap := range snapshots {
		series, ok := cache[snap.Symbol]
		if !ok {
			from := snap.Timestamp.AddDate(0, 0, -5)
			to := snap.Timestamp.AddDate(0, 0, opts.ForwardBufferDays)
			raw, err := candles.DailyClosesAsc(ctx, snap.Symbol, from, to)
			if err != nil {
				return Report{}, err
			}
			series = FromDailyCloses(raw)
			cache[snap.Symbol] = series
		}
		if len(series) == 0 {
			continue
		}
		closes := Closes(series)
		idx := CloseIndexAtOrBefore(series, snap.Timestamp)
		if idx < 0 {
			continue
		}

		mf, nf := ParseSnapshotFeatures(snap)
		d := ReplayDecision(snap.Symbol, mf, nf, opts.Params)
		fv := FeatureVector(d, nf)

		for _, h := range AllHorizons {
			ret, ok := ForwardReturnPct(closes, idx, h)
			if !ok {
				continue
			}
			rows = append(rows, BacktestRow{
				Symbol:         snap.Symbol,
				SnapshotTS:     snap.Timestamp,
				Horizon:        h,
				Composite:      fv["composite"],
				FinbertScore:   fv["finbert_score"],
				FinbertConf:    fv["finbert_conf"],
				ProbUp:         fv["p_up_proxy"],
				RealizedReturn: ret,
			})
		}
	}

	return Report{ByHorizon: AggregateReport(rows), Rows: rows}, nil
}

// AggregateReport computes IC, hit rate, and Brier per horizon.
func AggregateReport(rows []BacktestRow) []HorizonMetrics {
	out := make([]HorizonMetrics, 0, len(AllHorizons))
	for _, h := range AllHorizons {
		var comp, real, prob []float64
		for _, r := range rows {
			if r.Horizon != h {
				continue
			}
			comp = append(comp, r.Composite)
			real = append(real, r.RealizedReturn)
			prob = append(prob, r.ProbUp)
		}
		n := len(real)
		m := HorizonMetrics{Horizon: h, N: n}
		if n == 0 {
			out = append(out, m)
			continue
		}
		m.ICComposite = PearsonIC(comp, real)
		var finScores, finReal []float64
		for _, r := range rows {
			if r.Horizon != h || r.FinbertConf <= 0 {
				continue
			}
			finScores = append(finScores, r.FinbertScore)
			finReal = append(finReal, r.RealizedReturn)
		}
		if len(finScores) >= 2 {
			m.ICFinbert = PearsonIC(finScores, finReal)
		}
		pred := make([]float64, n)
		for i := range comp {
			pred[i] = (comp[i] - 50) / 50
		}
		m.HitRate = HitRate(pred, real)
		m.Brier = BrierScore(prob, real)
		out = append(out, m)
	}
	return out
}

// MeanIC returns average composite IC across horizons with data.
func (r Report) MeanIC() float64 {
	var sum float64
	var n int
	for _, m := range r.ByHorizon {
		if m.N > 0 {
			sum += m.ICComposite
			n++
		}
	}
	if n == 0 {
		return 0
	}
	return sum / float64(n)
}

package calibration

import "github.com/joeydekruis/ai-trading-system/api/internal/models"

// BuildDefaultGrid returns a small search space for Sprint A.
func BuildDefaultGrid() []Params {
	base := DefaultParams()
	grid := []Params{base}
	for _, scale := range []float64{1.0, 1.15, 1.3} {
		for _, blend := range []float64{0.55, 0.65, 0.75} {
			p := base
			p.SigmoidScale = scale
			p.HorizonFinbertBlend = blend
			grid = append(grid, p)
		}
	}
	return grid
}

func filterRows(rows []BacktestRow, holdout map[string]bool, wantHoldout bool) []BacktestRow {
	if len(holdout) == 0 {
		return rows
	}
	out := make([]BacktestRow, 0, len(rows))
	for _, r := range rows {
		_, isHold := holdout[r.Symbol]
		if wantHoldout == isHold {
			out = append(out, r)
		}
	}
	return out
}

// RunGridSearch replays all snapshots for each param set and returns the best.
func RunGridSearch(snapshots []models.SymbolFeatureSnapshot, candleMap map[string][]TimedClose, grid []Params, holdout map[string]bool) (Params, Report) {
	if len(grid) == 0 {
		return DefaultParams(), Report{}
	}
	bestIdx := 0
	bestIC := -1e9
	var full Report
	for i, p := range grid {
		rows := replaySnapshots(snapshots, candleMap, p)
		train := filterRows(rows, holdout, false)
		rep := Report{ByHorizon: AggregateReport(train), Rows: train}
		ic := rep.MeanIC()
		if ic > bestIC {
			bestIC = ic
			bestIdx = i
			full = rep
		}
	}
	return grid[bestIdx], full
}

func replaySnapshots(snapshots []models.SymbolFeatureSnapshot, candleMap map[string][]TimedClose, p Params) []BacktestRow {
	var rows []BacktestRow
	for _, snap := range snapshots {
		series := candleMap[snap.Symbol]
		if len(series) == 0 {
			continue
		}
		closes := Closes(series)
		idx := CloseIndexAtOrBefore(series, snap.Timestamp)
		if idx < 0 {
			continue
		}
		mf, nf := ParseSnapshotFeatures(snap)
		d := ReplayDecision(snap.Symbol, mf, nf, p)
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
	return rows
}

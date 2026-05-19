# Sprint A: FinBERT & Decision Calibration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax. Parent roadmap: [2026-05-19-finbert-decision-engine-roadmap.md](./2026-05-19-finbert-decision-engine-roadmap.md).

**Goal:** Backtest decision/FinBERT features against realized forward returns at 3D / 1W / 1M horizons; tune parameters so scores and P(up) are **calibrated** (IC ↑, Brier ↓); commit winning params as `CalibrationParams`.

**Architecture:** New `api/internal/calibration/` package: (1) forward returns from `market_candles`, (2) point-in-time rows from `symbol_feature_snapshots`, (3) replay `ComputeDecision` per row, (4) metrics + grid search, (5) export YAML consumed by `decision_engine` and documented for `price-outlook.ts`. CLI: `api/cmd/calibrate/main.go`.

**Tech stack:** Go 1.22+, Postgres, `go test`, optional `pgx` queries in `store`; TypeScript sync for P(up) constants only after Go params are fixed.

---

## Acceptance criteria

- [ ] Forward returns computed for trading-day horizons: 3, 5, 21 days (labels 3D, 1W, 1M)
- [ ] Backtest uses only data available at snapshot `ts` (no look-ahead)
- [ ] Metrics reported: Pearson IC, directional hit rate, Brier score for P(up) vs realized sign
- [ ] At least one tunable parameter set improves IC vs baseline on hold-out symbols
- [ ] `config/calibration.yaml` (or embedded default) applied in `scoreFromSigmoid`, composite weights, horizon FinBERT blend
- [ ] `price-outlook.ts` logistic divisor matches calibrated `sigmoidScale`
- [ ] Runbook: `docs/runbooks/calibration-backtest.md`

## Definition of done

- [ ] `go test ./api/internal/calibration/...` passes
- [ ] `go test ./api/internal/services/...` passes (decision engine)
- [ ] Sample backtest output committed or pasted in runbook (sanitized, no secrets)
- [ ] `docs/features/` entry for calibration sprint
- [ ] `my-research.md` §1.2 notes calibrated constants and backtest date

## Out of scope (Sprint A)

- Full `FinalScore(T)` refactor (Sprint B)
- New FinBERT API fields or full-text pipeline (Sprint C)
- Projection uncertainty bands (Sprint D)
- Live auto-retrain cron (manual re-run only)

---

## File map

| File | Responsibility |
|------|----------------|
| `api/internal/calibration/horizons.go` | Horizon constants, trading-day → calendar helper |
| `api/internal/calibration/returns.go` | Forward return from candle series |
| `api/internal/calibration/metrics.go` | IC, Brier, hit rate |
| `api/internal/calibration/params.go` | `CalibrationParams` struct + YAML load |
| `api/internal/calibration/replay.go` | Snapshot → `ComputeDecision` + feature vectors |
| `api/internal/calibration/backtest.go` | Join snapshots, returns, aggregate metrics |
| `api/internal/calibration/optimize.go` | Small grid search over params |
| `api/internal/calibration/*_test.go` | Unit tests with fixture candles |
| `api/internal/store/calibration.go` | `ListSnapshots(since, symbols)`, candle range queries |
| `api/cmd/calibrate/main.go` | CLI: `-since`, `-symbols`, `-out`, `-optimize` |
| `config/calibration.yaml` | Winning parameters (checked in) |
| `api/internal/services/decision_math.go` | Read `params.SigmoidScale` |
| `api/internal/services/decision_engine.go` | Read composite / horizon blend from params |
| `web/src/lib/calibration.ts` | Mirror P(up) constants from YAML (generated or hand-sync) |
| `web/src/lib/price-outlook.ts` | Import calibration constants |
| `docs/runbooks/calibration-backtest.md` | Operator guide |

---

### Task 1: Horizon and forward-return primitives

**Files:**
- Create: `api/internal/calibration/horizons.go`
- Create: `api/internal/calibration/returns.go`
- Create: `api/internal/calibration/returns_test.go`

- [ ] **Step 1: Write failing test for 3D forward return**

```go
// returns_test.go
func TestForwardReturnPct_3TradingDays(t *testing.T) {
	closes := []float64{100, 101, 102, 103, 104} // 4 steps from idx 0
	got, ok := ForwardReturnPct(closes, 0, Horizon3D)
	if !ok || math.Abs(got-4.0) > 0.01 { // (104-100)/100 * 100
		t.Fatalf("got %v ok=%v", got, ok)
	}
}
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd api && go test ./internal/calibration/... -run TestForwardReturnPct -v`  
Expected: package not found or undefined `ForwardReturnPct`

- [ ] **Step 3: Implement horizons and returns**

```go
// horizons.go
package calibration

type HorizonID string

const (
	Horizon3D HorizonID = "3D"
	Horizon1W HorizonID = "1W"
	Horizon1M HorizonID = "1M"
)

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
```

```go
// returns.go — ForwardReturnPct(closes, startIdx, h) → (pct, ok)
// ok false if not enough bars after startIdx
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit** (when user requests): `feat(calibration): add forward return helpers`

---

### Task 2: Metric functions (IC, Brier, hit rate)

**Files:**
- Create: `api/internal/calibration/metrics.go`
- Create: `api/internal/calibration/metrics_test.go`

- [ ] **Step 1: Write failing tests**

```go
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
	real := []float64{5.0, -1.0, -2.0} // % returns
	if HitRate(pred, real) != 2.0/3.0 {
		t.Fatal()
	}
}
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `PearsonIC`, `BrierScore`, `HitRate`**

Handle `len < 2` → IC = 0; clamp probabilities to (0.001, 0.999) for Brier.

- [ ] **Step 4: Run — expect PASS**

---

### Task 3: CalibrationParams struct and YAML

**Files:**
- Create: `api/internal/calibration/params.go`
- Create: `config/calibration.yaml`
- Create: `api/internal/calibration/params_test.go`

- [ ] **Step 1: Define struct matching tunables today**

```go
type CalibrationParams struct {
	SigmoidScale       float64 `yaml:"sigmoid_scale"`        // default 1.15 → decision_math scoreFromSigmoid
	CompositeSwing     float64 `yaml:"composite_swing"`      // default 0.45
	CompositeShort     float64 `yaml:"composite_short"`      // default 0.30
	CompositePosition  float64 `yaml:"composite_position"`   // default 0.25
	HorizonFinbertBlend float64 `yaml:"horizon_finbert_blend"` // default 0.65 (finbert vs raw sentiment)
	LogisticCenter     float64 `yaml:"logistic_center"`      // default 50 — P(up) mapping
	LogisticScale      float64 `yaml:"logistic_scale"`       // default 10
	PUpsideFinbertWeight float64 `yaml:"p_up_finbert_weight"` // default 0 — Sprint A may raise to 0.15
}
func DefaultParams() CalibrationParams { ... }
func LoadParams(path string) (CalibrationParams, error) { ... }
```

- [ ] **Step 2: Seed `config/calibration.yaml` with defaults**

- [ ] **Step 3: Test round-trip load**

- [ ] **Step 4: Wire global accessor** (optional): `services.SetCalibrationParams(p)` called from `main` and `calibrate` cmd

---

### Task 4: Store queries for snapshots and candles

**Files:**
- Create: `api/internal/store/calibration.go`
- Modify: `api/internal/store/pipeline.go` only if shared helpers needed

- [ ] **Step 1: `ListFeatureSnapshots(ctx, since time.Time, symbols []string) ([]models.SymbolFeatureSnapshot, error)`**

Query:

```sql
SELECT symbol, ts, market_features, news_features, combined_score, data_quality_score
FROM symbol_feature_snapshots
WHERE ts >= $1 AND ($2::text[] IS NULL OR symbol = ANY($2))
ORDER BY symbol, ts ASC
```

- [ ] **Step 2: `DailyCloses(ctx, symbol string, from, to time.Time) ([]TimedClose, error)`**

From `market_candles` where `timeframe = '1Day'`.

- [ ] **Step 3: Integration test** (build tag `integration` or skip if no DB): document in runbook; unit tests use in-memory fixtures.

---

### Task 5: Replay engine at snapshot time

**Files:**
- Create: `api/internal/calibration/replay.go`
- Create: `api/internal/calibration/replay_test.go`

- [ ] **Step 1: Parse snapshot JSON into `*models.MarketFeatures`, `*models.NewsFeatures`**

Reuse existing model structs from `symbol_feature_snapshots` JSON shape in `features.go`.

- [ ] **Step 2: `ReplayDecision(mf, nf, params) models.DecisionView`**

Call `services.ComputeDecision` after `services.SetCalibrationParams(params)` (Task 3).

- [ ] **Step 3: `FeatureVector(decision, nf) map[string]float64`**

Keys for backtest columns: `composite`, `finbert_score`, `finbert_conf`, `horizon_3d`, `horizon_1w`, `horizon_1m`, `p_up_proxy` (from same logistic as TS).

- [ ] **Step 4: Unit test** with fixture JSON from one snapshot file in `api/internal/calibration/testdata/snapshot.json`

---

### Task 6: Backtest loop

**Files:**
- Create: `api/internal/calibration/backtest.go`
- Create: `api/internal/calibration/backtest_test.go`

- [ ] **Step 1: `BacktestRow` struct:** symbol, ts, horizon, predicted score, probUp, realizedReturnPct

- [ ] **Step 2: `RunBacktest(ctx, store, params, opts) (Report, error)`**

For each snapshot:
1. Load candle closes through `ts + 30d`
2. Compute forward returns at 3/5/21 trading days
3. Replay decision
4. Append row

- [ ] **Step 3: `AggregateReport(rows) Report`**

Per horizon: IC(composite, return), IC(finbert_score, return), hit rate, Brier(probUp, return>0).

- [ ] **Step 4: Test with synthetic 20 snapshots** in `backtest_test.go` (no DB)

---

### Task 7: Wire params into decision engine

**Files:**
- Modify: `api/internal/services/decision_math.go`
- Modify: `api/internal/services/decision_engine.go`
- Modify: `api/cmd/server/main.go`
- Modify: `api/internal/services/decision_engine_test.go`

- [ ] **Step 1: `var calParams atomic.Value` or package var with `DefaultParams()`**

- [ ] **Step 2: `scoreFromSigmoid(raw)` uses `calParams.SigmoidScale` instead of hard-coded `1.15`**

- [ ] **Step 3: Composite blend uses three weights from params (normalize if sum ≠ 1)**

- [ ] **Step 4: `scoreHorizon` finbert blend uses `HorizonFinbertBlend`**

- [ ] **Step 5: Update tests that assert exact scores if they break — prefer testing monotonicity/outlook buckets**

Run: `cd api && go test ./internal/services/... -count=1`

---

### Task 8: Grid search optimizer

**Files:**
- Create: `api/internal/calibration/optimize.go`

- [ ] **Step 1: `GridSearch(rows []BacktestRow, grid []CalibrationParams) (best CalibrationParams, Report)`**

Small grid example:
- `sigmoid_scale`: {1.0, 1.15, 1.3}
- `horizon_finbert_blend`: {0.55, 0.65, 0.75}
- `logistic_scale`: {8, 10, 12}

Objective: maximize mean IC across horizons on **train** symbols; validate on hold-out.

- [ ] **Step 2: Hold-out split**

`opts.HoldoutSymbols` default `[]string{"AAPL","MSFT"}` or 20% of universe.

- [ ] **Step 3: Test optimizer picks higher IC on synthetic data**

---

### Task 9: CLI `calibrate`

**Files:**
- Create: `api/cmd/calibrate/main.go`

- [ ] **Step 1: Flags**

```
-since 30d
-symbols comma-separated (optional)
-config config/calibration.yaml
-out reports/calibration-YYYY-MM-DD.json
-optimize=false
```

- [ ] **Step 2: Load config, connect DB from env (same as server), run backtest**

- [ ] **Step 3: If `-optimize`, write best params back to `-config` path (or stdout for review)**

- [ ] **Step 4: Print human summary table to stderr**

Example:
```
horizon  n    IC_comp  IC_finbert  hit%   brier
3D       412  0.08     0.12        54.2   0.24
1W       412  0.11     0.14        55.1   0.23
1M       398  0.06     0.09        52.8   0.25
```

---

### Task 10: Sync TypeScript P(up) calibration

**Files:**
- Create: `web/src/lib/calibration.ts`
- Modify: `web/src/lib/price-outlook.ts`

- [ ] **Step 1: Export constants from `calibration.ts`**

```ts
export const CALIBRATION = {
  logisticCenter: 50,
  logisticScale: 10,
  pUpFinbertWeight: 0, // set after Sprint A run
} as const
```

- [ ] **Step 2: `compositeToProbability` uses `CALIBRATION.logisticCenter` and `.logisticScale`**

- [ ] **Step 3: Add comment: "Keep in sync with config/calibration.yaml"**

- [ ] **Step 4: Optional script `scripts/sync-calibration.ts`** — parse YAML → generate TS (YAGNI: hand-sync OK for v1)

---

### Task 11: Documentation and feature doc

**Files:**
- Create: `docs/runbooks/calibration-backtest.md`
- Create: `docs/features/004-calibration-backtest.md`
- Modify: `my-research.md` (§1.2 add "Calibrated constants" subsection)
- Modify: `README.md` (one line: calibration command)

- [ ] **Step 1: Runbook** — prerequisites (snapshots ≥30d, FinBERT backlog cleared), commands, how to interpret IC/Brier, when to re-run

- [ ] **Step 2: Feature doc** — what was built, limits (not price certainty), link to roadmap

- [ ] **Step 3: Update research doc** with pointer to `config/calibration.yaml`

---

## Verification commands (Sprint A complete)

```bash
cd api && go test ./internal/calibration/... ./internal/services/... -count=1
cd api && go run ./cmd/calibrate/ -since 720h -config ../config/calibration.yaml
cd web && npm test -- --run src/lib/price-outlook 2>/dev/null || npm run build
```

Record last run date and hold-out IC in runbook.

---

## After Sprint A

1. Mark Sprint A items done in [roadmap](./2026-05-19-finbert-decision-engine-roadmap.md).
2. Create `docs/plans/2026-05-19-sprint-b-signal-richness.md` using roadmap § Sprint B table.
3. Re-run calibration after Sprint C (richer text) to refresh `config/calibration.yaml`.

---

## Self-review (plan quality)

| Check | Status |
|-------|--------|
| Spec coverage for Sprint A acceptance criteria | All items map to Tasks 1–11 |
| Placeholders (TBD) | None |
| Type/name consistency | `CalibrationParams` used in Go + YAML + TS |
| Scope | Sprint A only; B/C/D deferred to roadmap |

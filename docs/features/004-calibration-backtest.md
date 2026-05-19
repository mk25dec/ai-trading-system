# Feature: Calibration backtest (Sprint A)

## Summary

Backtest harness that replays `ComputeDecision` on historical `symbol_feature_snapshots`, joins forward returns from daily candles (3D / 1W / 1M trading days), and reports IC, hit rate, and Brier score. Tunable parameters are stored in `config/calibration.json` and loaded by the API and web P(up) mapping.

## Components

| Area | Location |
|------|----------|
| Calibration package | `api/internal/calibration/` |
| Params + engine wiring | `api/internal/services/calibration_params.go`, `decision_math.go`, `decision_engine.go` |
| Store queries | `api/internal/store/calibration.go` |
| CLI | `api/cmd/calibrate/` |
| Config | `config/calibration.json` |
| Web P(up) constants | `web/src/lib/calibration.ts` |
| Runbook | `docs/runbooks/calibration-backtest.md` |

## Limits

- Does not guarantee price accuracy; metrics measure historical fit only.
- Sparse snapshots yield low `n` and unstable IC.
- Grid search is small (sigmoid + FinBERT blend); expand in later sprints.

## Related

- Roadmap: `docs/plans/2026-05-19-finbert-decision-engine-roadmap.md`
- Research formulas: `my-research.md` §1.2

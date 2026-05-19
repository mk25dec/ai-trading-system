# Feature: FinBERT pipeline depth (Sprint C)

## Summary

Richer FinBERT inputs and faster batch scoring before aggregation.

## Changes

| Item | Detail |
|------|--------|
| Text modes | `TextForFinBERT` → title_only / full_text / excerpt |
| Relevance | Weighted rollup in `finbert_aggregate.go` |
| Batch endpoint | `finbert-api` `POST /analyze/batch` |
| Go client | `FinbertClient.AnalyzeBatch` |
| Pipeline | `RunSentimentBatch` uses batch for 2+ pending rows |

## Runbook

`docs/runbooks/finbert-ingest.md`

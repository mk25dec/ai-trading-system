-- Walk-forward formula projection (see services/price_projection.go), one value per daily bar.
ALTER TABLE market_candles
    ADD COLUMN IF NOT EXISTS predicted_price1 NUMERIC(18, 6);

CREATE INDEX IF NOT EXISTS idx_market_candles_symbol_tf_ts_pred
    ON market_candles (symbol, timeframe, ts)
    WHERE predicted_price1 IS NOT NULL;

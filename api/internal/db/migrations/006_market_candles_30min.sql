-- Allow 30Min bars used by the price chart page.
ALTER TABLE market_candles DROP CONSTRAINT IF EXISTS market_candles_timeframe_check;
ALTER TABLE market_candles ADD CONSTRAINT market_candles_timeframe_check
    CHECK (timeframe IN ('1Min', '5Min', '15Min', '30Min', '1Hour', '1Day'));

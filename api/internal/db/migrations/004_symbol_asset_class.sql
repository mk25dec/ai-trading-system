-- Asset class for grouping (equity, etf, crypto, other)
ALTER TABLE symbols ADD COLUMN IF NOT EXISTS asset_class TEXT NOT NULL DEFAULT 'equity';

CREATE INDEX IF NOT EXISTS idx_symbols_asset_class ON symbols(asset_class);

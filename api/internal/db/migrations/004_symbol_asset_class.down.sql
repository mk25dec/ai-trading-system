DROP INDEX IF EXISTS idx_symbols_asset_class;
ALTER TABLE symbols DROP COLUMN IF EXISTS asset_class;

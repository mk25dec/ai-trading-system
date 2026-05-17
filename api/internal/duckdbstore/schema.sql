CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS symbols (
    id VARCHAR PRIMARY KEY,
    ticker VARCHAR NOT NULL UNIQUE,
    name VARCHAR NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS decision_logs (
    id VARCHAR PRIMARY KEY,
    workspace_id VARCHAR NOT NULL,
    symbol_id VARCHAR,
    action VARCHAR NOT NULL,
    reason VARCHAR NOT NULL DEFAULT '',
    metadata JSON,
    created_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

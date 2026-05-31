package models

// SECSymbolEntry is one row from SEC company_tickers.json.
type SECSymbolEntry struct {
	Symbol string
	Name   string
	CIK    int64
}

// SECSymbolSyncResult is returned after syncing SEC tickers into symbols.
type SECSymbolSyncResult struct {
	Fetched  int `json:"fetched"`
	Upserted int `json:"upserted"`
}

package models

import "time"

type ResearchHeadline struct {
	Title          string     `json:"title"`
	URL            string     `json:"url"`
	PublishedAt    *time.Time `json:"publishedAt,omitempty"`
	SentimentLabel string     `json:"sentimentLabel,omitempty"`
	SentimentScore float64    `json:"sentimentScore,omitempty"`
}

type ResearchStockRow struct {
	Symbol         string            `json:"symbol"`
	Name           string            `json:"name"`
	Exchange       *string           `json:"exchange,omitempty"`
	AssetClass     string            `json:"assetClass,omitempty"`
	DayHigh        *float64          `json:"dayHigh,omitempty"`
	DayLow         *float64          `json:"dayLow,omitempty"`
	DataStatus     string            `json:"dataStatus,omitempty"` // "ready" | "no_market_data"
	Recommendation string            `json:"recommendation"`
	Confidence     float64           `json:"confidence"`
	Score          float64           `json:"score"`
	Decision       *DecisionView     `json:"decision,omitempty"`
	Bullets        []string          `json:"bullets"`
	LastClose      *float64          `json:"lastClose,omitempty"`
	Market         *MarketFeatures   `json:"market,omitempty"`
	News           *NewsFeatures     `json:"news,omitempty"`
	Candles        []MarketCandle    `json:"candles"`
	Headlines      []ResearchHeadline `json:"headlines"`
	Signal         *WorkspaceSignal  `json:"signal,omitempty"`
	UpdatedAt      *time.Time        `json:"updatedAt,omitempty"`
}

type ResearchDiagnostics struct {
	AlpacaConfigured          bool     `json:"alpacaConfigured"`
	AlpacaFeed                string   `json:"alpacaFeed,omitempty"`
	SymbolsWithCandles        int      `json:"symbolsWithCandles"`
	SymbolsWithMarketFeatures int      `json:"symbolsWithMarketFeatures"`
	InvalidSymbols            []string `json:"invalidSymbols,omitempty"`
	Hint                      string   `json:"hint,omitempty"`
}

type ResearchBoard struct {
	WorkspaceID   string              `json:"workspaceId"`
	WorkspaceName string              `json:"workspaceName"`
	Symbols       []string            `json:"symbols"`
	Rows          []ResearchStockRow  `json:"rows"`
	RefreshedAt   *time.Time          `json:"refreshedAt,omitempty"`
	Diagnostics   ResearchDiagnostics `json:"diagnostics"`
}

// PriceChartPoint is one daily bar with optional walk-forward formula projection.
type PriceChartPoint struct {
	Timestamp       time.Time `json:"timestamp"`
	Close           float64   `json:"close"`
	PredictedPrice1 *float64  `json:"predictedPrice1,omitempty"`
}

type PriceChartSeries struct {
	Symbol    string            `json:"symbol"`
	Timeframe string            `json:"timeframe"`
	Points    []PriceChartPoint `json:"points"`
}

type PriceChartSyncResult struct {
	CandlesFetched       int      `json:"candlesFetched"`
	PredictionsUpdated   int      `json:"predictionsUpdated"`
	SymbolsProcessed     int      `json:"symbolsProcessed"`
	Errors               []string `json:"errors,omitempty"`
}

type ResearchRefreshResult struct {
	SymbolsProcessed int      `json:"symbolsProcessed"`
	CandlesFetched   int      `json:"candlesFetched"`
	CandlesInserted  int      `json:"candlesInserted"`
	SentimentRuns    int      `json:"sentimentProcessed"`
	SignalsGenerated int      `json:"signalsGenerated"`
	Errors           []string `json:"errors,omitempty"`
}

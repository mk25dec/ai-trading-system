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
	Recommendation string            `json:"recommendation"`
	Confidence     float64           `json:"confidence"`
	Score          float64           `json:"score"`
	Bullets        []string          `json:"bullets"`
	LastClose      *float64          `json:"lastClose,omitempty"`
	Market         *MarketFeatures   `json:"market,omitempty"`
	News           *NewsFeatures     `json:"news,omitempty"`
	Candles        []MarketCandle    `json:"candles"`
	Headlines      []ResearchHeadline `json:"headlines"`
	Signal         *WorkspaceSignal  `json:"signal,omitempty"`
	UpdatedAt      *time.Time        `json:"updatedAt,omitempty"`
}

type ResearchBoard struct {
	WorkspaceID   string             `json:"workspaceId"`
	WorkspaceName string             `json:"workspaceName"`
	Symbols       []string           `json:"symbols"`
	Rows          []ResearchStockRow `json:"rows"`
	RefreshedAt   *time.Time         `json:"refreshedAt,omitempty"`
}

type ResearchRefreshResult struct {
	SymbolsProcessed int            `json:"symbolsProcessed"`
	CandlesInserted  int            `json:"candlesInserted"`
	SentimentRuns    int            `json:"sentimentProcessed"`
	SignalsGenerated int            `json:"signalsGenerated"`
	Errors           []string         `json:"errors,omitempty"`
}

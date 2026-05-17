package models

import "time"

type BacklogStatus string

const (
	BacklogNew        BacklogStatus = "new"
	BacklogFetched    BacklogStatus = "fetched"
	BacklogDuplicate  BacklogStatus = "duplicate"
	BacklogFailed     BacklogStatus = "failed"
	BacklogProcessed  BacklogStatus = "processed"
)

type WorkflowRunStatus string

const (
	RunRunning WorkflowRunStatus = "running"
	RunSuccess WorkflowRunStatus = "success"
	RunFailed  WorkflowRunStatus = "failed"
	RunPartial WorkflowRunStatus = "partial"
)

type NewsBacklogItem struct {
	ID             string         `json:"id"`
	Source         string         `json:"source"`
	URL            string         `json:"url"`
	CanonicalURL   string         `json:"canonicalUrl"`
	Title          string         `json:"title"`
	PublishedAt    *time.Time     `json:"publishedAt,omitempty"`
	DiscoveredAt   time.Time      `json:"discoveredAt"`
	RawSymbolGuess []string       `json:"rawSymbolGuess"`
	Status         BacklogStatus  `json:"status"`
	ErrorMessage   *string        `json:"errorMessage,omitempty"`
	Metadata       map[string]any `json:"metadata"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
}

type NewsArticle struct {
	ID           string         `json:"id"`
	BacklogID    *string        `json:"backlogId,omitempty"`
	Source       string         `json:"source"`
	URL          string         `json:"url"`
	CanonicalURL string         `json:"canonicalUrl"`
	Title        string         `json:"title"`
	PublishedAt  *time.Time     `json:"publishedAt,omitempty"`
	DiscoveredAt time.Time      `json:"discoveredAt"`
	FetchedAt    time.Time      `json:"fetchedAt"`
	RawText      *string        `json:"rawText,omitempty"`
	CleanedText  string         `json:"cleanedText"`
	Language     string         `json:"language"`
	TextHash     string         `json:"textHash"`
	Metadata     map[string]any `json:"metadata"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
}

type ArticleSymbol struct {
	ArticleID        string    `json:"articleId"`
	Symbol           string    `json:"symbol"`
	RelevanceScore   float64   `json:"relevanceScore"`
	DetectionMethod  string    `json:"detectionMethod"`
	Confidence       float64   `json:"confidence"`
	CreatedAt        time.Time `json:"createdAt"`
}

type ArticleSentiment struct {
	ArticleID      string    `json:"articleId"`
	Symbol         string    `json:"symbol"`
	SentimentLabel string    `json:"sentimentLabel"`
	SentimentScore float64   `json:"sentimentScore"`
	Confidence     float64   `json:"confidence"`
	ModelName      string    `json:"modelName"`
	ModelVersion   *string   `json:"modelVersion,omitempty"`
	InputMode      string    `json:"inputMode"`
	CreatedAt      time.Time `json:"createdAt"`
}

type SymbolRow struct {
	Symbol    string         `json:"symbol"`
	Name      string         `json:"name"`
	Exchange  *string        `json:"exchange,omitempty"`
	Sector    *string        `json:"sector,omitempty"`
	Industry  *string        `json:"industry,omitempty"`
	IsActive  bool           `json:"isActive"`
	Metadata  map[string]any `json:"metadata"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

type MarketCandle struct {
	Symbol    string    `json:"symbol"`
	Timeframe string    `json:"timeframe"`
	Timestamp time.Time `json:"timestamp"`
	Open      float64   `json:"open"`
	High      float64   `json:"high"`
	Low       float64   `json:"low"`
	Close     float64   `json:"close"`
	Volume    int64     `json:"volume"`
	Source    string    `json:"source"`
	CreatedAt time.Time `json:"createdAt"`
}

type MarketFeatures struct {
	Symbol          string     `json:"symbol"`
	Timestamp       time.Time  `json:"timestamp"`
	Timeframe       string     `json:"timeframe"`
	PriceChange1h   *float64   `json:"priceChange1h,omitempty"`
	PriceChange24h  *float64   `json:"priceChange24h,omitempty"`
	PriceChange5d   *float64   `json:"priceChange5d,omitempty"`
	VolumeRatio     *float64   `json:"volumeRatio,omitempty"`
	Volatility      *float64   `json:"volatility,omitempty"`
	RSI             *float64   `json:"rsi,omitempty"`
	SMA20           *float64   `json:"sma20,omitempty"`
	SMA50           *float64   `json:"sma50,omitempty"`
	DistanceSMA20   *float64   `json:"distanceSma20,omitempty"`
	DistanceSMA50   *float64   `json:"distanceSma50,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
}

type NewsFeatures struct {
	Symbol               string    `json:"symbol"`
	Timestamp            time.Time `json:"timestamp"`
	NewsCount1h          int       `json:"newsCount1h"`
	NewsCount4h          int       `json:"newsCount4h"`
	NewsCount24h         int       `json:"newsCount24h"`
	AvgSentiment1h       *float64  `json:"avgSentiment1h,omitempty"`
	AvgSentiment4h       *float64  `json:"avgSentiment4h,omitempty"`
	AvgSentiment24h      *float64  `json:"avgSentiment24h,omitempty"`
	SentimentMomentum    *float64  `json:"sentimentMomentum,omitempty"`
	NegativeNewsSpike    bool      `json:"negativeNewsSpike"`
	PositiveNewsSpike    bool      `json:"positiveNewsSpike"`
	MaxRelevanceScore24h *float64  `json:"maxRelevanceScore24h,omitempty"`
	CreatedAt            time.Time `json:"createdAt"`
}

type SymbolFeatureSnapshot struct {
	Symbol             string         `json:"symbol"`
	Timestamp          time.Time      `json:"timestamp"`
	MarketFeatures     map[string]any `json:"marketFeatures"`
	NewsFeatures       map[string]any `json:"newsFeatures"`
	CombinedScore      *float64       `json:"combinedScore,omitempty"`
	DataQualityScore   float64        `json:"dataQualityScore"`
	MissingFields      []string       `json:"missingFields"`
	CreatedAt          time.Time      `json:"createdAt"`
}

type WorkflowRun struct {
	ID             string            `json:"id"`
	WorkflowName   string            `json:"workflowName"`
	RunID          *string           `json:"runId,omitempty"`
	Status         WorkflowRunStatus   `json:"status"`
	StartedAt      time.Time         `json:"startedAt"`
	EndedAt        *time.Time        `json:"endedAt,omitempty"`
	DurationMs     *int              `json:"durationMs,omitempty"`
	ItemsProcessed int               `json:"itemsProcessed"`
	ErrorMessage   *string           `json:"errorMessage,omitempty"`
	Metadata       map[string]any    `json:"metadata"`
}

type WorkspaceWatchlistEntry struct {
	WorkspaceID string    `json:"workspaceId"`
	Symbol      string    `json:"symbol"`
	IsActive    bool      `json:"isActive"`
	CreatedAt   time.Time `json:"createdAt"`
}

type WorkspaceStrategySetting struct {
	WorkspaceID  string         `json:"workspaceId"`
	StrategyName string         `json:"strategyName"`
	Settings     map[string]any `json:"settings"`
	IsActive     bool           `json:"isActive"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
}

type WorkspaceSignal struct {
	ID                      string         `json:"id"`
	WorkspaceID             string         `json:"workspaceId"`
	Symbol                  string         `json:"symbol"`
	Timestamp               time.Time      `json:"timestamp"`
	Action                  string         `json:"action"`
	Direction               string         `json:"direction"`
	Score                   float64        `json:"score"`
	Confidence              float64        `json:"confidence"`
	Reasons                 []any          `json:"reasons"`
	SourceSnapshotTimestamp *time.Time     `json:"sourceSnapshotTimestamp,omitempty"`
	ExpiresAt               *time.Time     `json:"expiresAt,omitempty"`
	Status                  string         `json:"status"`
	CreatedAt               time.Time      `json:"createdAt"`
}

type ArticleWithDetails struct {
	NewsArticle
	Symbols   []ArticleSymbol   `json:"symbols,omitempty"`
	Sentiment []ArticleSentiment `json:"sentiment,omitempty"`
}

package models

// DecisionView is the trader-facing summary from the multi-horizon decision engine.
type DecisionView struct {
	PrimaryAction    string          `json:"primaryAction"`
	PrimaryOutlook   string          `json:"primaryOutlook"`
	CompositeScore   float64         `json:"compositeScore"`
	Confidence       float64         `json:"confidence"`
	RiskLevel        string          `json:"riskLevel"`
	Alignment        string          `json:"alignment"`
	Conflict         bool            `json:"conflict"`
	ConflictNote     string          `json:"conflictNote,omitempty"`
	NewsStance       string          `json:"newsStance"`
	NewsConfidence   *float64        `json:"newsConfidence,omitempty"`
	PriceTrend       string          `json:"priceTrend"`
	Drivers          []string        `json:"drivers"`
	Horizons         []HorizonOutlook `json:"horizons"`
	Categories       []CategoryScore  `json:"categories,omitempty"`
}

type HorizonOutlook struct {
	ID         string  `json:"id"`
	Label      string  `json:"label"`
	Score      float64 `json:"score"`
	Outlook    string  `json:"outlook"`
	Confidence float64 `json:"confidence"`
}

type CategoryScore struct {
	ID         string  `json:"id"`
	Label      string  `json:"label"`
	Score      float64 `json:"score"`
	Confidence float64 `json:"confidence"`
	Weight     float64 `json:"weight"`
}

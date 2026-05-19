package models

import "time"

// SymbolMarketDetail is watchlist symbol + latest Alpaca-derived market fields.
type SymbolMarketDetail struct {
	Symbol          string     `json:"symbol"`
	Name            string     `json:"name"`
	Exchange        *string    `json:"exchange,omitempty"`
	AssetClass      string     `json:"assetClass"`
	IsActive        bool       `json:"isActive"`
	LastClose       *float64   `json:"lastClose,omitempty"`
	PrevClose       *float64   `json:"prevClose,omitempty"`
	Open            *float64   `json:"open,omitempty"`
	High            *float64   `json:"high,omitempty"`
	Low             *float64   `json:"low,omitempty"`
	Volume          *int64     `json:"volume,omitempty"`
	High52w         *float64   `json:"high52w,omitempty"`
	Low52w          *float64   `json:"low52w,omitempty"`
	PriceChange24h  *float64   `json:"priceChange24h,omitempty"`
	PriceChange5d   *float64   `json:"priceChange5d,omitempty"`
	RSI             *float64   `json:"rsi,omitempty"`
	Volatility      *float64   `json:"volatility,omitempty"`
	VolumeRatio     *float64   `json:"volumeRatio,omitempty"`
	DistanceSma20   *float64   `json:"distanceSma20,omitempty"`
	SMA20           *float64   `json:"sma20,omitempty"`
	SMA50           *float64   `json:"sma50,omitempty"`
	LatestCandleAt  *time.Time `json:"latestCandleAt,omitempty"`
	DataFetchedAt   *time.Time `json:"dataFetchedAt,omitempty"`
}

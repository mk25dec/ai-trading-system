package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

type AlpacaClient struct {
	DataURL string
	Key     string
	Secret  string
	Client  *http.Client
}

type alpacaBar struct {
	T  string  `json:"t"`
	O  float64 `json:"o"`
	H  float64 `json:"h"`
	L  float64 `json:"l"`
	C  float64 `json:"c"`
	V  uint64  `json:"v"`
}

type alpacaBarsResp struct {
	Bars map[string][]alpacaBar `json:"bars"`
}

func (a *AlpacaClient) FetchDailyBars(ctx context.Context, symbols []string, days int) ([]models.MarketCandle, error) {
	if a.Key == "" || a.Secret == "" {
		return nil, fmt.Errorf("alpaca credentials not configured")
	}
	if days <= 0 {
		days = 30
	}
	if a.Client == nil {
		a.Client = &http.Client{Timeout: 60 * time.Second}
	}

	end := time.Now().UTC()
	start := end.AddDate(0, 0, -days)
	syms := strings.ReplaceAll(strings.Join(symbols, ","), " ", "")

	u := fmt.Sprintf("%s/stocks/bars?symbols=%s&timeframe=1Day&start=%s&end=%s&limit=10000&adjustment=split",
		a.DataURL, syms, start.Format(time.RFC3339), end.Format(time.RFC3339))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("APCA-API-KEY-ID", a.Key)
	req.Header.Set("APCA-API-SECRET-KEY", a.Secret)

	resp, err := a.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("alpaca bars %d: %s", resp.StatusCode, string(raw))
	}

	var data alpacaBarsResp
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil, err
	}

	var candles []models.MarketCandle
	for sym, bars := range data.Bars {
		for _, b := range bars {
			ts, err := time.Parse(time.RFC3339Nano, b.T)
			if err != nil {
				ts, _ = time.Parse(time.RFC3339, b.T)
			}
			candles = append(candles, models.MarketCandle{
				Symbol:    sym,
				Timeframe: "1Day",
				Timestamp: ts,
				Open:      b.O,
				High:      b.H,
				Low:       b.L,
				Close:     b.C,
				Volume:    int64(b.V),
				Source:    "alpaca",
			})
		}
	}
	return candles, nil
}

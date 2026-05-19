package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

type AlpacaClient struct {
	DataURL    string
	TradingURL string
	DataFeed   string // iex (free tier) or sip (paid)
	Key        string
	Secret     string
	Client     *http.Client

	// tradingBasesTestOverride, when non-empty, replaces tradingBaseURLs (tests only).
	tradingBasesTestOverride []string
}

// AlpacaAsset is metadata from the trading API /v2/assets.
type AlpacaAsset struct {
	Symbol   string
	Name     string
	Exchange string
	Class    string // us_equity, crypto, etc.
}

type alpacaAssetJSON struct {
	Symbol   string `json:"symbol"`
	Name     string `json:"name"`
	Exchange string `json:"exchange"`
	Class    string `json:"class"`
	Status   string `json:"status"`
}

type alpacaBar struct {
	T string  `json:"t"`
	O float64 `json:"o"`
	H float64 `json:"h"`
	L float64 `json:"l"`
	C float64 `json:"c"`
	V uint64  `json:"v"`
}

type alpacaBarsResp struct {
	Bars          map[string][]alpacaBar `json:"bars"`
	NextPageToken *string                `json:"next_page_token"`
}

func (a *AlpacaClient) FetchDailyBars(ctx context.Context, symbols []string, days int) ([]models.MarketCandle, error) {
	if a.Key == "" || a.Secret == "" {
		return nil, fmt.Errorf("alpaca credentials not configured")
	}
	if days <= 0 {
		days = 30
	}
	if a.Client == nil {
		a.Client = &http.Client{Timeout: 90 * time.Second}
	}

	feed := strings.TrimSpace(a.DataFeed)
	if feed == "" {
		feed = "iex"
	}

	end := time.Now().UTC()
	start := end.AddDate(0, 0, -days)
	syms := strings.ReplaceAll(strings.Join(symbols, ","), " ", "")

	var all []models.MarketCandle
	pageToken := ""

	for page := 0; page < 50; page++ {
		q := url.Values{}
		q.Set("symbols", syms)
		q.Set("timeframe", "1Day")
		q.Set("start", start.Format(time.RFC3339))
		q.Set("end", end.Format(time.RFC3339))
		q.Set("limit", "10000")
		q.Set("adjustment", "split")
		q.Set("feed", feed)
		q.Set("sort", "asc")
		if pageToken != "" {
			q.Set("page_token", pageToken)
		}

		u := fmt.Sprintf("%s/stocks/bars?%s", strings.TrimSuffix(a.DataURL, "/"), q.Encode())

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

		raw, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			msg := strings.TrimSpace(string(raw))
			if resp.StatusCode == http.StatusForbidden && feed == "sip" {
				return nil, fmt.Errorf("alpaca bars 403 (SIP feed requires paid subscription; set ALPACA_DATA_FEED=iex): %s", msg)
			}
			if resp.StatusCode == http.StatusForbidden {
				return nil, fmt.Errorf("alpaca bars 403: %s (check API keys and ALPACA_DATA_FEED=%s)", msg, feed)
			}
			return nil, fmt.Errorf("alpaca bars %d: %s", resp.StatusCode, msg)
		}

		var data alpacaBarsResp
		if err := json.Unmarshal(raw, &data); err != nil {
			return nil, err
		}

		for sym, bars := range data.Bars {
			for _, b := range bars {
				ts, err := time.Parse(time.RFC3339Nano, b.T)
				if err != nil {
					ts, _ = time.Parse(time.RFC3339, b.T)
				}
				all = append(all, models.MarketCandle{
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

		if data.NextPageToken == nil || *data.NextPageToken == "" {
			break
		}
		pageToken = *data.NextPageToken
	}

	if len(all) == 0 {
		return nil, fmt.Errorf("alpaca returned 0 bars for %d symbol(s) (feed=%s)", len(symbols), feed)
	}

	return all, nil
}

// tradingBaseURLs returns Alpaca trading API bases to try (paper vs live).
// Paper API keys start with PK and must use paper-api; live keys use api.alpaca.markets.
func (a *AlpacaClient) tradingBaseURLs() []string {
	if len(a.tradingBasesTestOverride) > 0 {
		return a.tradingBasesTestOverride
	}
	seen := map[string]bool{}
	var urls []string
	add := func(u string) {
		u = strings.TrimSuffix(strings.TrimSpace(u), "/")
		if u == "" || seen[u] {
			return
		}
		seen[u] = true
		urls = append(urls, u)
	}

	explicit := strings.TrimSuffix(strings.TrimSpace(a.TradingURL), "/")
	if explicit != "" {
		add(explicit)
	}
	if strings.HasPrefix(a.Key, "PK") {
		add("https://paper-api.alpaca.markets/v2")
		add("https://api.alpaca.markets/v2")
	} else {
		add("https://api.alpaca.markets/v2")
		add("https://paper-api.alpaca.markets/v2")
	}
	if len(urls) == 0 {
		return []string{"https://api.alpaca.markets/v2"}
	}
	return urls
}

func (a *AlpacaClient) fetchAssetsAt(ctx context.Context, base string, chunk []string) ([]alpacaAssetJSON, error) {
	q := url.Values{}
	q.Set("status", "active")
	q.Set("symbols", strings.Join(chunk, ","))
	u := fmt.Sprintf("%s/assets?%s", strings.TrimSuffix(base, "/"), q.Encode())

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
	raw, _ := io.ReadAll(resp.Body)
	resp.Body.Close()

	msg := strings.TrimSpace(string(raw))
	if resp.StatusCode == http.StatusOK {
		var items []alpacaAssetJSON
		if err := json.Unmarshal(raw, &items); err != nil {
			return nil, err
		}
		return items, nil
	}
	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("alpaca assets 401: %s", msg)
	}
	return nil, fmt.Errorf("alpaca assets %d: %s", resp.StatusCode, msg)
}

// FetchAssets loads symbol metadata from Alpaca trading API (batch by symbol list).
func (a *AlpacaClient) FetchAssets(ctx context.Context, symbols []string) (map[string]AlpacaAsset, error) {
	if a.Key == "" || a.Secret == "" {
		return nil, fmt.Errorf("alpaca credentials not configured")
	}
	if len(symbols) == 0 {
		return map[string]AlpacaAsset{}, nil
	}
	if a.Client == nil {
		a.Client = &http.Client{Timeout: 90 * time.Second}
	}

	bases := a.tradingBaseURLs()
	out := make(map[string]AlpacaAsset, len(symbols))

	for i := 0; i < len(symbols); i += 50 {
		end := i + 50
		if end > len(symbols) {
			end = len(symbols)
		}
		chunk := symbols[i:end]

		var items []alpacaAssetJSON
		var lastErr error
		for _, base := range bases {
			got, err := a.fetchAssetsAt(ctx, base, chunk)
			if err == nil {
				items = got
				lastErr = nil
				break
			}
			lastErr = err
			if !strings.Contains(err.Error(), "401") {
				return nil, err
			}
		}
		if lastErr != nil {
			hint := "check ALPACA_API_KEY and ALPACA_API_SECRET"
			if strings.HasPrefix(a.Key, "PK") {
				hint = "paper keys (PK…) need ALPACA_TRADING_URL=https://paper-api.alpaca.markets/v2 — live keys use https://api.alpaca.markets/v2"
			}
			return nil, fmt.Errorf("%w (%s)", lastErr, hint)
		}

		for _, it := range items {
			if it.Symbol == "" || it.Status != "active" {
				continue
			}
			out[it.Symbol] = AlpacaAsset{
				Symbol:   it.Symbol,
				Name:     it.Name,
				Exchange: it.Exchange,
				Class:    it.Class,
			}
		}
	}
	return out, nil
}

// NormalizeAssetClass maps Alpaca asset class + name to app grouping key.
func NormalizeAssetClass(alpacaClass, name string) string {
	upper := strings.ToUpper(name)
	if alpacaClass == "crypto" {
		return "crypto"
	}
	if strings.Contains(upper, " ETF") || strings.HasSuffix(upper, " ETF") {
		return "etf"
	}
	if alpacaClass == "us_equity" || alpacaClass == "" {
		return "equity"
	}
	return "other"
}

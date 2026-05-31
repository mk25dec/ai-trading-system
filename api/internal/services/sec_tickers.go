package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

const DefaultSECCompanyTickersURL = "https://www.sec.gov/files/company_tickers.json"

// SECClient fetches the SEC company ticker list.
type SECClient struct {
	URL        string
	UserAgent  string
	HTTPClient *http.Client
}

func (c *SECClient) client() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return &http.Client{Timeout: 60 * time.Second}
}

func (c *SECClient) tickersURL() string {
	if strings.TrimSpace(c.URL) != "" {
		return c.URL
	}
	return DefaultSECCompanyTickersURL
}

func (c *SECClient) userAgent() string {
	if strings.TrimSpace(c.UserAgent) != "" {
		return c.UserAgent
	}
	return "TradingAI-Bot admin@example.com"
}

// FetchCompanyTickers downloads and parses SEC company_tickers.json.
func (c *SECClient) FetchCompanyTickers(ctx context.Context) ([]models.SECSymbolEntry, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.tickersURL(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", c.userAgent())
	req.Header.Set("Accept", "application/json")

	resp, err := c.client().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sec company_tickers: HTTP %d", resp.StatusCode)
	}
	return ParseSECCompanyTickersJSON(body)
}

// ParseSECCompanyTickersJSON parses SEC company_tickers.json bytes.
func ParseSECCompanyTickersJSON(body []byte) ([]models.SECSymbolEntry, error) {
	var raw map[string]struct {
		CIK    int64  `json:"cik_str"`
		Ticker string `json:"ticker"`
		Title  string `json:"title"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("parse sec company_tickers: %w", err)
	}

	out := make([]models.SECSymbolEntry, 0, len(raw))
	seen := map[string]bool{}
	keys := make([]int, 0, len(raw))
	for k := range raw {
		n, err := strconv.Atoi(k)
		if err != nil {
			continue
		}
		keys = append(keys, n)
	}
	sort.Ints(keys)
	for _, n := range keys {
		row := raw[strconv.Itoa(n)]
		sym := strings.ToUpper(strings.TrimSpace(row.Ticker))
		if sym == "" || seen[sym] {
			continue
		}
		seen[sym] = true
		out = append(out, models.SECSymbolEntry{
			Symbol: sym,
			Name:   strings.TrimSpace(row.Title),
			CIK:    row.CIK,
		})
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("sec company_tickers: no tickers parsed")
	}
	return out, nil
}

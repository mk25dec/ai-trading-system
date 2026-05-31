package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const (
	yahooSearchNewsURL        = "https://query1.finance.yahoo.com/v1/finance/search"
	yahooTrendingURL          = "https://query1.finance.yahoo.com/v1/finance/trending/US"
	maxYahooSymbolNewsQueries = 25
	yahooNewsPerSymbol        = 50
	maxTrendingSymbols        = 15
)

var yahooUUIDInPathRe = regexp.MustCompile(`/m/([0-9a-f-]{36})/`)
var yahooSlugDigitsRe = regexp.MustCompile(`-\d+$`)

// YahooNewsClient fetches Yahoo Finance news metadata (including relatedTickers).
type YahooNewsClient struct {
	HTTPClient  *http.Client
	SearchURL   string
	TrendingURL string
}

type yahooSearchNewsResponse struct {
	News []yahooSearchNewsItem `json:"news"`
}

type yahooSearchNewsItem struct {
	UUID           string   `json:"uuid"`
	Title          string   `json:"title"`
	Link           string   `json:"link"`
	RelatedTickers []string `json:"relatedTickers"`
}

type yahooTrendingResponse struct {
	Finance struct {
		Result []struct {
			Quotes []struct {
				Symbol string `json:"symbol"`
			} `json:"quotes"`
		} `json:"result"`
	} `json:"finance"`
}

// YahooRelatedTickersIndex maps Yahoo article keys to source-provided tickers.
type YahooRelatedTickersIndex struct {
	byURL   map[string][]string
	byTitle map[string][]string
	bySlug  map[string][]string
}

func (c *YahooNewsClient) client() *http.Client {
	if c != nil && c.HTTPClient != nil {
		return c.HTTPClient
	}
	return &http.Client{Timeout: 30 * time.Second}
}

func (c *YahooNewsClient) searchBaseURL() string {
	if c != nil && strings.TrimSpace(c.SearchURL) != "" {
		return c.SearchURL
	}
	return yahooSearchNewsURL
}

func (c *YahooNewsClient) trendingURL() string {
	if c != nil && strings.TrimSpace(c.TrendingURL) != "" {
		return c.TrendingURL
	}
	return yahooTrendingURL
}

// IsYahooFinanceRSS reports whether ingest should enrich from Yahoo news JSON.
func IsYahooFinanceRSS(feedURL, source string) bool {
	if source == "yahoo_finance_rss" {
		return true
	}
	return strings.Contains(strings.ToLower(feedURL), "finance.yahoo.com")
}

// BuildYahooRelatedTickersIndex fetches Yahoo news for symbols and indexes relatedTickers by URL/title/slug.
func (c *YahooNewsClient) BuildYahooRelatedTickersIndex(ctx context.Context, symbols []string) (*YahooRelatedTickersIndex, error) {
	idx := &YahooRelatedTickersIndex{
		byURL:   map[string][]string{},
		byTitle: map[string][]string{},
		bySlug:  map[string][]string{},
	}
	if c == nil {
		c = &YahooNewsClient{}
	}

	seenSymbol := map[string]bool{}
	queryCount := 0
	for _, sym := range symbols {
		sym = strings.ToUpper(strings.TrimSpace(sym))
		if sym == "" || seenSymbol[sym] || queryCount >= maxYahooSymbolNewsQueries {
			continue
		}
		seenSymbol[sym] = true
		queryCount++

		items, err := c.fetchSymbolNews(ctx, sym, yahooNewsPerSymbol)
		if err != nil {
			return idx, fmt.Errorf("yahoo news for %s: %w", sym, err)
		}
		for _, item := range items {
			idx.add(item)
		}
	}
	return idx, nil
}

func (c *YahooNewsClient) fetchSymbolNews(ctx context.Context, symbol string, newsCount int) ([]yahooSearchNewsItem, error) {
	u, err := url.Parse(c.searchBaseURL())
	if err != nil {
		return nil, err
	}
	q := u.Query()
	q.Set("q", symbol)
	q.Set("quotesCount", "0")
	q.Set("newsCount", fmt.Sprintf("%d", newsCount))
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "TradingAI-Bot/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := c.client().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	var parsed yahooSearchNewsResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	return parsed.News, nil
}

func (c *YahooNewsClient) FetchTrendingSymbols(ctx context.Context) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.trendingURL(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "TradingAI-Bot/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := c.client().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("trending HTTP %d", resp.StatusCode)
	}

	var parsed yahooTrendingResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	if len(parsed.Finance.Result) == 0 {
		return nil, nil
	}

	var out []string
	for _, q := range parsed.Finance.Result[0].Quotes {
		sym := strings.ToUpper(strings.TrimSpace(q.Symbol))
		if sym == "" || !yahooNewsQuerySymbol(sym) {
			continue
		}
		out = append(out, sym)
		if len(out) >= maxTrendingSymbols {
			break
		}
	}
	return out, nil
}

func yahooNewsQuerySymbol(symbol string) bool {
	if strings.Contains(symbol, "-USD") {
		return false
	}
	for _, r := range symbol {
		if r >= 'A' && r <= 'Z' {
			continue
		}
		if r >= '0' && r <= '9' {
			continue
		}
		if r == '.' || r == '-' {
			continue
		}
		return false
	}
	return len(symbol) >= 1 && len(symbol) <= 10
}

func (idx *YahooRelatedTickersIndex) add(item yahooSearchNewsItem) {
	tickers := NormalizeSourceTickers(item.RelatedTickers)
	if len(tickers) == 0 {
		return
	}
	if link := CanonicalURL(item.Link); link != "" {
		idx.byURL[link] = tickers
	}
	if item.UUID != "" {
		idx.byURL[strings.ToLower(item.UUID)] = tickers
	}
	if titleKey := NormalizeNewsTitle(item.Title); titleKey != "" {
		idx.byTitle[titleKey] = tickers
	}
	if slug := yahooArticleSlugKey(item.Link); slug != "" {
		idx.bySlug[slug] = tickers
	}
}

// Lookup returns Yahoo source-provided relatedTickers for an RSS/article row.
func (idx *YahooRelatedTickersIndex) Lookup(link, guid, title string) []string {
	if idx == nil {
		return nil
	}
	if link != "" {
		if tickers := idx.byURL[CanonicalURL(link)]; len(tickers) > 0 {
			return tickers
		}
	}
	if guid != "" {
		if tickers := idx.bySlug[yahooArticleSlugKey(guid)]; len(tickers) > 0 {
			return tickers
		}
	}
	if link != "" {
		if tickers := idx.bySlug[yahooArticleSlugKey(link)]; len(tickers) > 0 {
			return tickers
		}
	}
	if titleKey := NormalizeNewsTitle(title); titleKey != "" {
		if tickers := idx.byTitle[titleKey]; len(tickers) > 0 {
			return tickers
		}
	}
	return nil
}

func yahooArticleSlugKey(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if m := yahooUUIDInPathRe.FindStringSubmatch(raw); len(m) == 2 {
		return strings.ToLower(m[1])
	}
	raw = strings.TrimPrefix(raw, "https://")
	raw = strings.TrimPrefix(raw, "http://")
	if i := strings.Index(raw, "/"); i >= 0 {
		raw = raw[i+1:]
	}
	raw = strings.TrimSuffix(raw, ".html")
	raw = strings.ToLower(raw)
	for {
		next := yahooSlugDigitsRe.ReplaceAllString(raw, "")
		if next == raw {
			break
		}
		raw = next
	}
	return raw
}

// NormalizeNewsTitle lowercases and collapses whitespace for Yahoo title matching.
func NormalizeNewsTitle(title string) string {
	title = strings.TrimSpace(title)
	if title == "" {
		return ""
	}
	return strings.ToLower(spaceRe.ReplaceAllString(title, " "))
}

// CollectYahooNewsQuerySymbols builds symbol queries from RSS batch title tickers plus trending.
func CollectYahooNewsQuerySymbols(titleTickers []string, trending []string) []string {
	return NormalizeSourceTickers(append(titleTickers, trending...))
}

// RSSSourceTickers merges headline parens with Yahoo relatedTickers for backlog ingest.
func RSSSourceTickers(title string, relatedTickers []string) []string {
	return MergeSourceTickers(SourceTickersFromTitle(title), relatedTickers)
}

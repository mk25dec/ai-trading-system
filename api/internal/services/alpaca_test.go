package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFetchDailyBars_usesIEXFeedAndPaginates(t *testing.T) {
	var requestCount int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if r.URL.Query().Get("feed") != "iex" {
			t.Errorf("expected feed=iex, got %s", r.URL.Query().Get("feed"))
		}
		if requestCount == 1 {
			_, _ = w.Write([]byte(`{"bars":{"AAPL":[{"t":"2024-01-02T05:00:00Z","o":1,"h":2,"l":1,"c":1.5,"v":100}]},"next_page_token":"page2"}`))
			return
		}
		_, _ = w.Write([]byte(`{"bars":{"GOOGL":[{"t":"2024-01-02T05:00:00Z","o":2,"h":3,"l":2,"c":2.5,"v":200}]}}`))
	}))
	defer srv.Close()

	client := &AlpacaClient{
		DataURL:  srv.URL,
		DataFeed: "iex",
		Key:      "key",
		Secret:   "secret",
	}

	candles, err := client.FetchDailyBars(context.Background(), []string{"AAPL", "GOOGL"}, 30)
	if err != nil {
		t.Fatal(err)
	}
	if len(candles) != 2 {
		t.Fatalf("expected 2 candles, got %d", len(candles))
	}
	if requestCount != 2 {
		t.Fatalf("expected 2 HTTP requests (pagination), got %d", requestCount)
	}
}

func TestTradingBaseURLs(t *testing.T) {
	t.Parallel()
	paper := &AlpacaClient{Key: "PKTEST"}
	bases := paper.tradingBaseURLs()
	if bases[0] != "https://paper-api.alpaca.markets/v2" {
		t.Fatalf("paper key default base: got %v", bases)
	}

	live := &AlpacaClient{Key: "AKTEST"}
	bases = live.tradingBaseURLs()
	if bases[0] != "https://api.alpaca.markets/v2" {
		t.Fatalf("live key default base: got %v", bases)
	}

	custom := &AlpacaClient{Key: "PKTEST", TradingURL: "https://custom.example/v2"}
	bases = custom.tradingBaseURLs()
	if bases[0] != "https://custom.example/v2" {
		t.Fatalf("explicit URL should be first: got %v", bases)
	}
	if !strings.Contains(strings.Join(bases, ","), "paper-api") {
		t.Fatalf("expected paper-api fallback: %v", bases)
	}
}

func TestFetchAssets_triesNextBaseOn401(t *testing.T) {
	attempts := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if strings.Contains(r.URL.Path, "/fail/") {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"code":40110000,"message":"request is not authorized"}`))
			return
		}
		_, _ = w.Write([]byte(`[{"symbol":"AAPL","name":"Apple Inc","exchange":"NASDAQ","class":"us_equity","status":"active"}]`))
	}))
	defer srv.Close()

	client := &AlpacaClient{
		Key:    "PKTEST",
		Secret: "secret",
		tradingBasesTestOverride: []string{
			srv.URL + "/fail",
			srv.URL + "/ok",
		},
	}

	assets, err := client.FetchAssets(context.Background(), []string{"AAPL"})
	if err != nil {
		t.Fatal(err)
	}
	if assets["AAPL"].Name != "Apple Inc" {
		t.Fatalf("got %+v", assets["AAPL"])
	}
	if attempts != 2 {
		t.Fatalf("expected 2 HTTP attempts, got %d", attempts)
	}
}

package services

import (
	"context"
	"net/http"
	"net/http/httptest"
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

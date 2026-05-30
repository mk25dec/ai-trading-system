package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRefreshSymbolChartBars_fetchRecent30Min(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("timeframe") != ChartIntradayTimeframe {
			t.Fatalf("unexpected timeframe %q", r.URL.Query().Get("timeframe"))
		}
		_, _ = w.Write([]byte(`{"bars":{"AAPL":[{"t":"2024-06-03T14:30:00Z","o":190,"h":191,"l":189,"c":190.5,"v":1000},{"t":"2024-06-03T15:00:00Z","o":190.5,"h":192,"l":190,"c":191.2,"v":1200}]}}`))
	}))
	defer srv.Close()

	client := &AlpacaClient{
		DataURL:  srv.URL,
		DataFeed: "iex",
		Key:      "key",
		Secret:   "secret",
	}
	bars, err := client.FetchBars(context.Background(), []string{"AAPL"}, ChartIntradayTimeframe, ChartLiveRefreshDays30Min)
	if err != nil {
		t.Fatal(err)
	}
	if len(bars) != 2 {
		t.Fatalf("expected 2 bars, got %d", len(bars))
	}
	if bars[0].Timeframe != ChartIntradayTimeframe {
		t.Fatalf("expected timeframe %s, got %s", ChartIntradayTimeframe, bars[0].Timeframe)
	}
}

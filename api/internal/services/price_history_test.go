package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

func TestFetchBars_1Min(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("timeframe") != ChartIntradayTimeframe {
			t.Fatalf("unexpected timeframe %q", r.URL.Query().Get("timeframe"))
		}
		_, _ = w.Write([]byte(`{"bars":{"AAPL":[{"t":"2024-06-03T14:30:00Z","o":190,"h":191,"l":189,"c":190.5,"v":100}]}}`))
	}))
	defer srv.Close()

	client := &AlpacaClient{
		DataURL:  srv.URL,
		DataFeed: "iex",
		Key:      "key",
		Secret:   "secret",
	}
	bars, err := client.FetchBars(context.Background(), []string{"AAPL"}, ChartIntradayTimeframe, ChartLiveRefreshDays)
	if err != nil {
		t.Fatal(err)
	}
	if len(bars) != 1 || bars[0].Timeframe != ChartIntradayTimeframe {
		t.Fatalf("got %+v", bars)
	}
}

func TestFetchSnapshots_latestTrade(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"AAPL":{"latestTrade":{"t":"2024-06-03T15:01:00Z","p":191.2},"minuteBar":{"t":"2024-06-03T15:01:00Z","o":191,"h":191.5,"l":190.8,"c":191.2,"v":500}}}`))
	}))
	defer srv.Close()

	client := &AlpacaClient{DataURL: srv.URL, DataFeed: "iex", Key: "k", Secret: "s"}
	ticks, bars, err := client.FetchSnapshots(context.Background(), []string{"AAPL"})
	if err != nil {
		t.Fatal(err)
	}
	if ticks["AAPL"].Price != 191.2 {
		t.Fatalf("tick %+v", ticks["AAPL"])
	}
	if len(bars) != 1 || bars[0].Close != 191.2 {
		t.Fatalf("bars %+v", bars)
	}
}

func TestMergeLiveChartPoint_updatesLastMinute(t *testing.T) {
	ts := time.Date(2024, 6, 3, 15, 1, 30, 0, time.UTC)
	points := []models.PriceChartPoint{{
		Timestamp: time.Date(2024, 6, 3, 15, 1, 0, 0, time.UTC),
		Close:     190,
	}}
	tick := &LivePriceTick{Timestamp: ts, Price: 191.2}
	out := MergeLiveChartPoint(points, tick)
	if len(out) != 1 || out[0].Close != 191.2 {
		t.Fatalf("got %+v", out)
	}
}

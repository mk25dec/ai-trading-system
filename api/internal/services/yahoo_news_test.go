package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestYahooRelatedTickersIndex_Lookup_byURLAndTitle(t *testing.T) {
	idx := &YahooRelatedTickersIndex{
		byURL:   map[string][]string{},
		byTitle: map[string][]string{},
		bySlug:  map[string][]string{},
	}
	idx.add(yahooSearchNewsItem{
		UUID:           "f8252a7d-66c6-3596-86bb-42302fe9e47d",
		Title:          "Dell Technologies (DELL) Wins $10B Govt Contract, Hits All-Time High",
		Link:           "https://finance.yahoo.com/markets/stocks/articles/dell-technologies-dell-wins-10b-062727963.html",
		RelatedTickers: []string{"DELL", "MSFT"},
	})

	got := idx.Lookup(
		"https://finance.yahoo.com/markets/stocks/articles/dell-technologies-dell-wins-10b-062727963.html",
		"",
		"",
	)
	if len(got) != 2 || got[0] != "DELL" || got[1] != "MSFT" {
		t.Fatalf("url lookup = %v", got)
	}

	got = idx.Lookup("", "", "Dell Technologies (DELL) Wins $10B Govt Contract, Hits All-Time High")
	if len(got) != 2 {
		t.Fatalf("title lookup = %v", got)
	}
}

func TestYahooRelatedTickersIndex_Lookup_byGuidSlug(t *testing.T) {
	idx := &YahooRelatedTickersIndex{
		byURL:   map[string][]string{},
		byTitle: map[string][]string{},
		bySlug:  map[string][]string{},
	}
	idx.add(yahooSearchNewsItem{
		UUID:           "7ac3049d-8b89-3a1b-9972-1da99bbf4ded",
		Title:          "Why Dell Stock Skyrocketed to a New All-Time High Today",
		Link:           "https://finance.yahoo.com/m/7ac3049d-8b89-3a1b-9972-1da99bbf4ded/why-dell-stock-skyrocketed-to.html",
		RelatedTickers: []string{"DELL", "NVDA", "INTC"},
	})

	rssLink := "https://finance.yahoo.com/markets/stocks/articles/why-dell-stock-skyrocketed-time-020250719.html"
	rssGuid := "why-dell-stock-skyrocketed-time-020250719.html"

	got := idx.Lookup(rssLink, rssGuid, "Why Dell Stock Skyrocketed to a New All-Time High Today")
	if len(got) != 3 || got[0] != "DELL" {
		t.Fatalf("lookup = %v, want DELL first among 3", got)
	}
}

func TestYahooNewsClient_BuildYahooRelatedTickersIndex(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"news": [{
				"uuid": "abc",
				"title": "Acme Corp (ACME) beats estimates",
				"link": "https://finance.yahoo.com/markets/stocks/articles/acme-beats-123.html",
				"relatedTickers": ["ACME", "MSFT"]
			}]
		}`))
	}))
	defer srv.Close()

	client := &YahooNewsClient{
		HTTPClient: srv.Client(),
		SearchURL:  srv.URL,
	}
	idx, err := client.BuildYahooRelatedTickersIndex(context.Background(), []string{"ACME"})
	if err != nil {
		t.Fatal(err)
	}
	got := idx.Lookup("https://finance.yahoo.com/markets/stocks/articles/acme-beats-123.html", "", "")
	if len(got) != 2 || got[0] != "ACME" || got[1] != "MSFT" {
		t.Fatalf("lookup = %v", got)
	}
}

func TestRSSSourceTickers_mergesTitleAndRelated(t *testing.T) {
	got := RSSSourceTickers("Foo Corp (FOO) rises", []string{"FOO", "MSFT"})
	if len(got) != 2 {
		t.Fatalf("got %v", got)
	}
}

func TestCollectYahooNewsQuerySymbols_dedupes(t *testing.T) {
	got := CollectYahooNewsQuerySymbols([]string{"DELL", "NVDA"}, []string{"nvda", "MSFT"})
	if len(got) != 3 {
		t.Fatalf("got %v", got)
	}
}

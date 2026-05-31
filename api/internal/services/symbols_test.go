package services

import "testing"

func TestDetectSymbols_prefersTitleTickerInParens(t *testing.T) {
	universe := UniverseSet([]string{"WLFC", "NVDA", "AMD", "MSFT", "AAPL", "A"})
	title := "Willis Lease Finance Corp. (WLFC) Surges on Market Optimism"
	body := "NVIDIA and Microsoft led the market higher while Apple gained."

	got := DetectSymbols(title, body, universe, nil)
	if len(got) != 1 {
		t.Fatalf("len = %d, want 1: %+v", len(got), got)
	}
	if got[0].Symbol != "WLFC" {
		t.Fatalf("symbol = %q, want WLFC", got[0].Symbol)
	}
	if got[0].DetectionMethod != "title_paren" {
		t.Fatalf("method = %q, want title_paren", got[0].DetectionMethod)
	}
}

func TestDetectSymbols_titleParenWithoutUniverse(t *testing.T) {
	universe := UniverseSet([]string{"IBM", "AAPL"})
	title := "What Does Willis Lease Finance Corp (WLFC) Notes Offering Say About the Stock?"
	body := "IBM and Apple shares rose while the market gained."

	got := DetectSymbols(title, body, universe, nil)
	if len(got) != 1 || got[0].Symbol != "WLFC" {
		t.Fatalf("got %+v, want only WLFC from title", got)
	}
}

func TestDetectSymbols_usesSourceGuesses(t *testing.T) {
	universe := UniverseSet([]string{"INMD", "NVDA"})
	title := "Inmode Ltd. (INMD) Outperforms Broader Market"
	body := "Tech stocks including NVDA moved higher."

	got := DetectSymbols(title, body, universe, []string{"INMD"})
	if len(got) != 1 {
		t.Fatalf("len = %d, want 1: %+v", len(got), got)
	}
	if got[0].Symbol != "INMD" {
		t.Fatalf("symbol = %q, want INMD", got[0].Symbol)
	}
}

func TestDetectSymbols_ignoresBodyWithoutSourceOrTitleTicker(t *testing.T) {
	universe := UniverseSet([]string{"A", "NVDA", "AMD", "AAPL", "MSFT", "AMZN", "IBM"})
	title := "Dave Ramsey Says To Pay Off Your Mortgage Early — But Should You?"
	body := "NVIDIA and Microsoft led the market higher while Apple, AMD, Amazon, and IBM gained."

	got := DetectSymbols(title, body, universe, nil)
	if len(got) != 0 {
		t.Fatalf("got %+v, want no symbols when source and title lack tickers", got)
	}
}

func TestDetectSymbols_ignoresFuzzyTitleWithoutParenTicker(t *testing.T) {
	universe := UniverseSet([]string{"AAPL"})
	title := "Apple reports record revenue"
	body := ""

	got := DetectSymbols(title, body, universe, nil)
	if len(got) != 0 {
		t.Fatalf("got %+v, want empty without (TICKER) or source guess", got)
	}
}

func TestExtractTickersFromTitle(t *testing.T) {
	cases := []struct {
		title string
		want  []string
	}{
		{"Sarepta Therapeutics Inc (SRPT) Matches Market", []string{"SRPT"}},
		{"Willis Lease Finance Corp. (WLFC) Surges", []string{"WLFC"}},
		{"No ticker here", nil},
		{"Unknown (FOO) and Willis Lease Finance Corp. (WLFC)", []string{"FOO", "WLFC"}},
	}
	for _, tc := range cases {
		got := extractTickersFromTitle(tc.title)
		if len(got) != len(tc.want) {
			t.Fatalf("title %q: len = %d, want %d (%v)", tc.title, len(got), len(tc.want), got)
		}
		for i, sym := range tc.want {
			if got[i].Symbol != sym {
				t.Fatalf("title %q: got[%d] = %q, want %q", tc.title, i, got[i].Symbol, sym)
			}
		}
	}
}

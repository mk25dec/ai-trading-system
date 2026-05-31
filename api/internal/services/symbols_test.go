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

func TestDetectSymbols_skipsSingleLetterBodyMatches(t *testing.T) {
	universe := UniverseSet([]string{"A", "NVDA"})
	title := "Market update for investors"
	body := "A broad rally lifted shares while NVIDIA climbed."

	got := DetectSymbols(title, body, universe, nil)
	if len(got) != 1 || got[0].Symbol != "NVDA" {
		t.Fatalf("got %+v, want only NVDA from company alias/body", got)
	}
}

func TestExtractTickersFromTitle(t *testing.T) {
	universe := UniverseSet([]string{"SRPT", "WLFC", "FOO"})
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
		got := extractTickersFromTitle(tc.title, universe)
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

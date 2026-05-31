package services

import "testing"

func TestSymbolsFromSource_onlyUsesProvidedList(t *testing.T) {
	got := SymbolsFromSource([]string{"INMD", "nvda"})
	if len(got) != 2 {
		t.Fatalf("len = %d, want 2: %+v", len(got), got)
	}
	if got[0].Symbol != "INMD" || got[1].Symbol != "NVDA" {
		t.Fatalf("got %+v", got)
	}
	if got[0].DetectionMethod != "source_metadata" {
		t.Fatalf("method = %q", got[0].DetectionMethod)
	}
}

func TestSymbolsFromSource_emptyWhenSourceEmpty(t *testing.T) {
	title := "Why Cerebras Stock Is Rocketing Higher Today"
	body := "NVIDIA and Microsoft led the market higher."

	got := SymbolsFromSource(nil)
	if len(got) != 0 {
		t.Fatalf("got %+v, want no symbols without source tickers", got)
	}
	_ = title
	_ = body
}

func TestNormalizeSourceTickers_dedupesAndSkipsNoise(t *testing.T) {
	got := NormalizeSourceTickers([]string{"aapl", "AAPL", "AI", ""})
	if len(got) != 1 || got[0] != "AAPL" {
		t.Fatalf("got %v", got)
	}
}

func TestSourceTickersFromTitle_readsParenthesesFromHeadline(t *testing.T) {
	got := SourceTickersFromTitle("Willis Lease Finance Corp. (WLFC) Surges")
	if len(got) != 1 || got[0] != "WLFC" {
		t.Fatalf("got %v, want WLFC from headline", got)
	}
	if len(SourceTickersFromTitle("Dave Ramsey mortgage tips")) != 0 {
		t.Fatal("expected no tickers without parens in headline")
	}
}

func TestSourceTickersFromMetadata_readsKnownKeys(t *testing.T) {
	meta := map[string]any{
		"symbols": []any{"MSFT", "AMD"},
	}
	got := SourceTickersFromMetadata(meta)
	if len(got) != 2 || got[0] != "MSFT" || got[1] != "AMD" {
		t.Fatalf("got %v", got)
	}
}

func TestSourceTickersFromMetadata_readsRelatedTickers(t *testing.T) {
	meta := map[string]any{
		"relatedTickers": []any{"DELL", "MSFT"},
	}
	got := SourceTickersFromMetadata(meta)
	if len(got) != 2 || got[0] != "DELL" || got[1] != "MSFT" {
		t.Fatalf("got %v", got)
	}
}

func TestMergeSourceTickers_dedupesInOrder(t *testing.T) {
	got := MergeSourceTickers([]string{"DELL"}, []string{"MSFT", "DELL"})
	if len(got) != 2 || got[0] != "DELL" || got[1] != "MSFT" {
		t.Fatalf("got %v", got)
	}
}

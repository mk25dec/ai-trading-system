package services

import (
	"strings"
)

// ambiguousWords are tokens sources sometimes mislabel as tickers.
var ambiguousWords = map[string]bool{
	"AI": true, "US": true, "UK": true, "EU": true, "CEO": true, "CFO": true,
	"IPO": true, "ETF": true, "GDP": true, "FED": true, "SEC": true,
}

// SymbolsFromSource maps only tickers supplied by the ingest source (backlog / metadata).
func SymbolsFromSource(raw []string) []DetectedSymbol {
	tickers := NormalizeSourceTickers(raw)
	out := make([]DetectedSymbol, 0, len(tickers))
	for _, sym := range tickers {
		out = append(out, DetectedSymbol{
			Symbol:          sym,
			DetectionMethod: "source_metadata",
			RelevanceScore:  0.95,
			Confidence:      0.95,
		})
	}
	return out
}

// NormalizeSourceTickers deduplicates and uppercases source-provided tickers.
func NormalizeSourceTickers(raw []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, g := range raw {
		sym := strings.ToUpper(strings.TrimSpace(g))
		if sym == "" || ambiguousWords[sym] || seen[sym] {
			continue
		}
		seen[sym] = true
		out = append(out, sym)
	}
	return out
}

// SourceTickersFromMetadata reads optional ticker lists from ingest metadata.
func SourceTickersFromMetadata(meta map[string]any) []string {
	if meta == nil {
		return nil
	}
	var out []string
	for _, key := range []string{"symbols", "tickers", "rawSymbolGuess", "raw_symbol_guess"} {
		out = append(out, parseTickerList(meta[key])...)
	}
	return NormalizeSourceTickers(out)
}

func parseTickerList(v any) []string {
	switch t := v.(type) {
	case []string:
		return t
	case []any:
		var out []string
		for _, item := range t {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	default:
		return nil
	}
}

type DetectedSymbol struct {
	Symbol          string
	DetectionMethod string
	RelevanceScore  float64
	Confidence      float64
}

func UniverseSet(symbols []string) map[string]bool {
	m := make(map[string]bool, len(symbols))
	for _, s := range symbols {
		m[strings.ToUpper(s)] = true
	}
	return m
}

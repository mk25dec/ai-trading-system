package services

import (
	"regexp"
	"strings"
)

var titleParenRe = regexp.MustCompile(`\(([A-Z]{1,5})\)`)

// ambiguousWords are uppercase tokens that are not tickers in context.
var ambiguousWords = map[string]bool{
	"AI": true, "US": true, "UK": true, "EU": true, "CEO": true, "CFO": true,
	"IPO": true, "ETF": true, "GDP": true, "FED": true, "SEC": true,
}

func DetectSymbols(title, body string, universe map[string]bool, guesses []string) []DetectedSymbol {
	_ = body // article text is not used for symbol assignment
	found := map[string]DetectedSymbol{}

	add := func(sym, method string, score, conf float64) {
		sym = strings.ToUpper(strings.TrimSpace(sym))
		if sym == "" || ambiguousWords[sym] {
			return
		}
		if method != "title_paren" && method != "source_metadata" && !universe[sym] {
			return
		}
		if existing, ok := found[sym]; ok && existing.RelevanceScore >= score {
			return
		}
		found[sym] = DetectedSymbol{Symbol: sym, DetectionMethod: method, RelevanceScore: score, Confidence: conf}
	}

	for _, g := range guesses {
		sym := strings.ToUpper(strings.TrimSpace(g))
		if sym != "" {
			add(sym, "source_metadata", 0.95, 0.95)
		}
	}

	// Only source metadata and explicit (TICKER) in the headline — never infer from body or fuzzy title matches.
	for _, d := range extractTickersFromTitle(title) {
		add(d.Symbol, d.DetectionMethod, d.RelevanceScore, d.Confidence)
	}

	return detectedList(found)
}

func extractTickersFromTitle(title string) []DetectedSymbol {
	upper := strings.ToUpper(title)
	seen := map[string]bool{}
	var out []DetectedSymbol
	for _, m := range titleParenRe.FindAllStringSubmatch(upper, -1) {
		sym := m[1]
		if seen[sym] || ambiguousWords[sym] {
			continue
		}
		seen[sym] = true
		out = append(out, DetectedSymbol{
			Symbol:          sym,
			DetectionMethod: "title_paren",
			RelevanceScore:  0.95,
			Confidence:      0.95,
		})
	}
	return out
}

func detectedList(found map[string]DetectedSymbol) []DetectedSymbol {
	out := make([]DetectedSymbol, 0, len(found))
	for _, d := range found {
		out = append(out, d)
	}
	return out
}

// GuessSymbolsFromTitle extracts tickers for RSS backlog hints (no universe filter).
func GuessSymbolsFromTitle(title string) []string {
	upper := strings.ToUpper(title)
	seen := map[string]bool{}
	var out []string
	for _, m := range titleParenRe.FindAllStringSubmatch(upper, -1) {
		sym := m[1]
		if seen[sym] || ambiguousWords[sym] {
			continue
		}
		seen[sym] = true
		out = append(out, sym)
	}
	return out
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

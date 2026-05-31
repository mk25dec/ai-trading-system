package services

import (
	"regexp"
	"strings"
)

var (
	tickerRe      = regexp.MustCompile(`\b([A-Z]{1,5})\b`)
	titleParenRe  = regexp.MustCompile(`\(([A-Z]{1,5})\)`)
)

// companyAliases maps common names to tickers in our universe.
var companyAliases = map[string]string{
	"NVIDIA": "NVDA", "MICROSOFT": "MSFT", "APPLE": "AAPL", "AMAZON": "AMZN",
	"META": "META", "ALPHABET": "GOOGL", "GOOGLE": "GOOGL", "AMD": "AMD",
	"TAIWAN SEMICONDUCTOR": "TSM", "BROADCOM": "AVGO", "ASML": "ASML",
	"PALANTIR": "PLTR", "SNOWFLAKE": "SNOW", "CROWDSTRIKE": "CRWD",
	"ARM HOLDINGS": "ARM", "SUPER MICRO": "SMCI",
}

// ambiguousWords are uppercase tokens that are not tickers in context.
var ambiguousWords = map[string]bool{
	"AI": true, "US": true, "UK": true, "EU": true, "CEO": true, "CFO": true,
	"IPO": true, "ETF": true, "GDP": true, "FED": true, "SEC": true,
}

func DetectSymbols(title, body string, universe map[string]bool, guesses []string) []DetectedSymbol {
	found := map[string]DetectedSymbol{}

	add := func(sym, method string, score, conf float64) {
		if !universe[sym] {
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

	for _, d := range extractTickersFromTitle(title, universe) {
		add(d.Symbol, d.DetectionMethod, d.RelevanceScore, d.Confidence)
	}

	titleUpper := strings.ToUpper(title)
	for _, m := range tickerRe.FindAllStringSubmatch(titleUpper, -1) {
		sym := m[1]
		if len(sym) == 1 || ambiguousWords[sym] {
			continue
		}
		add(sym, "title_ticker", 0.9, 0.85)
	}

	for name, sym := range companyAliases {
		if strings.Contains(titleUpper, name) {
			add(sym, "title_company", 0.85, 0.8)
		}
	}

	// Title-first: if we already matched specific tickers, skip noisy body scanning.
	if len(found) > 0 {
		return detectedList(found)
	}

	bodyUpper := strings.ToUpper(body)
	for _, m := range tickerRe.FindAllStringSubmatch(bodyUpper, -1) {
		sym := m[1]
		if len(sym) <= 1 || ambiguousWords[sym] {
			continue
		}
		if sym == "ARM" && !strings.Contains(bodyUpper, "ARM HOLDINGS") {
			continue
		}
		add(sym, "body_ticker", 0.65, 0.55)
	}

	for name, sym := range companyAliases {
		if strings.Contains(bodyUpper, name) {
			add(sym, "body_company", 0.6, 0.55)
		}
	}

	return detectedList(found)
}

func extractTickersFromTitle(title string, universe map[string]bool) []DetectedSymbol {
	upper := strings.ToUpper(title)
	seen := map[string]bool{}
	var out []DetectedSymbol
	for _, m := range titleParenRe.FindAllStringSubmatch(upper, -1) {
		sym := m[1]
		if !universe[sym] || seen[sym] || ambiguousWords[sym] {
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

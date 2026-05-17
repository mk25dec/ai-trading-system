package services

import (
	"regexp"
	"strings"
)

var tickerRe = regexp.MustCompile(`\b([A-Z]{1,5})\b`)

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

func DetectSymbols(text string, universe map[string]bool, guesses []string) []DetectedSymbol {
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

	upper := strings.ToUpper(text)
	for _, g := range guesses {
		sym := strings.ToUpper(strings.TrimSpace(g))
		if sym != "" {
			add(sym, "source_metadata", 0.85, 0.9)
		}
	}

	for _, m := range tickerRe.FindAllStringSubmatch(upper, -1) {
		sym := m[1]
		if ambiguousWords[sym] {
			continue
		}
		if sym == "ARM" && !strings.Contains(upper, "ARM HOLDINGS") && strings.Count(upper, " ARM ") < 2 {
			continue
		}
		add(sym, "ticker", 0.75, 0.7)
	}

	for name, sym := range companyAliases {
		if strings.Contains(upper, name) {
			add(sym, "company_name", 0.8, 0.75)
		}
	}

	out := make([]DetectedSymbol, 0, len(found))
	for _, d := range found {
		out = append(out, d)
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

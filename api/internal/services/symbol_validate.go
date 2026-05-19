package services

import (
	"context"
	"fmt"
	"regexp"
	"strings"
)

// US equity tickers: 1–5 letters, optional class suffix (e.g. BRK.B).
var usTickerRe = regexp.MustCompile(`^[A-Z]{1,5}(\.[A-Z]{1,2})?$`)

// NormalizeTicker uppercases and trims; returns empty if invalid format.
func NormalizeTicker(raw string) string {
	s := strings.ToUpper(strings.TrimSpace(raw))
	if s == "" || !usTickerRe.MatchString(s) {
		return ""
	}
	return s
}

// NormalizeTickers deduplicates valid tickers in order.
func NormalizeTickers(raw []string) []string {
	seen := make(map[string]struct{})
	var out []string
	for _, r := range raw {
		s := NormalizeTicker(r)
		if s == "" {
			continue
		}
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}

// ValidateTickerFormat rejects malformed tickers before calling market data.
func ValidateTickerFormat(symbol string) error {
	s := NormalizeTicker(symbol)
	if s == "" {
		return fmt.Errorf("invalid ticker format %q (use 1–5 letters, e.g. AAPL)", strings.ToUpper(strings.TrimSpace(symbol)))
	}
	return nil
}

// ValidateSymbolsWithMarket confirms each symbol has recent daily bars from Alpaca.
func ValidateSymbolsWithMarket(ctx context.Context, alpaca *AlpacaClient, symbols []string) error {
	if len(symbols) == 0 {
		return nil
	}
	for _, sym := range symbols {
		if err := ValidateTickerFormat(sym); err != nil {
			return err
		}
	}
	if alpaca == nil || alpaca.Key == "" || alpaca.Secret == "" {
		return fmt.Errorf("market data provider is not configured — cannot verify tickers")
	}

	candles, err := alpaca.FetchDailyBars(ctx, symbols, 14)
	if err != nil {
		if strings.Contains(err.Error(), "0 bars") {
			return fmt.Errorf("unknown or untradable ticker(s): %s", strings.Join(symbols, ", "))
		}
		return fmt.Errorf("market data lookup failed: %w", err)
	}

	counts := make(map[string]int)
	for _, c := range candles {
		counts[strings.ToUpper(c.Symbol)]++
	}

	var missing []string
	for _, sym := range symbols {
		if counts[sym] < 1 {
			missing = append(missing, sym)
		}
	}
	if len(missing) > 0 {
		if len(missing) == 1 {
			return fmt.Errorf("%s is not a recognized US equity ticker (no market data from Alpaca)", missing[0])
		}
		return fmt.Errorf("unknown or untradable ticker(s): %s", strings.Join(missing, ", "))
	}
	return nil
}

// HasTradeableMarketData is true when we have enough price history to score.
func HasTradeableMarketData(candleCount int, hasFeatures bool) bool {
	return candleCount >= 5 || hasFeatures
}

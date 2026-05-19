package catalog

import "strings"

// IsPlaceholderSymbolName reports whether name is empty or just repeats the ticker.
func IsPlaceholderSymbolName(symbol, name string) bool {
	sym := strings.ToUpper(strings.TrimSpace(symbol))
	n := strings.TrimSpace(name)
	if n == "" {
		return true
	}
	return strings.ToUpper(n) == sym
}

// SanitizeName returns a displayable company name, or "" when unknown/placeholder.
func SanitizeName(symbol, name string) string {
	if IsPlaceholderSymbolName(symbol, name) {
		return ""
	}
	return strings.TrimSpace(name)
}

// SanitizeExchange returns a non-empty exchange code or "".
func SanitizeExchange(exchange string) string {
	return strings.TrimSpace(exchange)
}

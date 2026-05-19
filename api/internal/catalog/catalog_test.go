package catalog

import "testing"

func TestIsPlaceholderSymbolName(t *testing.T) {
	tests := []struct {
		symbol, name string
		want         bool
	}{
		{"AAPL", "", true},
		{"AAPL", "AAPL", true},
		{"AAPL", "aapl", true},
		{"AAPL", "Apple Inc.", false},
	}
	for _, tt := range tests {
		if got := IsPlaceholderSymbolName(tt.symbol, tt.name); got != tt.want {
			t.Errorf("IsPlaceholderSymbolName(%q, %q) = %v, want %v", tt.symbol, tt.name, got, tt.want)
		}
	}
}

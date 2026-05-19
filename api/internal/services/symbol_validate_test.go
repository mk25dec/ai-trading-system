package services

import "testing"

func TestNormalizeTicker(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"aapl", "AAPL"},
		{"  IBM ", "IBM"},
		{"BRK.B", "BRK.B"},
		{"ADSFAF", ""},
		{"", ""},
		{"TOOLONGNAME", ""},
	}
	for _, tc := range tests {
		if got := NormalizeTicker(tc.in); got != tc.want {
			t.Fatalf("NormalizeTicker(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestValidateTickerFormat_rejectsJunk(t *testing.T) {
	if err := ValidateTickerFormat("ADSFAF"); err == nil {
		t.Fatal("expected format error for ADSFAF")
	}
}

package services

import (
	"testing"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

func TestParseSECCompanyTickersJSON_parsesEntries(t *testing.T) {
	body := []byte(`{
		"0": {"cik_str": 1045810, "ticker": "NVDA", "title": "NVIDIA CORP"},
		"1": {"cik_str": 789019, "ticker": "MSFT", "title": "MICROSOFT CORP"},
		"2": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."}
	}`)

	got, err := ParseSECCompanyTickersJSON(body)
	if err != nil {
		t.Fatalf("ParseSECCompanyTickersJSON: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("len = %d, want 3", len(got))
	}

	bySym := map[string]models.SECSymbolEntry{}
	for _, e := range got {
		bySym[e.Symbol] = e
	}
	if bySym["NVDA"].Name != "NVIDIA CORP" || bySym["NVDA"].CIK != 1045810 {
		t.Fatalf("NVDA: %+v", bySym["NVDA"])
	}
	if bySym["MSFT"].Symbol != "MSFT" {
		t.Fatalf("MSFT symbol = %q", bySym["MSFT"].Symbol)
	}
}

func TestParseSECCompanyTickersJSON_deduplicatesTickers(t *testing.T) {
	body := []byte(`{
		"0": {"cik_str": 1, "ticker": "DELL", "title": "DELL TECHNOLOGIES INC"},
		"1": {"cik_str": 2, "ticker": "dell", "title": "duplicate"}
	}`)

	got, err := ParseSECCompanyTickersJSON(body)
	if err != nil {
		t.Fatalf("ParseSECCompanyTickersJSON: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("len = %d, want 1", len(got))
	}
	if got[0].Name != "DELL TECHNOLOGIES INC" {
		t.Fatalf("name = %q", got[0].Name)
	}
}

func TestParseSECCompanyTickersJSON_rejectsEmptyPayload(t *testing.T) {
	_, err := ParseSECCompanyTickersJSON([]byte(`{}`))
	if err == nil {
		t.Fatal("expected error for empty payload")
	}
}

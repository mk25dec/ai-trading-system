package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/joeydekruis/ai-trading-system/api/internal/services"
)

func TestFinbertHandler_Analyze_rejectsEmptyText(t *testing.T) {
	h := FinbertHandler{Finbert: &services.FinbertClient{BaseURL: "http://finbert.test"}}
	body, _ := json.Marshal(map[string]string{"text": "   "})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/finbert/analyze", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Analyze(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestFinbertHandler_Analyze_requiresFinbertURL(t *testing.T) {
	h := FinbertHandler{Finbert: &services.FinbertClient{}}
	body, _ := json.Marshal(map[string]string{"text": "Markets rally on strong earnings"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/finbert/analyze", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Analyze(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}

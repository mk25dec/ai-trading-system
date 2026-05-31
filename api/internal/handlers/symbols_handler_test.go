package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSymbolsHandler_SyncSECCompanyTickers_requiresStore(t *testing.T) {
	h := SymbolsHandler{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/symbols/sec/sync", nil)
	rec := httptest.NewRecorder()

	h.SyncSECCompanyTickers(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}

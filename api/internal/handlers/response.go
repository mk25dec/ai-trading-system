package handlers

import (
	"net/http"

	"github.com/joeydekruis/ai-trading-system/api/internal/httputil"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	httputil.WriteJSON(w, status, v)
}

func WriteError(w http.ResponseWriter, status int, msg string) {
	httputil.WriteError(w, status, msg)
}

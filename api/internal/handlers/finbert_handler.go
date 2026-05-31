package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/joeydekruis/ai-trading-system/api/internal/services"
)

const finbertAnalyzeMaxChars = 8192

type FinbertHandler struct {
	Finbert *services.FinbertClient
}

type finbertAnalyzeRequest struct {
	Text string `json:"text"`
}

type finbertAnalyzeResponse struct {
	Label        string             `json:"label"`
	Score        float64            `json:"score"`
	Confidence   float64            `json:"confidence"`
	ProbPositive float64            `json:"probPositive"`
	ProbNegative float64            `json:"probNegative"`
	ProbNeutral  float64            `json:"probNeutral"`
	Scores       map[string]float64 `json:"scores,omitempty"`
}

func (h FinbertHandler) Health(w http.ResponseWriter, r *http.Request) {
	if h.Finbert == nil || h.Finbert.BaseURL == "" {
		WriteError(w, http.StatusServiceUnavailable, "FINBERT_URL not configured on API")
		return
	}

	health, err := h.Finbert.Health(r.Context())
	if err != nil {
		writeFinbertError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, health)
}

func (h FinbertHandler) Analyze(w http.ResponseWriter, r *http.Request) {
	var req finbertAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	text := strings.TrimSpace(req.Text)
	if text == "" {
		WriteError(w, http.StatusBadRequest, "text is required")
		return
	}
	if len(text) > finbertAnalyzeMaxChars {
		WriteError(w, http.StatusBadRequest, fmt.Sprintf("text exceeds %d characters", finbertAnalyzeMaxChars))
		return
	}
	if h.Finbert == nil || h.Finbert.BaseURL == "" {
		WriteError(w, http.StatusServiceUnavailable, "FINBERT_URL not configured on API")
		return
	}

	res, err := h.Finbert.AnalyzeFull(r.Context(), text)
	if err != nil {
		writeFinbertError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, finbertAnalyzeResponse{
		Label:        res.Label,
		Score:        res.Score,
		Confidence:   res.Confidence,
		ProbPositive: res.ProbPositive,
		ProbNegative: res.ProbNegative,
		ProbNeutral:  res.ProbNeutral,
		Scores:       res.Scores,
	})
}

func writeFinbertError(w http.ResponseWriter, err error) {
	var fbErr *services.FinbertError
	if errors.As(err, &fbErr) && fbErr.StatusCode > 0 {
		WriteError(w, fbErr.StatusCode, fbErr.Message)
		return
	}
	WriteError(w, http.StatusBadGateway, err.Error())
}

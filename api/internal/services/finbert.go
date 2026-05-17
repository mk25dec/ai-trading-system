package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type FinbertClient struct {
	BaseURL string
	APIKey  string
	Client  *http.Client
}

type finbertAnalyzeResp struct {
	Label  string             `json:"label"`
	Scores map[string]float64 `json:"scores"`
}

func (c *FinbertClient) Analyze(ctx context.Context, text string) (label string, score float64, confidence float64, err error) {
	if c.BaseURL == "" {
		return "neutral", 0, 0, fmt.Errorf("FINBERT_URL not configured")
	}
	if c.Client == nil {
		c.Client = &http.Client{Timeout: 120 * time.Second}
	}

	body, _ := json.Marshal(map[string]string{"text": strings.TrimSpace(text)})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/analyze", bytes.NewReader(body))
	if err != nil {
		return "", 0, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		req.Header.Set("X-Api-Key", c.APIKey)
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return "", 0, 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", 0, 0, fmt.Errorf("finbert status %d", resp.StatusCode)
	}

	var data finbertAnalyzeResp
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", 0, 0, err
	}

	label = data.Label
	if v, ok := data.Scores[label]; ok {
		confidence = v
	}
	switch label {
	case "positive":
		score = confidence
	case "negative":
		score = -confidence
	default:
		score = 0
		label = "neutral"
	}
	return label, score, confidence, nil
}

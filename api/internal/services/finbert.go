package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type FinbertClient struct {
	BaseURL string
	APIKey  string
	Client  *http.Client
}

type FinbertResult struct {
	Label        string
	Score        float64
	Confidence   float64
	ProbPositive float64
	ProbNegative float64
	ProbNeutral  float64
	Scores       map[string]float64
}

type finbertAnalyzeResp struct {
	Label  string             `json:"label"`
	Scores map[string]float64 `json:"scores"`
}

// FinbertBatchItem is one text to score in a batch request.
type FinbertBatchItem struct {
	ID   string
	Text string
}

type finbertBatchReq struct {
	Items []struct {
		ID   string `json:"id"`
		Text string `json:"text"`
	} `json:"items"`
}

type finbertBatchResp struct {
	Results []struct {
		ID     string             `json:"id"`
		Label  string             `json:"label"`
		Scores map[string]float64 `json:"scores"`
		Error  string             `json:"error"`
	} `json:"results"`
}

func (c *FinbertClient) Analyze(ctx context.Context, text string) (label string, score float64, confidence float64, err error) {
	res, err := c.AnalyzeFull(ctx, text)
	if err != nil {
		return "", 0, 0, err
	}
	return res.Label, res.Score, res.Confidence, nil
}

func (c *FinbertClient) AnalyzeFull(ctx context.Context, text string) (FinbertResult, error) {
	if c.BaseURL == "" {
		return FinbertResult{}, fmt.Errorf("FINBERT_URL not configured")
	}
	if c.Client == nil {
		c.Client = &http.Client{Timeout: 120 * time.Second}
	}

	body, _ := json.Marshal(map[string]string{"text": strings.TrimSpace(text)})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/analyze", bytes.NewReader(body))
	if err != nil {
		return FinbertResult{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		req.Header.Set("X-Api-Key", c.APIKey)
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return FinbertResult{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return FinbertResult{}, fmt.Errorf("finbert status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var data finbertAnalyzeResp
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return FinbertResult{}, err
	}

	return finbertResultFromResponse(data), nil
}

// AnalyzeBatch scores up to 32 texts in one HTTP call (FinBERT API /analyze/batch).
func (c *FinbertClient) AnalyzeBatch(ctx context.Context, items []FinbertBatchItem) (map[string]FinbertResult, error) {
	out := make(map[string]FinbertResult)
	if len(items) == 0 {
		return out, nil
	}
	if c.BaseURL == "" {
		return nil, fmt.Errorf("FINBERT_URL not configured")
	}
	if c.Client == nil {
		c.Client = &http.Client{Timeout: 180 * time.Second}
	}

	reqBody := finbertBatchReq{Items: make([]struct {
		ID   string `json:"id"`
		Text string `json:"text"`
	}, 0, len(items))}
	for _, it := range items {
		reqBody.Items = append(reqBody.Items, struct {
			ID   string `json:"id"`
			Text string `json:"text"`
		}{ID: it.ID, Text: strings.TrimSpace(it.Text)})
	}

	body, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/analyze/batch", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		req.Header.Set("X-Api-Key", c.APIKey)
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("finbert batch status %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}

	var data finbertBatchResp
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	for _, r := range data.Results {
		if r.Error != "" || r.Label == "" {
			continue
		}
		out[r.ID] = finbertResultFromResponse(finbertAnalyzeResp{Label: r.Label, Scores: r.Scores})
	}
	return out, nil
}

func finbertResultFromResponse(data finbertAnalyzeResp) FinbertResult {
	pos := data.Scores["positive"]
	neg := data.Scores["negative"]
	neu := data.Scores["neutral"]

	label := data.Label
	confidence := data.Scores[label]
	if confidence == 0 && len(data.Scores) > 0 {
		for k, v := range data.Scores {
			if v > confidence {
				label = k
				confidence = v
			}
		}
	}

	score := 0.0
	switch label {
	case "positive":
		score = confidence
	case "negative":
		score = -confidence
	default:
		label = "neutral"
	}

	return FinbertResult{
		Label:        label,
		Score:        score,
		Confidence:   confidence,
		ProbPositive: pos,
		ProbNegative: neg,
		ProbNeutral:  neu,
		Scores:       data.Scores,
	}
}

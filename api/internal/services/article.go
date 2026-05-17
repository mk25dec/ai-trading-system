package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

var (
	scriptTagRe = regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`)
	styleTagRe  = regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`)
	htmlTagRe   = regexp.MustCompile(`(?s)<[^>]+>`)
	spaceRe     = regexp.MustCompile(`\s+`)
)

func CanonicalURL(raw string) string {
	u := strings.TrimSpace(raw)
	u = strings.TrimSuffix(u, "/")
	if idx := strings.Index(u, "#"); idx >= 0 {
		u = u[:idx]
	}
	return u
}

func TextHash(text string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(text)))
	return hex.EncodeToString(sum[:])
}

func FetchAndCleanArticle(ctx context.Context, url string, client *http.Client) (raw string, cleaned string, err error) {
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("User-Agent", "TradingAI-Bot/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return "", "", err
	}
	raw = string(body)
	cleaned = CleanHTMLText(raw)
	return raw, cleaned, nil
}

func CleanHTMLText(html string) string {
	s := scriptTagRe.ReplaceAllString(html, " ")
	s = styleTagRe.ReplaceAllString(s, " ")
	s = htmlTagRe.ReplaceAllString(s, " ")
	s = strings.ReplaceAll(s, "&nbsp;", " ")
	s = spaceRe.ReplaceAllString(s, " ")
	return strings.TrimSpace(s)
}

func ExcerptForSentiment(title, body string, maxLen int) string {
	if maxLen <= 0 {
		maxLen = 1500
	}
	combined := strings.TrimSpace(title) + "\n\n" + strings.TrimSpace(body)
	if len(combined) <= maxLen {
		return combined
	}
	return combined[:maxLen]
}

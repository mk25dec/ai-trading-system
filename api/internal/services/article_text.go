package services

import "strings"

// FinBERT tokenizer limit is 512 tokens; ~4 chars/token is a safe pre-check for full body.
const finbertFullTextMaxChars = 512 * 4

// TextForFinBERT picks title-only, excerpt, or full cleaned text for FinBERT input.
func TextForFinBERT(title, cleaned string) (text string, inputMode string) {
	title = strings.TrimSpace(title)
	cleaned = strings.TrimSpace(cleaned)

	if cleaned == "" {
		if title == "" {
			return "", "title_only"
		}
		return title, "title_only"
	}

	combined := title
	if title != "" {
		combined = title + "\n\n" + cleaned
	} else {
		combined = cleaned
	}

	if len(cleaned) <= finbertFullTextMaxChars {
		if len(combined) > 8192 {
			combined = combined[:8192]
		}
		return combined, "full_text"
	}

	return ExcerptForSentiment(title, cleaned, 1500), "excerpt"
}

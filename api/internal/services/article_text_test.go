package services

import (
	"strings"
	"testing"
)

func TestTextForFinBERT_titleOnly(t *testing.T) {
	text, mode := TextForFinBERT("Markets rise", "")
	if mode != "title_only" || text != "Markets rise" {
		t.Fatalf("got %q %q", text, mode)
	}
}

func TestTextForFinBERT_fullTextShortBody(t *testing.T) {
	body := strings.Repeat("word ", 100)
	text, mode := TextForFinBERT("Headline", body)
	if mode != "full_text" {
		t.Fatalf("expected full_text, got %s", mode)
	}
	if !strings.Contains(text, "Headline") {
		t.Fatal("expected title in text")
	}
}

func TestTextForFinBERT_excerptLongBody(t *testing.T) {
	body := strings.Repeat("x", finbertFullTextMaxChars+100)
	_, mode := TextForFinBERT("H", body)
	if mode != "excerpt" {
		t.Fatalf("expected excerpt, got %s", mode)
	}
}

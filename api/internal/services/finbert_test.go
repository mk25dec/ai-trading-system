package services

import (
	"net/http"
	"testing"
)

func TestFinbertHTTPError_maps503ToLoadingMessage(t *testing.T) {
	err := finbertHTTPError(http.StatusServiceUnavailable, nil)
	fbErr, ok := err.(*FinbertError)
	if !ok {
		t.Fatalf("expected *FinbertError, got %T", err)
	}
	if fbErr.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status = %d", fbErr.StatusCode)
	}
	if fbErr.Message == "" {
		t.Fatal("expected loading message")
	}
}

func TestFinbertHTTPError_preservesBody(t *testing.T) {
	err := finbertHTTPError(http.StatusBadRequest, []byte("invalid text"))
	fbErr := err.(*FinbertError)
	if fbErr.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d", fbErr.StatusCode)
	}
	if fbErr.Message == "" {
		t.Fatal("expected message with body")
	}
}

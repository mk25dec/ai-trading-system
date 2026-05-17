package middleware

import (
	"net/http"
	"strings"
)

func RequireInternalKey(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if secret == "" {
				http.Error(w, `{"error":"internal API not configured"}`, http.StatusServiceUnavailable)
				return
			}
			key := r.Header.Get("X-Internal-Api-Key")
			if key == "" {
				auth := r.Header.Get("Authorization")
				if strings.HasPrefix(auth, "Bearer ") {
					key = strings.TrimPrefix(auth, "Bearer ")
				}
			}
			if key != secret {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

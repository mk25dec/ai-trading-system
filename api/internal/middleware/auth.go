package middleware

import (
	"context"
	"net/http"

	"github.com/joeydekruis/ai-trading-system/api/internal/auth"
	"github.com/joeydekruis/ai-trading-system/api/internal/httputil"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

type contextKey string

const userContextKey contextKey = "user"

func UserFromContext(ctx context.Context) *models.User {
	u, _ := ctx.Value(userContextKey).(*models.User)
	return u
}

type UserLoader func(ctx context.Context, userID string) (*models.User, error)

func RequireAuth(jwtSecret string, load UserLoader) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(auth.SessionCookieName())
			if err != nil {
				httputil.WriteError(w, http.StatusUnauthorized, "not authenticated")
				return
			}
			claims, err := auth.ParseToken(jwtSecret, cookie.Value)
			if err != nil {
				httputil.WriteError(w, http.StatusUnauthorized, "invalid session")
				return
			}
			user, err := load(r.Context(), claims.UserID)
			if err != nil || user == nil || !user.Active {
				httputil.WriteError(w, http.StatusUnauthorized, "user not found")
				return
			}
			ctx := context.WithValue(r.Context(), userContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequirePlatformAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		if user == nil || user.PlatformRole != models.PlatformRoleAdmin {
			httputil.WriteError(w, http.StatusForbidden, "admin required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

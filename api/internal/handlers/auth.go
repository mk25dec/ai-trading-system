package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/joeydekruis/ai-trading-system/api/internal/auth"
	"github.com/joeydekruis/ai-trading-system/api/internal/middleware"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

type AuthHandler struct {
	Users         *store.UserStore
	JWTSecret     string
	SecureCookies bool
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if req.Email == "" || req.Password == "" {
		WriteError(w, http.StatusBadRequest, "email and password required")
		return
	}

	user, hash, err := h.Users.GetByEmail(r.Context(), req.Email)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "login failed")
		return
	}
	if user == nil || !user.Active || !auth.CheckPassword(hash, req.Password) {
		WriteError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := auth.IssueToken(h.JWTSecret, user.ID, user.Email, string(user.PlatformRole), 7*24*time.Hour)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "session error")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     auth.SessionCookieName(),
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   h.SecureCookies,
		MaxAge:   int((7 * 24 * time.Hour).Seconds()),
	})
	writeJSON(w, http.StatusOK, user)
}

func (h AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.SessionCookieName(),
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
		Secure:   h.SecureCookies,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (h AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	user := middleware.UserFromContext(r.Context())
	writeJSON(w, http.StatusOK, user)
}

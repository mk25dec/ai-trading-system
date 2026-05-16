package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/joeydekruis/ai-trading-system/api/internal/auth"
	"github.com/joeydekruis/ai-trading-system/api/internal/middleware"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

type UserHandler struct {
	Users *store.UserStore
}

type createUserRequest struct {
	Email        string              `json:"email"`
	Password     string              `json:"password"`
	Name         string              `json:"name"`
	PlatformRole models.PlatformRole `json:"platformRole"`
}

type updateUserRequest struct {
	Name         string              `json:"name"`
	PlatformRole models.PlatformRole `json:"platformRole"`
	Active       bool                `json:"active"`
	Password     *string             `json:"password,omitempty"`
}

type userLookup struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

func (h UserHandler) Lookup(w http.ResponseWriter, r *http.Request) {
	users, err := h.Users.List(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	out := make([]userLookup, 0, len(users))
	for _, u := range users {
		if !u.Active {
			continue
		}
		out = append(out, userLookup{ID: u.ID, Email: u.Email, Name: u.Name})
	}
	writeJSON(w, http.StatusOK, out)
}

func (h UserHandler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.Users.List(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	if users == nil {
		users = []models.User{}
	}
	writeJSON(w, http.StatusOK, users)
}

func (h UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if req.Email == "" || req.Password == "" {
		WriteError(w, http.StatusBadRequest, "email and password required")
		return
	}
	if req.PlatformRole == "" {
		req.PlatformRole = models.PlatformRoleUser
	}
	if req.PlatformRole != models.PlatformRoleAdmin && req.PlatformRole != models.PlatformRoleUser {
		WriteError(w, http.StatusBadRequest, "invalid platform role")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	user, err := h.Users.Create(r.Context(), req.Email, req.Name, hash, req.PlatformRole)
	if err != nil {
		WriteError(w, http.StatusConflict, "could not create user")
		return
	}
	writeJSON(w, http.StatusCreated, user)
}

func (h UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	current := middleware.UserFromContext(r.Context())
	if current.ID == id && current.PlatformRole == models.PlatformRoleAdmin {
		// allow self-update via admin routes
	}

	var req updateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if req.PlatformRole != "" && req.PlatformRole != models.PlatformRoleAdmin && req.PlatformRole != models.PlatformRoleUser {
		WriteError(w, http.StatusBadRequest, "invalid platform role")
		return
	}
	role := req.PlatformRole
	if role == "" {
		existing, err := h.Users.GetByID(r.Context(), id)
		if err != nil || existing == nil {
			WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		role = existing.PlatformRole
	}

	user, err := h.Users.Update(r.Context(), id, req.Name, role, req.Active)
	if err != nil {
		WriteError(w, http.StatusNotFound, "user not found")
		return
	}
	if req.Password != nil && *req.Password != "" {
		hash, err := auth.HashPassword(*req.Password)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, "failed to hash password")
			return
		}
		if err := h.Users.UpdatePassword(r.Context(), id, hash); err != nil {
			WriteError(w, http.StatusInternalServerError, "failed to update password")
			return
		}
	}
	writeJSON(w, http.StatusOK, user)
}

func (h UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	current := middleware.UserFromContext(r.Context())
	if current.ID == id {
		WriteError(w, http.StatusBadRequest, "cannot delete yourself")
		return
	}
	if err := h.Users.Delete(r.Context(), id); err != nil {
		WriteError(w, http.StatusNotFound, "user not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

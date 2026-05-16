package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/joeydekruis/ai-trading-system/api/internal/middleware"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

type WorkspaceHandler struct {
	Workspaces *store.WorkspaceStore
}

type createWorkspaceRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type updateWorkspaceRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

func normalizeSlug(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, " ", "-")
	return s
}

func (h WorkspaceHandler) List(w http.ResponseWriter, r *http.Request) {
	user := middleware.UserFromContext(r.Context())
	isAdmin := user.PlatformRole == models.PlatformRoleAdmin
	list, err := h.Workspaces.ListForUser(r.Context(), user.ID, isAdmin)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list workspaces")
		return
	}
	if list == nil {
		list = []models.WorkspaceWithRole{}
	}
	writeJSON(w, http.StatusOK, list)
}

func (h WorkspaceHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := middleware.UserFromContext(r.Context())
	if !h.canAccess(r, id, user) {
		WriteError(w, http.StatusForbidden, "access denied")
		return
	}
	ws, err := h.Workspaces.GetByID(r.Context(), id)
	if err != nil || ws == nil {
		WriteError(w, http.StatusNotFound, "workspace not found")
		return
	}
	writeJSON(w, http.StatusOK, ws)
}

func (h WorkspaceHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createWorkspaceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Slug = normalizeSlug(req.Slug)
	if req.Name == "" || req.Slug == "" {
		WriteError(w, http.StatusBadRequest, "name and slug required")
		return
	}
	if !slugPattern.MatchString(req.Slug) {
		WriteError(w, http.StatusBadRequest, "slug must be lowercase alphanumeric with hyphens")
		return
	}

	user := middleware.UserFromContext(r.Context())
	ws, err := h.Workspaces.Create(r.Context(), req.Name, req.Slug, user.ID)
	if err != nil {
		WriteError(w, http.StatusConflict, "could not create workspace")
		return
	}
	writeJSON(w, http.StatusCreated, ws)
}

func (h WorkspaceHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := middleware.UserFromContext(r.Context())
	role, ok, err := h.memberRole(r, id, user)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "access check failed")
		return
	}
	if !ok && user.PlatformRole != models.PlatformRoleAdmin {
		WriteError(w, http.StatusForbidden, "access denied")
		return
	}
	if ok && !store.CanManageWorkspace(role) && user.PlatformRole != models.PlatformRoleAdmin {
		WriteError(w, http.StatusForbidden, "admin required")
		return
	}

	var req updateWorkspaceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	req.Slug = normalizeSlug(req.Slug)
	if req.Name == "" || req.Slug == "" || !slugPattern.MatchString(req.Slug) {
		WriteError(w, http.StatusBadRequest, "invalid name or slug")
		return
	}

	ws, err := h.Workspaces.Update(r.Context(), id, req.Name, req.Slug)
	if err != nil {
		WriteError(w, http.StatusNotFound, "workspace not found")
		return
	}
	writeJSON(w, http.StatusOK, ws)
}

func (h WorkspaceHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user := middleware.UserFromContext(r.Context())
	role, ok, err := h.memberRole(r, id, user)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "access check failed")
		return
	}
	if role != models.WorkspaceRoleOwner && user.PlatformRole != models.PlatformRoleAdmin {
		WriteError(w, http.StatusForbidden, "owner required")
		return
	}
	if !ok && user.PlatformRole != models.PlatformRoleAdmin {
		WriteError(w, http.StatusForbidden, "access denied")
		return
	}

	if err := h.Workspaces.Delete(r.Context(), id); err != nil {
		WriteError(w, http.StatusNotFound, "workspace not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h WorkspaceHandler) canAccess(r *http.Request, workspaceID string, user *models.User) bool {
	if user.PlatformRole == models.PlatformRoleAdmin {
		return true
	}
	_, ok, err := h.Workspaces.GetMemberRole(r.Context(), workspaceID, user.ID)
	return err == nil && ok
}

func (h WorkspaceHandler) memberRole(r *http.Request, workspaceID string, user *models.User) (models.WorkspaceRole, bool, error) {
	if user.PlatformRole == models.PlatformRoleAdmin {
		return models.WorkspaceRoleOwner, true, nil
	}
	return h.Workspaces.GetMemberRole(r.Context(), workspaceID, user.ID)
}

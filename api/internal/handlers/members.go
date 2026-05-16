package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/joeydekruis/ai-trading-system/api/internal/middleware"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

type MemberHandler struct {
	Workspaces *store.WorkspaceStore
	Users      *store.UserStore
}

type addMemberRequest struct {
	UserID string              `json:"userId"`
	Role   models.WorkspaceRole `json:"role"`
}

type updateMemberRequest struct {
	Role models.WorkspaceRole `json:"role"`
}

func (h MemberHandler) List(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "id")
	user := middleware.UserFromContext(r.Context())
	if !h.canView(r, workspaceID, user) {
		WriteError(w, http.StatusForbidden, "access denied")
		return
	}

	members, err := h.Workspaces.ListMembers(r.Context(), workspaceID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "failed to list members")
		return
	}
	if members == nil {
		members = []models.WorkspaceMember{}
	}
	writeJSON(w, http.StatusOK, members)
}

func (h MemberHandler) Add(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "id")
	user := middleware.UserFromContext(r.Context())
	if !h.canManage(r, workspaceID, user) {
		WriteError(w, http.StatusForbidden, "admin required")
		return
	}

	var req addMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if req.UserID == "" {
		WriteError(w, http.StatusBadRequest, "userId required")
		return
	}
	if req.Role == "" {
		req.Role = models.WorkspaceRoleMember
	}
	if !validWorkspaceRole(req.Role) {
		WriteError(w, http.StatusBadRequest, "invalid role")
		return
	}

	target, err := h.Users.GetByID(r.Context(), req.UserID)
	if err != nil || target == nil {
		WriteError(w, http.StatusNotFound, "user not found")
		return
	}

	member, err := h.Workspaces.AddMember(r.Context(), workspaceID, req.UserID, req.Role)
	if err != nil {
		WriteError(w, http.StatusConflict, "could not add member")
		return
	}
	member.User = target
	writeJSON(w, http.StatusCreated, member)
}

func (h MemberHandler) Update(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "id")
	userID := chi.URLParam(r, "userId")
	user := middleware.UserFromContext(r.Context())
	if !h.canManage(r, workspaceID, user) {
		WriteError(w, http.StatusForbidden, "admin required")
		return
	}

	var req updateMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if !validWorkspaceRole(req.Role) {
		WriteError(w, http.StatusBadRequest, "invalid role")
		return
	}

	if err := h.Workspaces.UpdateMemberRole(r.Context(), workspaceID, userID, req.Role); err != nil {
		WriteError(w, http.StatusNotFound, "member not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h MemberHandler) Remove(w http.ResponseWriter, r *http.Request) {
	workspaceID := chi.URLParam(r, "id")
	userID := chi.URLParam(r, "userId")
	user := middleware.UserFromContext(r.Context())
	if !h.canManage(r, workspaceID, user) {
		WriteError(w, http.StatusForbidden, "admin required")
		return
	}

	role, ok, _ := h.Workspaces.GetMemberRole(r.Context(), workspaceID, userID)
	if ok && role == models.WorkspaceRoleOwner {
		WriteError(w, http.StatusBadRequest, "cannot remove workspace owner")
		return
	}

	if err := h.Workspaces.RemoveMember(r.Context(), workspaceID, userID); err != nil {
		WriteError(w, http.StatusNotFound, "member not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func validWorkspaceRole(r models.WorkspaceRole) bool {
	return r == models.WorkspaceRoleOwner || r == models.WorkspaceRoleAdmin || r == models.WorkspaceRoleMember
}

func (h MemberHandler) canView(r *http.Request, workspaceID string, user *models.User) bool {
	if user.PlatformRole == models.PlatformRoleAdmin {
		return true
	}
	_, ok, _ := h.Workspaces.GetMemberRole(r.Context(), workspaceID, user.ID)
	return ok
}

func (h MemberHandler) canManage(r *http.Request, workspaceID string, user *models.User) bool {
	if user.PlatformRole == models.PlatformRoleAdmin {
		return true
	}
	role, ok, _ := h.Workspaces.GetMemberRole(r.Context(), workspaceID, user.ID)
	return ok && store.CanManageWorkspace(role)
}

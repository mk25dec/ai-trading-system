package models

import "time"

type PlatformRole string

const (
	PlatformRoleAdmin PlatformRole = "admin"
	PlatformRoleUser  PlatformRole = "user"
)

type WorkspaceRole string

const (
	WorkspaceRoleOwner  WorkspaceRole = "owner"
	WorkspaceRoleAdmin  WorkspaceRole = "admin"
	WorkspaceRoleMember WorkspaceRole = "member"
)

type User struct {
	ID           string       `json:"id"`
	Email        string       `json:"email"`
	Name         string       `json:"name"`
	PlatformRole PlatformRole `json:"platformRole"`
	Active       bool         `json:"active"`
	CreatedAt    time.Time    `json:"createdAt"`
	UpdatedAt    time.Time    `json:"updatedAt"`
}

type Workspace struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type WorkspaceMember struct {
	WorkspaceID string        `json:"workspaceId"`
	UserID      string        `json:"userId"`
	Role        WorkspaceRole `json:"role"`
	CreatedAt   time.Time     `json:"createdAt"`
	User        *User         `json:"user,omitempty"`
}

type WorkspaceWithRole struct {
	Workspace
	Role WorkspaceRole `json:"role"`
}

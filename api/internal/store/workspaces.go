package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

type WorkspaceStore struct {
	pool *pgxpool.Pool
}

func NewWorkspaceStore(pool *pgxpool.Pool) *WorkspaceStore {
	return &WorkspaceStore{pool: pool}
}

func scanWorkspace(row pgx.Row) (*models.Workspace, error) {
	var w models.Workspace
	err := row.Scan(&w.ID, &w.Name, &w.Slug, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &w, nil
}

const workspaceColumns = `id, name, slug, created_at, updated_at`

func (s *WorkspaceStore) GetByID(ctx context.Context, id string) (*models.Workspace, error) {
	row := s.pool.QueryRow(ctx, `SELECT `+workspaceColumns+` FROM workspaces WHERE id = $1`, id)
	w, err := scanWorkspace(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return w, err
}

func (s *WorkspaceStore) GetMemberRole(ctx context.Context, workspaceID, userID string) (models.WorkspaceRole, bool, error) {
	var role string
	err := s.pool.QueryRow(ctx, `
		SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
		workspaceID, userID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return models.WorkspaceRole(role), true, nil
}

func (s *WorkspaceStore) ListForUser(ctx context.Context, userID string, platformAdmin bool) ([]models.WorkspaceWithRole, error) {
	var rows pgx.Rows
	var err error
	if platformAdmin {
		rows, err = s.pool.Query(ctx, `
			SELECT w.id, w.name, w.slug, w.created_at, w.updated_at,
			       COALESCE(m.role, '') AS role
			FROM workspaces w
			LEFT JOIN workspace_members m ON m.workspace_id = w.id AND m.user_id = $1
			ORDER BY w.name ASC`, userID)
	} else {
		rows, err = s.pool.Query(ctx, `
			SELECT w.id, w.name, w.slug, w.created_at, w.updated_at, m.role
			FROM workspaces w
			INNER JOIN workspace_members m ON m.workspace_id = w.id
			WHERE m.user_id = $1
			ORDER BY w.name ASC`, userID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.WorkspaceWithRole
	for rows.Next() {
		var item models.WorkspaceWithRole
		var role string
		err := rows.Scan(&item.ID, &item.Name, &item.Slug, &item.CreatedAt, &item.UpdatedAt, &role)
		if err != nil {
			return nil, err
		}
		item.Role = models.WorkspaceRole(role)
		list = append(list, item)
	}
	return list, rows.Err()
}

func (s *WorkspaceStore) Create(ctx context.Context, name, slug, ownerUserID string) (*models.Workspace, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var w models.Workspace
	err = tx.QueryRow(ctx, `
		INSERT INTO workspaces (name, slug) VALUES ($1, $2)
		RETURNING `+workspaceColumns, name, slug).Scan(&w.ID, &w.Name, &w.Slug, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO workspace_members (workspace_id, user_id, role)
		VALUES ($1, $2, 'owner')`, w.ID, ownerUserID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &w, nil
}

func (s *WorkspaceStore) Update(ctx context.Context, id, name, slug string) (*models.Workspace, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE workspaces SET name = $2, slug = $3, updated_at = NOW()
		WHERE id = $1
		RETURNING `+workspaceColumns, id, name, slug)
	w, err := scanWorkspace(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("workspace not found")
	}
	return w, err
}

func (s *WorkspaceStore) Delete(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM workspaces WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("workspace not found")
	}
	return nil
}

func (s *WorkspaceStore) ListMembers(ctx context.Context, workspaceID string) ([]models.WorkspaceMember, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT m.workspace_id, m.user_id, m.role, m.created_at,
		       u.id, u.email, u.name, u.platform_role, u.active, u.created_at, u.updated_at
		FROM workspace_members m
		INNER JOIN users u ON u.id = m.user_id
		WHERE m.workspace_id = $1
		ORDER BY m.created_at ASC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []models.WorkspaceMember
	for rows.Next() {
		var m models.WorkspaceMember
		var role, platformRole string
		var u models.User
		err := rows.Scan(
			&m.WorkspaceID, &m.UserID, &role, &m.CreatedAt,
			&u.ID, &u.Email, &u.Name, &platformRole, &u.Active, &u.CreatedAt, &u.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		m.Role = models.WorkspaceRole(role)
		u.PlatformRole = models.PlatformRole(platformRole)
		m.User = &u
		members = append(members, m)
	}
	return members, rows.Err()
}

func (s *WorkspaceStore) AddMember(ctx context.Context, workspaceID, userID string, role models.WorkspaceRole) (*models.WorkspaceMember, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO workspace_members (workspace_id, user_id, role)
		VALUES ($1, $2, $3)
		RETURNING workspace_id, user_id, role, created_at`,
		workspaceID, userID, string(role))
	var m models.WorkspaceMember
	var r string
	err := row.Scan(&m.WorkspaceID, &m.UserID, &r, &m.CreatedAt)
	if err != nil {
		return nil, err
	}
	m.Role = models.WorkspaceRole(r)
	return &m, nil
}

func (s *WorkspaceStore) UpdateMemberRole(ctx context.Context, workspaceID, userID string, role models.WorkspaceRole) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE workspace_members SET role = $3
		WHERE workspace_id = $1 AND user_id = $2`,
		workspaceID, userID, string(role))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("member not found")
	}
	return nil
}

func (s *WorkspaceStore) RemoveMember(ctx context.Context, workspaceID, userID string) error {
	tag, err := s.pool.Exec(ctx, `
		DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
		workspaceID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("member not found")
	}
	return nil
}

func CanManageWorkspace(role models.WorkspaceRole) bool {
	return role == models.WorkspaceRoleOwner || role == models.WorkspaceRoleAdmin
}

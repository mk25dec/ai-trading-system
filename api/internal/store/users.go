package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

type UserStore struct {
	pool *pgxpool.Pool
}

func NewUserStore(pool *pgxpool.Pool) *UserStore {
	return &UserStore{pool: pool}
}

func scanUser(row pgx.Row) (*models.User, error) {
	var u models.User
	var role string
	err := row.Scan(&u.ID, &u.Email, &u.Name, &role, &u.Active, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	u.PlatformRole = models.PlatformRole(role)
	return &u, nil
}

const userColumns = `id, email, name, platform_role, active, created_at, updated_at`

func (s *UserStore) Count(ctx context.Context) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

func (s *UserStore) GetByID(ctx context.Context, id string) (*models.User, error) {
	row := s.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return u, err
}

func (s *UserStore) GetByEmail(ctx context.Context, email string) (*models.User, string, error) {
	var hash string
	row := s.pool.QueryRow(ctx, `
		SELECT id, email, name, platform_role, active, created_at, updated_at, password_hash
		FROM users WHERE email = $1`, email)
	var u models.User
	var role string
	err := row.Scan(&u.ID, &u.Email, &u.Name, &role, &u.Active, &u.CreatedAt, &u.UpdatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", nil
	}
	if err != nil {
		return nil, "", err
	}
	u.PlatformRole = models.PlatformRole(role)
	return &u, hash, nil
}

func (s *UserStore) List(ctx context.Context) ([]models.User, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+userColumns+` FROM users ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, *u)
	}
	return users, rows.Err()
}

func (s *UserStore) Create(ctx context.Context, email, name, passwordHash string, role models.PlatformRole) (*models.User, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO users (email, name, password_hash, platform_role)
		VALUES ($1, $2, $3, $4)
		RETURNING `+userColumns, email, name, passwordHash, string(role))
	return scanUser(row)
}

func (s *UserStore) Update(ctx context.Context, id, name string, role models.PlatformRole, active bool) (*models.User, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE users SET name = $2, platform_role = $3, active = $4, updated_at = NOW()
		WHERE id = $1
		RETURNING `+userColumns, id, name, string(role), active)
	u, err := scanUser(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("user not found")
	}
	return u, err
}

func (s *UserStore) UpdatePassword(ctx context.Context, id, passwordHash string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, id, passwordHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

func (s *UserStore) Delete(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

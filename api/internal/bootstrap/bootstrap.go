package bootstrap

import (
	"context"
	"log/slog"

	"github.com/joeydekruis/ai-trading-system/api/internal/auth"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

func EnsureAdmin(ctx context.Context, users *store.UserStore, email, password string) {
	if email == "" || password == "" {
		slog.Warn("ADMIN_EMAIL or ADMIN_PASSWORD not set; skipping bootstrap admin")
		return
	}

	count, err := users.Count(ctx)
	if err != nil {
		slog.Error("bootstrap count users", "err", err)
		return
	}
	if count > 0 {
		return
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		slog.Error("bootstrap hash password", "err", err)
		return
	}

	user, err := users.Create(ctx, email, "Platform Admin", hash, models.PlatformRoleAdmin)
	if err != nil {
		slog.Error("bootstrap create admin", "err", err)
		return
	}
	slog.Info("created bootstrap platform admin", "email", user.Email, "id", user.ID)
}

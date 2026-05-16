package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	appmw "github.com/joeydekruis/ai-trading-system/api/internal/middleware"
	"github.com/joeydekruis/ai-trading-system/api/internal/bootstrap"
	"github.com/joeydekruis/ai-trading-system/api/internal/config"
	"github.com/joeydekruis/ai-trading-system/api/internal/db"
	"github.com/joeydekruis/ai-trading-system/api/internal/handlers"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}

	ctx := context.Background()
	pool, err := db.ConnectWithRetry(ctx, cfg.DatabaseURL, 30, 2*time.Second)
	if err != nil {
		slog.Error("database connect", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		slog.Error("migrate", "err", err)
		os.Exit(1)
	}

	users := store.NewUserStore(pool)
	workspaces := store.NewWorkspaceStore(pool)
	bootstrap.EnsureAdmin(ctx, users, cfg.AdminEmail, cfg.AdminPassword)

	authHandler := handlers.AuthHandler{Users: users, JWTSecret: cfg.JWTSecret, SecureCookies: cfg.SecureCookies}
	userHandler := handlers.UserHandler{Users: users}
	workspaceHandler := handlers.WorkspaceHandler{Workspaces: workspaces}
	memberHandler := handlers.MemberHandler{Workspaces: workspaces, Users: users}

	loadUser := func(ctx context.Context, id string) (*models.User, error) {
		return users.GetByID(ctx, id)
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	r.Get("/health", handlers.HealthHandler{}.ServeHTTP)

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   []string{cfg.CORSOrigin},
			AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
			AllowCredentials: true,
			MaxAge:           300,
		}))

		r.Post("/auth/login", authHandler.Login)
		r.Post("/auth/logout", authHandler.Logout)

		r.Group(func(r chi.Router) {
			r.Use(appmw.RequireAuth(cfg.JWTSecret, loadUser))
			r.Get("/auth/me", authHandler.Me)

			r.Get("/users/lookup", userHandler.Lookup)

			r.Route("/users", func(r chi.Router) {
				r.Use(appmw.RequirePlatformAdmin)
				r.Get("/", userHandler.List)
				r.Post("/", userHandler.Create)
				r.Patch("/{id}", userHandler.Update)
				r.Delete("/{id}", userHandler.Delete)
			})

			r.Route("/workspaces", func(r chi.Router) {
				r.Get("/", workspaceHandler.List)
				r.Post("/", workspaceHandler.Create)
				r.Get("/{id}", workspaceHandler.Get)
				r.Patch("/{id}", workspaceHandler.Update)
				r.Delete("/{id}", workspaceHandler.Delete)

				r.Get("/{id}/members", memberHandler.List)
				r.Post("/{id}/members", memberHandler.Add)
				r.Patch("/{id}/members/{userId}", memberHandler.Update)
				r.Delete("/{id}/members/{userId}", memberHandler.Remove)
			})
		})
	})

	addr := fmt.Sprintf(":%d", cfg.Port)
	server := &http.Server{Addr: addr, Handler: r}

	go func() {
		slog.Info("api listening", "addr", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server", "err", err)
			os.Exit(1)
		}
	}()

	slog.Info("api ready")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
}

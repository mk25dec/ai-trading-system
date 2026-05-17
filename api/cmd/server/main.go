package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
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
	"github.com/joeydekruis/ai-trading-system/api/internal/httputil"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}

	var ready atomic.Bool

	apiRouter := chi.NewRouter()
	apiRouter.Use(middleware.RequestID)
	apiRouter.Use(middleware.RealIP)
	apiRouter.Use(middleware.Recoverer)
	apiRouter.Use(middleware.Timeout(60 * time.Second))

	root := chi.NewRouter()
	root.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		status := "starting"
		if ready.Load() {
			status = "ok"
		}
		httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": status})
	})
	root.Mount("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !ready.Load() {
			httputil.WriteError(w, http.StatusServiceUnavailable, "api starting")
			return
		}
		apiRouter.ServeHTTP(w, r)
	}))

	addr := fmt.Sprintf(":%d", cfg.Port)
	server := &http.Server{Addr: addr, Handler: root}

	go func() {
		slog.Info("api listening", "addr", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server", "err", err)
			os.Exit(1)
		}
	}()

	go initDatabase(context.Background(), cfg, apiRouter, &ready)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
}

func initDatabase(ctx context.Context, cfg config.Config, apiRouter chi.Router, ready *atomic.Bool) {
	const delay = 5 * time.Second

	for attempt := 1; ; attempt++ {
		pool, err := db.ConnectWithRetry(ctx, cfg.DatabaseURL, 30, 2*time.Second)
		if err != nil {
			slog.Error("database connect", "attempt", attempt, "err", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(delay):
				continue
			}
		}

		if err := db.Migrate(ctx, pool); err != nil {
			pool.Close()
			slog.Error("migrate", "attempt", attempt, "err", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(delay):
				continue
			}
		}

		registerAPIRoutes(apiRouter, cfg, pool)
		ready.Store(true)
		slog.Info("api ready")
		return
	}
}

func registerAPIRoutes(r chi.Router, cfg config.Config, pool *pgxpool.Pool) {
	users := store.NewUserStore(pool)
	workspaces := store.NewWorkspaceStore(pool)
	bootstrap.EnsureAdmin(context.Background(), users, cfg.AdminEmail, cfg.AdminPassword)

	authHandler := handlers.AuthHandler{Users: users, JWTSecret: cfg.JWTSecret, SecureCookies: cfg.SecureCookies}
	userHandler := handlers.UserHandler{Users: users}
	workspaceHandler := handlers.WorkspaceHandler{Workspaces: workspaces}
	memberHandler := handlers.MemberHandler{Workspaces: workspaces, Users: users}

	loadUser := func(ctx context.Context, id string) (*models.User, error) {
		return users.GetByID(ctx, id)
	}

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
}

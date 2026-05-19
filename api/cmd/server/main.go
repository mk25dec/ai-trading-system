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
	"github.com/joeydekruis/ai-trading-system/api/internal/duckdbstore"
	"github.com/joeydekruis/ai-trading-system/api/internal/handlers"
	"github.com/joeydekruis/ai-trading-system/api/internal/httputil"
	"github.com/joeydekruis/ai-trading-system/api/internal/models"
	"github.com/joeydekruis/ai-trading-system/api/internal/services"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
	"github.com/jackc/pgx/v5/pgxpool"
)

var analyticsDB *duckdbstore.Store

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}

	calPath := os.Getenv("CALIBRATION_CONFIG")
	if calPath == "" {
		calPath = "config/calibration.json"
	}
	if err := services.LoadCalibrationParamsFromFile(calPath); err != nil && !os.IsNotExist(err) {
		slog.Warn("calibration config", "path", calPath, "err", err)
	}

	var pgReady atomic.Bool
	var duckReady atomic.Bool

	apiRouter := chi.NewRouter()
	apiRouter.Use(middleware.RequestID)
	apiRouter.Use(middleware.RealIP)
	apiRouter.Use(middleware.Recoverer)
	apiRouter.Use(middleware.Timeout(60 * time.Second))

	root := chi.NewRouter()
	root.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		body := map[string]string{
			"status":   "starting",
			"postgres": "starting",
			"duckdb":   "starting",
		}
		if pgReady.Load() {
			body["postgres"] = "ok"
		}
		if duckReady.Load() {
			body["duckdb"] = "ok"
		}
		if pgReady.Load() && duckReady.Load() {
			body["status"] = "ok"
		}
		httputil.WriteJSON(w, http.StatusOK, body)
	})
	root.Mount("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !pgReady.Load() {
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

	go initPostgres(context.Background(), cfg, apiRouter, &pgReady)
	go initDuckDB(context.Background(), cfg, &duckReady)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
}

func initDuckDB(ctx context.Context, cfg config.Config, ready *atomic.Bool) {
	const delay = 5 * time.Second

	for attempt := 1; ; attempt++ {
		store, err := duckdbstore.Open(cfg.DuckDBPath)
		if err != nil {
			slog.Error("duckdb open", "attempt", attempt, "path", cfg.DuckDBPath, "err", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(delay):
				continue
			}
		}

		analyticsDB = store
		ready.Store(true)
		slog.Info("duckdb ready", "path", cfg.DuckDBPath)
		return
	}
}

func initPostgres(ctx context.Context, cfg config.Config, apiRouter chi.Router, ready *atomic.Bool) {
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
	pipeline := store.NewPipelineStore(pool)
	bootstrap.EnsureAdmin(context.Background(), users, cfg.AdminEmail, cfg.AdminPassword)

	authHandler := handlers.AuthHandler{Users: users, JWTSecret: cfg.JWTSecret, SecureCookies: cfg.SecureCookies}
	userHandler := handlers.UserHandler{Users: users}
	workspaceHandler := handlers.WorkspaceHandler{Workspaces: workspaces}
	memberHandler := handlers.MemberHandler{Workspaces: workspaces, Users: users}
	analyticsHandler := handlers.AnalyticsHandler{
		Store:    func() *duckdbstore.Store { return analyticsDB },
		DuckPath: cfg.DuckDBPath,
	}

	alpacaClient := &services.AlpacaClient{
		DataURL:    cfg.AlpacaDataURL,
		TradingURL: cfg.AlpacaTradingURL,
		DataFeed:   cfg.AlpacaDataFeed,
		Key:        cfg.AlpacaAPIKey,
		Secret:     cfg.AlpacaAPISecret,
	}
	pipelineInternal := handlers.PipelineInternalHandler{
		PipelineDeps: handlers.PipelineDeps{
			Store: pipeline,
			Cfg:   cfg,
			Finbert: &services.FinbertClient{
				BaseURL: cfg.FinbertURL,
				APIKey:  cfg.FinbertAPIKey,
			},
			Alpaca: alpacaClient,
		},
	}

	pipelinePublic := handlers.PipelinePublicHandler{
		Store:      pipeline,
		Workspaces: workspaces,
		Alpaca:     alpacaClient,
	}
	researchHandler := handlers.ResearchHandler{
		Store:        pipeline,
		Workspaces:   workspaces,
		AlpacaFeed:   cfg.AlpacaDataFeed,
		AlpacaKeySet: cfg.AlpacaAPIKey != "" && cfg.AlpacaAPISecret != "",
		Finbert: &services.FinbertClient{
			BaseURL: cfg.FinbertURL,
			APIKey:  cfg.FinbertAPIKey,
		},
		Alpaca: alpacaClient,
	}

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
			r.Get("/analytics/status", analyticsHandler.Status)

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

				r.Get("/{id}/signals", pipelinePublic.ListWorkspaceSignals)
				r.Get("/{id}/watchlist", pipelinePublic.GetWatchlist)
				r.Put("/{id}/watchlist", pipelinePublic.SetWatchlist)
				r.Get("/{id}/news/backlog", pipelinePublic.ListWorkspaceBacklog)
				r.Get("/{id}/news/articles", pipelinePublic.ListWorkspaceArticles)
				r.Get("/{id}/symbols", pipelinePublic.ListWorkspaceSymbols)
				r.Get("/{id}/symbols/snapshots/latest", pipelinePublic.LatestWorkspaceSnapshots)
				r.Get("/{id}/research", researchHandler.GetBoard)
				r.Post("/{id}/research/refresh", researchHandler.Refresh)
			})

			r.Get("/workflows/runs", pipelinePublic.ListWorkflowRuns)
			r.Get("/news/backlog", pipelinePublic.ListBacklog)
			r.Get("/news/articles", pipelinePublic.ListArticles)
			r.Get("/symbols", pipelinePublic.ListSymbols)
			r.Get("/symbols/snapshots/latest", pipelinePublic.LatestSnapshots)
			r.Get("/features/market/latest", pipelinePublic.LatestMarketFeatures)
			r.Get("/features/news/latest", pipelinePublic.LatestNewsFeatures)
		})

		r.Route("/internal", func(r chi.Router) {
			r.Use(appmw.RequireInternalKey(cfg.InternalAPIKey))

			r.Post("/workflows/runs/start", pipelineInternal.StartWorkflowRun)
			r.Post("/workflows/runs/end", pipelineInternal.EndWorkflowRun)

			r.Post("/news/backlog/upsert", pipelineInternal.UpsertBacklog)
			r.Get("/news/backlog/next", pipelineInternal.NextBacklog)
			r.Post("/news/backlog/{id}/status", pipelineInternal.SetBacklogStatus)
			r.Post("/news/rss/ingest", pipelineInternal.IngestRSS)
			r.Post("/news/backlog/process-batch", pipelineInternal.ProcessBacklogBatch)

			r.Post("/news/articles/upsert", pipelineInternal.UpsertArticle)
			r.Get("/news/articles/unmapped", pipelineInternal.UnmappedArticles)
			r.Post("/news/articles/map-symbols", pipelineInternal.MapArticleSymbols)
			r.Post("/news/articles/{id}/symbols", pipelineInternal.SetArticleSymbols)

			r.Get("/news/sentiment/pending", pipelineInternal.PendingSentiment)
			r.Get("/news/sentiment/diagnostics", pipelineInternal.FinbertDiagnostics)
			r.Post("/news/sentiment/run-batch", pipelineInternal.RunSentimentBatch)
			r.Post("/news/sentiment/upsert", pipelineInternal.UpsertSentiment)

			r.Post("/market/candles/upsert", pipelineInternal.UpsertCandles)
			r.Post("/market/candles/ingest-alpaca", pipelineInternal.IngestAlpaca)
			r.Post("/features/market/generate", pipelineInternal.GenerateMarketFeatures)
			r.Post("/features/news/generate", pipelineInternal.GenerateNewsFeatures)
			r.Post("/features/snapshots/generate", pipelineInternal.GenerateSnapshots)

			r.Post("/workspaces/{workspace_id}/signals/generate", pipelineInternal.GenerateWorkspaceSignals)
			r.Post("/workspaces/signals/generate-all", pipelineInternal.GenerateAllWorkspaceSignals)
		})
	})
}

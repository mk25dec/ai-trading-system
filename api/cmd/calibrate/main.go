package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joeydekruis/ai-trading-system/api/internal/calibration"
	"github.com/joeydekruis/ai-trading-system/api/internal/services"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

func main() {
	sinceDur := flag.Duration("since", 720*time.Hour, "lookback window for snapshots")
	symbolsFlag := flag.String("symbols", "", "comma-separated symbols (empty = all)")
	configPath := flag.String("config", "config/calibration.json", "calibration JSON path")
	outPath := flag.String("out", "", "optional report JSON output path")
	optimize := flag.Bool("optimize", false, "grid-search params on train split")
	holdoutFlag := flag.String("holdout", "AAPL,MSFT", "holdout symbols for optimization")
	flag.Parse()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	if err := services.LoadCalibrationParamsFromFile(*configPath); err != nil && !os.IsNotExist(err) {
		log.Fatalf("load config: %v", err)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	pipe := store.NewPipelineStore(pool)
	since := time.Now().UTC().Add(-*sinceDur)
	var symbols []string
	if *symbolsFlag != "" {
		for _, s := range strings.Split(*symbolsFlag, ",") {
			s = strings.TrimSpace(strings.ToUpper(s))
			if s != "" {
				symbols = append(symbols, s)
			}
		}
	}

	snapshots, err := pipe.ListFeatureSnapshots(ctx, since, symbols)
	if err != nil {
		log.Fatalf("snapshots: %v", err)
	}
	if len(snapshots) == 0 {
		log.Fatal("no snapshots in range — run pipeline refresh to build symbol_feature_snapshots")
	}

	candleMap := map[string][]calibration.TimedClose{}
	seen := map[string]bool{}
	for _, snap := range snapshots {
		seen[snap.Symbol] = true
	}
	for sym := range seen {
		from := since.AddDate(0, 0, -5)
		to := time.Now().UTC().AddDate(0, 0, 2)
		raw, err := pipe.DailyClosesAsc(ctx, sym, from, to)
		if err != nil {
			log.Fatalf("candles %s: %v", sym, err)
		}
		candleMap[sym] = calibration.FromDailyCloses(raw)
	}

	holdout := map[string]bool{}
	for _, s := range strings.Split(*holdoutFlag, ",") {
		s = strings.TrimSpace(strings.ToUpper(s))
		if s != "" {
			holdout[s] = true
		}
	}

	var report calibration.Report
	var best services.CalibrationParams

	if *optimize {
		grid := calibration.BuildDefaultGrid()
		best, report = calibration.RunGridSearch(snapshots, candleMap, grid, holdout)
		services.SetCalibrationParams(best)
		if err := writeJSON(*configPath, best); err != nil {
			log.Fatalf("write config: %v", err)
		}
		log.Printf("optimized params written to %s", *configPath)
	} else {
		report, err = calibration.RunBacktest(ctx, pipe, pipe, calibration.BacktestOptions{
			Since:  since,
			Symbols: symbols,
			Params: services.CalibrationParamsActive(),
		})
		if err != nil {
			log.Fatalf("backtest: %v", err)
		}
	}

	printReport(report)
	if *outPath != "" {
		if err := writeJSON(*outPath, report); err != nil {
			log.Fatalf("write report: %v", err)
		}
	}
}

func printReport(r calibration.Report) {
	fmt.Fprintf(os.Stderr, "\nhorizon     n   IC_comp  IC_finbert  hit%%   brier\n")
	for _, m := range r.ByHorizon {
		fmt.Fprintf(os.Stderr, "%-8s %5d %8.3f %11.3f %5.1f %7.3f\n",
			m.Horizon, m.N, m.ICComposite, m.ICFinbert, m.HitRate*100, m.Brier)
	}
	fmt.Fprintf(os.Stderr, "mean IC (composite): %.3f\n", r.MeanIC())
}

func writeJSON(path string, v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, b, 0o644)
}

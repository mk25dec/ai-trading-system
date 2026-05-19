package services

import (
	"context"

	"github.com/joeydekruis/ai-trading-system/api/internal/catalog"
	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

// EnrichSymbolsFromAlpacaIfNeeded loads Alpaca metadata only for symbols missing catalog fields.
func EnrichSymbolsFromAlpacaIfNeeded(ctx context.Context, st *store.PipelineStore, alpaca *AlpacaClient, symbols []string) error {
	if alpaca == nil || len(symbols) == 0 {
		return nil
	}
	need, err := st.SymbolsNeedingCatalogEnrichment(ctx, symbols)
	if err != nil {
		return err
	}
	return EnrichSymbolsFromAlpaca(ctx, st, alpaca, need)
}

// EnrichSymbolsFromAlpaca upserts name, exchange, and asset_class from Alpaca assets API.
func EnrichSymbolsFromAlpaca(ctx context.Context, st *store.PipelineStore, alpaca *AlpacaClient, symbols []string) error {
	if alpaca == nil || len(symbols) == 0 {
		return nil
	}
	assets, err := alpaca.FetchAssets(ctx, symbols)
	if err != nil {
		return err
	}
	for _, sym := range symbols {
		a, ok := assets[sym]
		if !ok {
			continue
		}
		name := catalog.SanitizeName(sym, a.Name)
		var ex *string
		if exStr := catalog.SanitizeExchange(a.Exchange); exStr != "" {
			ex = &exStr
		}
		class := NormalizeAssetClass(a.Class, a.Name)
		_ = st.UpsertSymbolCatalog(ctx, sym, name, ex, class)
	}
	return nil
}

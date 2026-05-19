package services

import (
	"context"

	"github.com/joeydekruis/ai-trading-system/api/internal/store"
)

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
		ex := a.Exchange
		class := NormalizeAssetClass(a.Class, a.Name)
		_ = st.UpsertSymbolCatalog(ctx, sym, a.Name, &ex, class)
	}
	return nil
}

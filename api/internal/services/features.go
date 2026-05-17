package services

import (
	"math"
	"time"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

func ComputeMarketFeatures(candles []models.MarketCandle, timeframe string) *models.MarketFeatures {
	if len(candles) == 0 {
		return nil
	}
	// candles expected newest-first from store
	closes := make([]float64, len(candles))
	vols := make([]int64, len(candles))
	for i, c := range candles {
		closes[i] = c.Close
		vols[i] = c.Volume
	}

	latest := candles[0]
	f := &models.MarketFeatures{
		Symbol:    latest.Symbol,
		Timestamp: time.Now().UTC(),
		Timeframe: timeframe,
	}

	if len(closes) > 1 {
		pct := pctChange(closes[0], closes[1])
		f.PriceChange24h = &pct
	}
	if len(closes) > 5 {
		pct := pctChange(closes[0], closes[5])
		f.PriceChange5d = &pct
	}

	sma20 := sma(closes, 20)
	sma50 := sma(closes, 50)
	if sma20 > 0 {
		f.SMA20 = &sma20
		d := (closes[0] - sma20) / sma20
		f.DistanceSMA20 = &d
	}
	if sma50 > 0 {
		f.SMA50 = &sma50
		d := (closes[0] - sma50) / sma50
		f.DistanceSMA50 = &d
	}

	if len(closes) >= 15 {
		rsi := calcRSI(closes, 14)
		f.RSI = &rsi
	}

	if len(vols) >= 20 {
		avg := meanInt64(vols[1:21])
		if avg > 0 {
			ratio := float64(vols[0]) / float64(avg)
			f.VolumeRatio = &ratio
		}
	}

	if len(closes) >= 10 {
		vol := stdDev(closes[:10])
		f.Volatility = &vol
	}

	return f
}

func pctChange(current, previous float64) float64 {
	if previous == 0 {
		return 0
	}
	return (current - previous) / previous * 100
}

func sma(values []float64, period int) float64 {
	if len(values) < period {
		period = len(values)
	}
	if period == 0 {
		return 0
	}
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += values[i]
	}
	return sum / float64(period)
}

func calcRSI(closes []float64, period int) float64 {
	if len(closes) <= period {
		return 50
	}
	gain, loss := 0.0, 0.0
	for i := 0; i < period; i++ {
		diff := closes[i] - closes[i+1]
		if diff > 0 {
			gain += diff
		} else {
			loss -= diff
		}
	}
	if loss == 0 {
		return 100
	}
	rs := gain / loss
	return 100 - (100 / (1 + rs))
}

func stdDev(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	m := 0.0
	for _, v := range values {
		m += v
	}
	m /= float64(len(values))
	variance := 0.0
	for _, v := range values {
		d := v - m
		variance += d * d
	}
	return math.Sqrt(variance / float64(len(values)))
}

func meanInt64(values []int64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := int64(0)
	for _, v := range values {
		sum += v
	}
	return float64(sum) / float64(len(values))
}

type SentimentRow struct {
	Symbol    string
	Score     float64
	Relevance float64
	At        time.Time
}

func AggregateNewsFeatures(symbol string, rows []SentimentRow, now time.Time) models.NewsFeatures {
	f := models.NewsFeatures{Symbol: symbol, Timestamp: now}
	var scores1h, scores4h, scores24h []float64
	maxRel := 0.0

	for _, r := range rows {
		if r.Symbol != symbol {
			continue
		}
		age := now.Sub(r.At)
		if age <= time.Hour {
			f.NewsCount1h++
			scores1h = append(scores1h, r.Score)
		}
		if age <= 4*time.Hour {
			f.NewsCount4h++
			scores4h = append(scores4h, r.Score)
		}
		if age <= 24*time.Hour {
			f.NewsCount24h++
			scores24h = append(scores24h, r.Score)
			if r.Relevance > maxRel {
				maxRel = r.Relevance
			}
		}
	}

	if len(scores1h) > 0 {
		v := avg(scores1h)
		f.AvgSentiment1h = &v
	}
	if len(scores4h) > 0 {
		v := avg(scores4h)
		f.AvgSentiment4h = &v
	}
	if len(scores24h) > 0 {
		v := avg(scores24h)
		f.AvgSentiment24h = &v
	}
	if f.AvgSentiment4h != nil && f.AvgSentiment24h != nil {
		m := *f.AvgSentiment4h - *f.AvgSentiment24h
		f.SentimentMomentum = &m
	}
	negSpike := f.NewsCount1h >= 3 && f.AvgSentiment1h != nil && *f.AvgSentiment1h < -0.3
	posSpike := f.NewsCount1h >= 3 && f.AvgSentiment1h != nil && *f.AvgSentiment1h > 0.3
	f.NegativeNewsSpike = negSpike
	f.PositiveNewsSpike = posSpike
	if maxRel > 0 {
		f.MaxRelevanceScore24h = &maxRel
	}
	return f
}

func avg(vals []float64) float64 {
	if len(vals) == 0 {
		return 0
	}
	s := 0.0
	for _, v := range vals {
		s += v
	}
	return s / float64(len(vals))
}

func BuildSnapshot(symbol string, market *models.MarketFeatures, news *models.NewsFeatures) models.SymbolFeatureSnapshot {
	now := time.Now().UTC()
	snap := models.SymbolFeatureSnapshot{
		Symbol:           symbol,
		Timestamp:        now,
		MarketFeatures:   map[string]any{},
		NewsFeatures:     map[string]any{},
		MissingFields:    []string{},
		DataQualityScore: 0,
	}

	fields := 0
	present := 0

	if market != nil {
		snap.MarketFeatures["priceChange24h"] = market.PriceChange24h
		snap.MarketFeatures["rsi"] = market.RSI
		snap.MarketFeatures["volumeRatio"] = market.VolumeRatio
		if market.PriceChange24h != nil {
			present++
		} else {
			snap.MissingFields = append(snap.MissingFields, "priceChange24h")
		}
		fields += 3
		if market.RSI != nil {
			present++
		}
		if market.VolumeRatio != nil {
			present++
		}
	} else {
		snap.MissingFields = append(snap.MissingFields, "market_features")
		fields += 3
	}

	if news != nil {
		snap.NewsFeatures["newsCount24h"] = news.NewsCount24h
		snap.NewsFeatures["avgSentiment24h"] = news.AvgSentiment24h
		fields += 2
		if news.AvgSentiment24h != nil {
			present++
		} else {
			snap.MissingFields = append(snap.MissingFields, "avgSentiment24h")
		}
		if news.NewsCount24h > 0 {
			present++
		}
	} else {
		snap.MissingFields = append(snap.MissingFields, "news_features")
		fields += 2
	}

	if fields > 0 {
		snap.DataQualityScore = float64(present) / float64(fields)
	}

	var score float64
	if market != nil && market.PriceChange24h != nil {
		score += *market.PriceChange24h * 0.3
	}
	if news != nil && news.AvgSentiment24h != nil {
		score += *news.AvgSentiment24h * 50
	}
	snap.CombinedScore = &score
	return snap
}

package services

import (
	"fmt"
	"math"

	"github.com/joeydekruis/ai-trading-system/api/internal/models"
)

// ComputeDecision builds a multi-horizon, confidence-weighted trader view from market + news features.
// Aligned with the v2 research brief: category scores, horizons, risk penalty, alignment meta-signal.
func ComputeDecision(symbol string, mf *models.MarketFeatures, nf *models.NewsFeatures) models.DecisionView {
	cats := scoreCategories(mf, nf)
	short := scoreHorizon("short", "3D", cats, mf, nf, horizonWeights{
		technical: 0.55, sentiment: 0.45, risk: 0.10,
	}, sentimentWindow{h1: 0.65, h4: 0.25, h24: 0.10})
	swing := scoreHorizon("swing", "1W", cats, mf, nf, horizonWeights{
		technical: 0.50, sentiment: 0.38, risk: 0.12,
	}, sentimentWindow{h1: 0.20, h4: 0.35, h24: 0.45})
	position := scoreHorizon("position", "1M", cats, mf, nf, horizonWeights{
		technical: 0.42, sentiment: 0.43, risk: 0.15,
	}, sentimentWindow{h1: 0.10, h4: 0.25, h24: 0.65})

	horizons := []models.HorizonOutlook{short, swing, position}
	alignment, alignBonus := horizonAlignment(short, swing, position)
	conflict, conflictNote := detectConflict(mf, nf, short, swing, position)

	composite := swing.Score*0.45 + short.Score*0.30 + position.Score*0.25 + alignBonus
	composite = clamp(composite, 0, 100)

	conf := (short.Confidence + swing.Confidence + position.Confidence) / 3
	if mf == nil {
		conf *= 0.75
	}
	if nf == nil || (nf.NewsCount24h == 0 && nf.NewsCount1h == 0) {
		conf *= 0.85
	}
	conf = clamp(conf, 0.15, 0.95)

	risk := riskLevel(mf, nf, cats)
	composite -= riskPenalty(risk)
	composite = clamp(composite, 0, 100)

	outlook := scoreToOutlook(composite)
	action := outlookToAction(outlook, composite, conf, conflict, risk)
	action, outlook, composite = applyDecisionOverrides(action, outlook, composite, mf, nf)

	newsStance, newsConf := newsStanceFromFeatures(nf)
	priceTrend := priceTrendLabel(mf)
	drivers := buildDrivers(cats, mf, nf, alignment, conflict)

	return models.DecisionView{
		PrimaryAction:  action,
		PrimaryOutlook: outlookLabel(outlook),
		CompositeScore: math.Round(composite*10) / 10,
		Confidence:     math.Round(conf*1000) / 1000,
		RiskLevel:      risk,
		Alignment:      alignment,
		Conflict:       conflict,
		ConflictNote:   conflictNote,
		NewsStance:     newsStance,
		NewsConfidence: newsConf,
		PriceTrend:     priceTrend,
		Drivers:        drivers,
		Horizons:       horizons,
		Categories:     cats,
	}
}

type horizonWeights struct {
	technical float64
	sentiment float64
	risk      float64
}

type sentimentWindow struct {
	h1, h4, h24 float64
}

func scoreCategories(mf *models.MarketFeatures, nf *models.NewsFeatures) []models.CategoryScore {
	var out []models.CategoryScore
	if t, c := categoryTechnical(mf); c > 0 {
		out = append(out, models.CategoryScore{ID: "technical", Label: "Technical momentum", Score: t, Confidence: c, Weight: 0.35})
	}
	if t, c := categoryTrend(mf); c > 0 {
		out = append(out, models.CategoryScore{ID: "trend", Label: "Trend strength", Score: t, Confidence: c, Weight: 0.12})
	}
	if s, c := categorySentiment(nf); c > 0 {
		out = append(out, models.CategoryScore{ID: "sentiment", Label: "News sentiment", Score: s, Confidence: c, Weight: 0.30})
	}
	if f, c := categoryFinbert(nf); c > 0 {
		out = append(out, models.CategoryScore{ID: "finbert", Label: "FinBERT tone", Score: f, Confidence: c, Weight: 0.18})
	}
	if r, c := categoryRisk(mf, nf); c > 0 {
		out = append(out, models.CategoryScore{ID: "risk", Label: "Risk factors", Score: r, Confidence: c, Weight: 0.05})
	}
	return out
}

func categoryTechnical(mf *models.MarketFeatures) (float64, float64) {
	if mf == nil {
		return 0, 0
	}
	var parts []float64
	var conf float64
	n := 0

	if mf.PriceChange24h != nil {
		parts = append(parts, clamp(*mf.PriceChange24h/4, -1, 1))
		conf += 0.9
		n++
	}
	if mf.RSI != nil {
		rsi := *mf.RSI
		var s float64
		switch {
		case rsi >= 70:
			s = -0.5
		case rsi <= 30:
			s = 0.5
		default:
			s = (50 - rsi) / 50
		}
		parts = append(parts, s)
		conf += 0.85
		n++
	}
	if mf.DistanceSMA20 != nil {
		parts = append(parts, clamp(*mf.DistanceSMA20*5, -1, 1))
		conf += 0.8
		n++
	}
	if mf.VolumeRatio != nil && *mf.VolumeRatio > 1.2 {
		dir := 0.15
		if mf.PriceChange24h != nil && *mf.PriceChange24h < 0 {
			dir = -0.15
		}
		parts = append(parts, dir)
		conf += 0.6
		n++
	}
	if n == 0 {
		return 0, 0
	}
	return mean(parts), conf / float64(n)
}

func categoryTrend(mf *models.MarketFeatures) (float64, float64) {
	if mf == nil || mf.PriceChange24h == nil || mf.PriceChange5d == nil {
		return 0, 0
	}
	ch24, ch5 := *mf.PriceChange24h, *mf.PriceChange5d
	aligned := (ch24 > 0 && ch5 > 0) || (ch24 < 0 && ch5 < 0)
	score := mean([]float64{clamp(ch24/3, -1, 1), clamp(ch5/5, -1, 1)})
	if !aligned {
		score *= 0.5
	}
	conf := 0.75
	if mf.DistanceSMA20 != nil {
		conf += 0.1
	}
	return score, clamp(conf, 0, 1)
}

func categorySentiment(nf *models.NewsFeatures) (float64, float64) {
	if nf == nil {
		return 0, 0
	}
	var scores []float64
	var weights []float64

	add := func(sent *float64, w float64, count int) {
		if sent == nil || count == 0 {
			return
		}
		scores = append(scores, clamp(*sent, -1, 1))
		weights = append(weights, w*math.Min(1, float64(count)/3))
	}
	add(nf.AvgSentiment1h, 1.0, nf.NewsCount1h)
	add(nf.AvgSentiment4h, 0.85, nf.NewsCount4h)
	add(nf.AvgSentiment24h, 0.7, nf.NewsCount24h)

	if len(scores) == 0 {
		return 0, 0
	}
	wsum := 0.0
	acc := 0.0
	for i, s := range scores {
		acc += s * weights[i]
		wsum += weights[i]
	}
	score := acc / wsum
	conf := clamp(0.35+wsum*0.25, 0.25, 0.9)
	if nf.PositiveNewsSpike {
		score += 0.25
		conf += 0.1
	}
	if nf.NegativeNewsSpike {
		score -= 0.35
		conf += 0.1
	}
	return clamp(score, -1, 1), clamp(conf, 0, 1)
}

func categoryFinbert(nf *models.NewsFeatures) (float64, float64) {
	if nf == nil {
		return 0, 0
	}
	fb := nf.Finbert
	sent := finbertSignedScore(fb)
	if sent == nil {
		if nf.AvgSentiment24h != nil {
			return clamp(*nf.AvgSentiment24h, -1, 1), 0.5
		}
		return 0, 0
	}
	conf := 0.45
	if fb.AvgConfidence24h != nil {
		conf = clamp(*fb.AvgConfidence24h, 0.35, 0.95)
	}
	if nf.NewsCount24h >= 3 {
		conf = math.Min(0.95, conf+0.08)
	}
	return clamp(*sent, -1, 1), conf
}

func finbertSignedScore(fb models.FinbertMetrics) *float64 {
	if fb.WeightedSentiment24h != nil {
		return fb.WeightedSentiment24h
	}
	pPos, pNeg, pNeu := fb.AvgProbPositive24h, fb.AvgProbNegative24h, fb.AvgProbNeutral24h
	if pPos == nil && pNeg == nil {
		return nil
	}
	pos, neg, neu := 0.0, 0.0, 0.0
	if pPos != nil {
		pos = *pPos
	}
	if pNeg != nil {
		neg = *pNeg
	}
	if pNeu != nil {
		neu = *pNeu
	}
	s := pos - neg
	if neu > 0.55 {
		s *= 0.5
	}
	return &s
}

func categoryRisk(mf *models.MarketFeatures, nf *models.NewsFeatures) (float64, float64) {
	// Negative score = elevated risk (used as penalty input).
	var flags float64
	n := 0.0
	if mf != nil && mf.Volatility != nil && *mf.Volatility > 0.04 {
		flags -= 0.4
		n++
	}
	if mf != nil && mf.RSI != nil && *mf.RSI > 72 {
		flags -= 0.35
		n++
	}
	if nf != nil && nf.NegativeNewsSpike {
		flags -= 0.5
		n++
	}
	if nf != nil && nf.MaxRelevanceScore24h != nil && *nf.MaxRelevanceScore24h > 0.85 && nf.AvgSentiment24h != nil && *nf.AvgSentiment24h < -0.3 {
		flags -= 0.25
		n++
	}
	if n == 0 {
		return 0, 0
	}
	return clamp(flags/n, -1, 0), 0.7
}

func scoreHorizon(
	id, label string,
	cats []models.CategoryScore,
	mf *models.MarketFeatures,
	nf *models.NewsFeatures,
	w horizonWeights,
	sw sentimentWindow,
) models.HorizonOutlook {
	tech := weightedCategory(cats, "technical", 0.5) + weightedCategory(cats, "trend", 0.5)
	sent := horizonSentiment(nf, sw)
	finbert := weightedCategory(cats, "finbert", 1)
	if finbert == 0 {
		finbert = sent
	} else {
		finbert = finbert*0.65 + sent*0.35
	}
	risk := weightedCategory(cats, "risk", 1)

	raw := tech*w.technical + finbert*w.sentiment
	if risk < 0 {
		raw += risk * w.risk
	}

	score100 := (raw + 1) / 2 * 100
	score100 = clamp(score100, 0, 100)

	conf := horizonConfidence(mf, nf, cats)
	outlook := scoreToOutlook(score100)

	return models.HorizonOutlook{
		ID:         id,
		Label:      label,
		Score:      math.Round(score100*10) / 10,
		Outlook:    outlook,
		Confidence: math.Round(conf*1000) / 1000,
	}
}

func horizonSentiment(nf *models.NewsFeatures, sw sentimentWindow) float64 {
	if nf == nil {
		return 0
	}
	var acc, w float64
	add := func(s *float64, weight float64, count int) {
		if s == nil || count == 0 || weight == 0 {
			return
		}
		coverage := math.Min(1, float64(count)/3)
		acc += clamp(*s, -1, 1) * weight * coverage
		w += weight * coverage
	}
	add(nf.AvgSentiment1h, sw.h1, nf.NewsCount1h)
	add(nf.AvgSentiment4h, sw.h4, nf.NewsCount4h)
	add(nf.AvgSentiment24h, sw.h24, nf.NewsCount24h)
	if w == 0 {
		if s := finbertSignedScore(nf.Finbert); s != nil {
			return *s
		}
		return 0
	}
	return acc / w
}

func weightedCategory(cats []models.CategoryScore, id string, scale float64) float64 {
	for _, c := range cats {
		if c.ID == id {
			return c.Score * c.Confidence * scale
		}
	}
	return 0
}

func horizonConfidence(mf *models.MarketFeatures, nf *models.NewsFeatures, cats []models.CategoryScore) float64 {
	var conf float64
	n := 0
	for _, c := range cats {
		conf += c.Confidence * c.Weight
		n++
	}
	if n > 0 {
		conf /= float64(n)
	} else {
		conf = 0.35
	}
	if mf == nil {
		conf *= 0.7
	}
	if nf == nil {
		conf *= 0.8
	}
	return clamp(conf, 0.2, 0.95)
}

func horizonAlignment(short, swing, position models.HorizonOutlook) (string, float64) {
	o := []string{short.Outlook, swing.Outlook, position.Outlook}
	bull := 0
	bear := 0
	for _, x := range o {
		switch x {
		case "strong_buy", "buy":
			bull++
		case "sell", "avoid":
			bear++
		}
	}
	switch {
	case bull == 3:
		return "aligned_bullish", 4
	case bear >= 2:
		return "aligned_bearish", -4
	case bull >= 1 && bear >= 1:
		return "divergent", -2
	default:
		return "mixed", 0
	}
}

func detectConflict(mf *models.MarketFeatures, nf *models.NewsFeatures, horizons ...models.HorizonOutlook) (bool, string) {
	if mf != nil && mf.PriceChange24h != nil && nf != nil && nf.AvgSentiment24h != nil {
		priceUp := *mf.PriceChange24h > 0.5
		newsBear := *nf.AvgSentiment24h < -0.2
		priceDown := *mf.PriceChange24h < -0.5
		newsBull := *nf.AvgSentiment24h > 0.2
		if (priceUp && newsBear) || (priceDown && newsBull) {
			return true, "Price trend and 24h news sentiment disagree"
		}
	}
	bull, bear := 0, 0
	for _, h := range horizons {
		switch h.Outlook {
		case "strong_buy", "buy":
			bull++
		case "sell", "avoid":
			bear++
		}
	}
	if bull > 0 && bear > 0 {
		return true, "Short-term and position horizons point different ways"
	}
	return false, ""
}

func riskLevel(mf *models.MarketFeatures, nf *models.NewsFeatures, cats []models.CategoryScore) string {
	risk := weightedCategory(cats, "risk", 1)
	penalty := 0
	if mf != nil && mf.Volatility != nil && *mf.Volatility > 0.05 {
		penalty++
	}
	if nf != nil && nf.NegativeNewsSpike {
		penalty++
	}
	if risk < -0.35 || penalty >= 2 {
		return "high"
	}
	if risk < -0.15 || penalty == 1 {
		return "medium"
	}
	return "low"
}

func riskPenalty(level string) float64 {
	switch level {
	case "high":
		return 8
	case "medium":
		return 4
	default:
		return 0
	}
}

func scoreToOutlook(score float64) string {
	switch {
	case score >= 78:
		return "strong_buy"
	case score >= 62:
		return "buy"
	case score >= 45:
		return "watch"
	case score >= 32:
		return "sell"
	default:
		return "avoid"
	}
}

// applyDecisionOverrides encodes high-conviction rules before ambiguous composite scores.
func applyDecisionOverrides(action, outlook string, composite float64, mf *models.MarketFeatures, nf *models.NewsFeatures) (string, string, float64) {
	if nf != nil {
		if nf.NegativeNewsSpike {
			if nf.AvgSentiment24h != nil && *nf.AvgSentiment24h < -0.35 {
				return "avoid", "avoid", math.Min(composite, 28)
			}
			if nf.AvgSentiment1h != nil && *nf.AvgSentiment1h < -0.45 {
				return "avoid", "avoid", math.Min(composite, 30)
			}
		}
		if nf.PositiveNewsSpike && nf.AvgSentiment1h != nil && *nf.AvgSentiment1h > 0.35 {
			if composite >= 50 {
				return "buy_candidate", "buy", math.Max(composite, 64)
			}
		}
	}
	if mf != nil && nf != nil && mf.PriceChange24h != nil && nf.AvgSentiment24h != nil {
		ch, sent := *mf.PriceChange24h, *nf.AvgSentiment24h
		if ch > 2.5 && sent > 0.3 && !nf.NegativeNewsSpike {
			return "buy_candidate", "buy", math.Max(composite, 65)
		}
		if ch < -2 && sent < -0.35 {
			return "sell_candidate", "sell", math.Min(composite, 38)
		}
	}
	if nf != nil && nf.AvgSentiment24h != nil && *nf.AvgSentiment24h < -0.5 && mf == nil {
		return "avoid", "avoid", math.Min(composite, 25)
	}
	return action, outlook, composite
}

func outlookToAction(outlook string, composite, conf float64, conflict bool, risk string) string {
	if conf < 0.35 {
		return "watch"
	}
	if conflict && outlook != "avoid" && outlook != "sell" {
		return "watch"
	}
	switch outlook {
	case "strong_buy", "buy":
		if risk == "high" && composite < 70 {
			return "watch"
		}
		return "buy_candidate"
	case "sell":
		return "sell_candidate"
	case "avoid":
		return "avoid"
	default:
		return "watch"
	}
}

func outlookLabel(outlook string) string {
	switch outlook {
	case "strong_buy":
		return "Strong buy"
	case "buy":
		return "Buy"
	case "sell":
		return "Sell"
	case "avoid":
		return "Avoid"
	default:
		return "Watch"
	}
}

func newsStanceFromFeatures(nf *models.NewsFeatures) (string, *float64) {
	if nf == nil {
		return "unknown", nil
	}
	if s := finbertSignedScore(nf.Finbert); s != nil {
		conf := nf.Finbert.AvgConfidence24h
		return stanceFromScore(*s), conf
	}
	if nf.AvgSentiment24h != nil {
		return stanceFromScore(*nf.AvgSentiment24h), nil
	}
	return "unknown", nil
}

func stanceFromScore(s float64) string {
	switch {
	case s > 0.2:
		return "bullish"
	case s < -0.2:
		return "bearish"
	default:
		return "neutral"
	}
}

func priceTrendLabel(mf *models.MarketFeatures) string {
	if mf == nil || mf.PriceChange24h == nil {
		return "unknown"
	}
	ch := *mf.PriceChange24h
	switch {
	case ch > 2:
		return "uptrend"
	case ch < -2:
		return "downtrend"
	default:
		return "sideways"
	}
}

func buildDrivers(cats []models.CategoryScore, mf *models.MarketFeatures, nf *models.NewsFeatures, alignment string, conflict bool) []string {
	var drivers []string
	for _, c := range cats {
		if math.Abs(c.Score) < 0.2 || c.Confidence < 0.4 {
			continue
		}
		dir := "supportive"
		if c.Score < 0 {
			dir = "headwind"
		}
		drivers = append(drivers, fmt.Sprintf("%s %s (%.0f%% conf)", c.Label, dir, c.Confidence*100))
		if len(drivers) >= 3 {
			break
		}
	}
	if nf != nil && nf.NegativeNewsSpike && len(drivers) < 3 {
		drivers = append(drivers, "Negative news spike in last hour")
	}
	if nf != nil && nf.PositiveNewsSpike && len(drivers) < 3 {
		drivers = append(drivers, "Positive news spike in last hour")
	}
	if conflict && len(drivers) < 3 {
		drivers = append(drivers, "Mixed signals — price vs news")
	}
	if alignment == "aligned_bullish" && len(drivers) < 3 {
		drivers = append(drivers, "Horizons aligned bullish")
	}
	if alignment == "aligned_bearish" && len(drivers) < 3 {
		drivers = append(drivers, "Horizons aligned bearish")
	}
	if mf == nil && len(drivers) < 3 {
		drivers = append(drivers, "Market data incomplete")
	}
	if len(drivers) == 0 {
		drivers = append(drivers, "Insufficient signal strength — stay on watch")
	}
	return drivers
}

func mean(vals []float64) float64 {
	if len(vals) == 0 {
		return 0
	}
	s := 0.0
	for _, v := range vals {
		s += v
	}
	return s / float64(len(vals))
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// RecommendationFromDecision maps the decision engine to legacy recommendation fields.
func RecommendationFromDecision(symbol string, mf *models.MarketFeatures, nf *models.NewsFeatures) Recommendation {
	d := ComputeDecision(symbol, mf, nf)
	// Map composite 0–100 to legacy score roughly −2..+2 for compatibility.
	legacyScore := (d.CompositeScore - 50) / 25
	legacyScore = clamp(math.Round(legacyScore*100)/100, -2, 2)

	reasons := []map[string]any{
		{"type": "decision_engine", "composite": d.CompositeScore, "alignment": d.Alignment},
	}
	for _, h := range d.Horizons {
		reasons = append(reasons, map[string]any{
			"type": "horizon", "id": h.ID, "score": h.Score, "outlook": h.Outlook,
		})
	}

	bullets := BuildAnalysisBullets(symbol, d.PrimaryAction, mf, nf)
	bullets = append([]string{
		fmt.Sprintf("Decision engine: %s (composite %.0f/100, confidence %.0f%%).",
			d.PrimaryOutlook, d.CompositeScore, d.Confidence*100),
		fmt.Sprintf("Horizons — 3D: %s (%.0f), 1W: %s (%.0f), 1M: %s (%.0f).",
			outlookLabel(d.Horizons[0].Outlook), d.Horizons[0].Score,
			outlookLabel(d.Horizons[1].Outlook), d.Horizons[1].Score,
			outlookLabel(d.Horizons[2].Outlook), d.Horizons[2].Score),
	}, bullets...)
	if d.Conflict && d.ConflictNote != "" {
		bullets = append(bullets, "Conflict: "+d.ConflictNote+".")
	}
	if len(d.Drivers) > 0 {
		bullets = append(bullets, "Key drivers: "+d.Drivers[0]+".")
	}

	return Recommendation{
		Action:     d.PrimaryAction,
		Score:      legacyScore,
		Confidence: d.Confidence,
		Reasons:    reasons,
		Bullets:    bullets,
	}
}

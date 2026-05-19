package services

import "math"

// sigmoid maps (−∞,∞) → (0,1); used to convert factor sums into calibrated scores.
func sigmoid(x float64) float64 {
	return 1 / (1 + math.Exp(-x))
}

// scoreFromSigmoid maps factor sum in roughly [−3,3] to 0–100.
func scoreFromSigmoid(raw float64) float64 {
	return clamp(sigmoid(raw*1.15)*100, 0, 100)
}

// decayWeight applies exponential freshness decay (half-life in hours).
func decayWeight(ageHours, halfLife float64) float64 {
	if halfLife <= 0 {
		return 1
	}
	return math.Exp(-math.Ln2 * ageHours / halfLife)
}

// wilsonLowerBound returns conservative binomial proportion for n trials, p hat.
func wilsonLowerBound(positive, n int, z float64) float64 {
	if n <= 0 {
		return 0
	}
	phat := float64(positive) / float64(n)
	if z <= 0 {
		z = 1.96
	}
	denom := 1 + z*z/float64(n)
	center := phat + z*z/(2*float64(n))
	margin := z * math.Sqrt((phat*(1-phat)+z*z/(4*float64(n)))/float64(n))
	return clamp((center-margin)/denom, 0, 1)
}

// sampleConfidence rises with article count: 1 − e^(−n/λ).
func sampleConfidence(n int, lambda float64) float64 {
	if n <= 0 {
		return 0
	}
	if lambda <= 0 {
		lambda = 5
	}
	return clamp(1-math.Exp(-float64(n)/lambda), 0, 1)
}

// rsiSignal maps RSI (0–100) to mean-reversion / momentum signal in [−1,1].
func rsiSignal(rsi float64) float64 {
	// Centered oscillator: oversold positive, overbought negative.
	return clamp((50-rsi)/50, -1, 1)
}

// tanhScale compresses return % into (−1,1) with scale as typical move.
func tanhScale(pct, scale float64) float64 {
	if scale <= 0 {
		scale = 4
	}
	return math.Tanh(pct / scale)
}

// combineConfidence merges model and sample-size confidence (geometric mean).
func combineConfidence(parts ...float64) float64 {
	if len(parts) == 0 {
		return 0.35
	}
	prod := 1.0
	n := 0
	for _, p := range parts {
		if p <= 0 {
			continue
		}
		prod *= clamp(p, 0.05, 0.99)
		n++
	}
	if n == 0 {
		return 0.35
	}
	return clamp(math.Pow(prod, 1/float64(n)), 0.15, 0.95)
}

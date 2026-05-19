package calibration

import "math"

// PearsonIC returns the Pearson correlation between x and y, or 0 if undefined.
func PearsonIC(x, y []float64) float64 {
	n := len(x)
	if n < 2 || n != len(y) {
		return 0
	}
	var sumX, sumY, sumXY, sumX2, sumY2 float64
	for i := 0; i < n; i++ {
		sumX += x[i]
		sumY += y[i]
		sumXY += x[i] * y[i]
		sumX2 += x[i] * x[i]
		sumY2 += y[i] * y[i]
	}
	num := float64(n)*sumXY - sumX*sumY
	den := math.Sqrt((float64(n)*sumX2 - sumX*sumX) * (float64(n)*sumY2 - sumY*sumY))
	if den == 0 {
		return 0
	}
	return num / den
}

// BrierScore averages (p - y)^2 for binary outcomes y in {0,1}.
func BrierScore(prob []float64, realizedPositive []float64) float64 {
	if len(prob) == 0 || len(prob) != len(realizedPositive) {
		return 0
	}
	var sum float64
	for i := range prob {
		p := clamp(prob[i], 0.001, 0.999)
		y := 0.0
		if realizedPositive[i] > 0 {
			y = 1
		}
		d := p - y
		sum += d * d
	}
	return sum / float64(len(prob))
}

// HitRate is the fraction where sign(pred) matches sign(realized return %).
func HitRate(pred []float64, realizedPct []float64) float64 {
	if len(pred) == 0 || len(pred) != len(realizedPct) {
		return 0
	}
	hits := 0
	for i := range pred {
		if sign(pred[i]) == sign(realizedPct[i]) {
			hits++
		}
	}
	return float64(hits) / float64(len(pred))
}

func sign(v float64) float64 {
	if v > 0 {
		return 1
	}
	if v < 0 {
		return -1
	}
	return 0
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

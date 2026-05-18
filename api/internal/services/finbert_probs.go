package services

// InferFinbertProbs returns softmax probabilities, backfilling from label+confidence when DB columns are null.
func InferFinbertProbs(label string, confidence float64, probPos, probNeg, probNeu *float64) (float64, float64, float64) {
	if probPos != nil && probNeg != nil && probNeu != nil {
		return *probPos, *probNeg, *probNeu
	}
	conf := confidence
	if conf <= 0 {
		conf = 0.5
	}
	switch label {
	case "positive":
		return conf, (1 - conf) / 2, (1 - conf) / 2
	case "negative":
		return (1 - conf) / 2, conf, (1 - conf) / 2
	default:
		rem := 1 - conf
		if rem < 0 {
			rem = 0
		}
		return rem / 2, rem / 2, conf
	}
}

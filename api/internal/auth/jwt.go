package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const sessionCookieName = "session"

type Claims struct {
	UserID       string `json:"uid"`
	Email        string `json:"email"`
	PlatformRole string `json:"role"`
	jwt.RegisteredClaims
}

func SessionCookieName() string {
	return sessionCookieName
}

func IssueToken(secret, userID, email, platformRole string, ttl time.Duration) (string, error) {
	claims := Claims{
		UserID:       userID,
		Email:        email,
		PlatformRole: platformRole,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseToken(secret, tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func GenerateAccessToken(user *User, secret string, ttl time.Duration) (string, error) {
	now := time.Now().UTC()
	claims := JWTClaims{
		UserID:   user.ID,
		Email:    user.Email,
		Role:     user.Role,
		FullName: user.FullName,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.String(),
			Issuer:    "stockpilot-api",
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			ID:        uuid.New().String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", fmt.Errorf("failed to sign access token: %w", err)
	}

	return tokenString, nil
}

func ValidateAccessToken(tokenStr string, secret string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		// Strict algorithm check: prevent alg 'none' or asymmetrical substitution attacks
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer("stockpilot-api"))

	if err != nil {
		return nil, errors.Join(ErrInvalidToken, err)
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	if claims.UserID == uuid.Nil || claims.Email == "" || claims.Role == "" {
		return nil, fmt.Errorf("%w: missing required claims", ErrInvalidToken)
	}

	return claims, nil
}

// GenerateRefreshToken creates a high-entropy cryptographically secure refresh token
// and returns both the plaintext token (for the client) and its SHA-256 hash (for the DB).
func GenerateRefreshToken() (token string, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", fmt.Errorf("failed to generate random token: %w", err)
	}
	token = hex.EncodeToString(b)
	hash = HashToken(token)
	return token, hash, nil
}

// HashToken creates a SHA-256 hexadecimal digest of the token string.
func HashToken(token string) string {
	digest := sha256.Sum256([]byte(token))
	return hex.EncodeToString(digest[:])
}

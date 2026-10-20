package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port              string
	Env               string
	DBHost            string
	DBPort            string
	DBUser            string
	DBPassword        string
	DBName            string
	DBSSLMode         string
	DBPoolMaxConns    int32
	DBPoolMinConns    int32
	DBPoolMaxConnLife time.Duration
	DBPoolMaxConnIdle time.Duration
	AllowedOrigins    string
	JWTSecret         string
	JWTAccessTTL      time.Duration
	JWTRefreshTTL     time.Duration
	DevAdminEmail     string
	DevAdminPassword  string
	DevAdminName      string
	DevStaffEmail     string
	DevStaffPassword  string
	DevStaffName      string
}

func Load() *Config {
	env := getEnv("ENV", getEnv("APP_ENV", "development"))
	isProd := strings.EqualFold(env, "production") || strings.EqualFold(env, "prod")

	cfg := &Config{
		Port:              getEnv("PORT", "8080"),
		Env:               env,
		DBHost:            getEnv("DB_HOST", "127.0.0.1"),
		DBPort:            getEnv("DB_PORT", "5432"),
		DBUser:            getEnv("DB_USER", "postgres"),
		DBPassword:        getEnv("DB_PASSWORD", "postgres"),
		DBName:            getEnv("DB_NAME", "stockpilot"),
		DBSSLMode:         getEnv("DB_SSLMODE", "disable"),
		DBPoolMaxConns:    int32(getEnvAsInt("DB_POOL_MAX_CONNS", 25)),
		DBPoolMinConns:    int32(getEnvAsInt("DB_POOL_MIN_CONNS", 5)),
		DBPoolMaxConnLife: getEnvAsDuration("DB_POOL_MAX_CONN_LIFETIME", time.Hour),
		DBPoolMaxConnIdle: getEnvAsDuration("DB_POOL_MAX_CONN_IDLE_TIME", 30*time.Minute),
		AllowedOrigins:    getEnv("ALLOWED_ORIGINS", "*"),
		JWTSecret:         getEnv("JWT_SECRET", "stockpilot-secure-auth-jwt-secret-key-32-chars-dev"),
		JWTAccessTTL:      getEnvAsDuration("JWT_ACCESS_TTL", 15*time.Minute),
		JWTRefreshTTL:     getEnvAsDuration("JWT_REFRESH_TTL", 7*24*time.Hour),
		DevAdminEmail:     getEnv("DEV_ADMIN_EMAIL", "admin@stockpilot.com"),
		DevAdminPassword:  getEnv("DEV_ADMIN_PASSWORD", "Admin@123456"),
		DevAdminName:      getEnv("DEV_ADMIN_NAME", "ผู้ดูแลระบบ StockPilot"),
		DevStaffEmail:     getEnv("DEV_STAFF_EMAIL", "staff@stockpilot.com"),
		DevStaffPassword:  getEnv("DEV_STAFF_PASSWORD", "Staff@123456"),
		DevStaffName:      getEnv("DEV_STAFF_NAME", "พนักงาน สต๊อกไพลอต"),
	}

	// Strictly prohibit development credentials in production
	if isProd {
		cfg.DevAdminPassword = ""
		cfg.DevStaffPassword = ""
	}

	return cfg
}

func (c *Config) IsProduction() bool {
	return strings.EqualFold(c.Env, "production") || strings.EqualFold(c.Env, "prod")
}

func (c *Config) Validate() error {
	if c.IsProduction() {
		if c.JWTSecret == "" || c.JWTSecret == "stockpilot-secure-auth-jwt-secret-key-32-chars-dev" {
			return errors.New("JWT_SECRET must be explicitly configured with a secure private key in production")
		}
		if len(c.JWTSecret) < 32 {
			return errors.New("JWT_SECRET must be at least 32 characters in production")
		}
		if c.DevAdminPassword != "" || c.DevStaffPassword != "" {
			return errors.New("development seed credentials must not be present in production")
		}
	}
	return nil
}

func (c *Config) DatabaseURL() string {
	if c.DBPassword != "" {
		return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
			c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName, c.DBSSLMode)
	}
	return fmt.Sprintf("postgres://%s@%s:%s/%s?sslmode=%s",
		c.DBUser, c.DBHost, c.DBPort, c.DBName, c.DBSSLMode)
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}

func getEnvAsInt(key string, defaultVal int) int {
	valStr := getEnv(key, "")
	if val, err := strconv.Atoi(valStr); err == nil {
		return val
	}
	return defaultVal
}

func getEnvAsDuration(key string, defaultVal time.Duration) time.Duration {
	valStr := getEnv(key, "")
	if val, err := time.ParseDuration(valStr); err == nil {
		return val
	}
	return defaultVal
}

package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"pokefactory/backend/internal/web"
)

func envValue(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		log.Fatalf("invalid %s: %v", key, err)
	}
	return parsed
}

func main() {
	host := envValue("HOST", "0.0.0.0")
	port := envValue("PORT", "3000")
	app, err := web.New(web.Config{
		WebRoot:            envValue("WEB_ROOT", "dist"),
		StorageRoot:        envValue("STORAGE_ROOT", "storage"),
		StateRoot:          envValue("STATE_DIR", "var"),
		AllowUpstreamFetch: envBool("ALLOW_UPSTREAM_FETCH", true),
	})
	if err != nil {
		log.Fatal(err)
	}

	server := &http.Server{
		Addr:              host + ":" + port,
		Handler:           app.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       90 * time.Second,
	}

	go func() {
		log.Printf("PokeFactory Go server listening on http://%s", server.Addr)
		if serveErr := server.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			log.Fatal(serveErr)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownContext, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownContext); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}

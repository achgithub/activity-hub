package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// HandleAppLaunch - POST /api/apps/{appId}/launch
// Launches an app if not already running (idempotent)
func HandleAppLaunch(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	appID := vars["appId"]

	gameID := r.URL.Query().Get("gameId")

	if err := appLauncher.LaunchApp(appID, gameID); err != nil {
		log.Printf("Failed to launch app %s: %v", appID, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Failed to launch app",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"appId":   appID,
		"message": "App launched successfully",
	})
}

// HandleAppProxy - GET/POST/PUT/DELETE /api/apps/{appId}/proxy/*
// Proxies all requests to Unix socket using standard HTTP client
func HandleAppProxy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	appID := vars["appId"]
	pathParam := vars["path"]

	gameID := r.URL.Query().Get("gameId")

	// Get socket path (launches if needed)
	socketPath, err := appLauncher.GetSocketPath(appID, gameID)
	if err != nil {
		log.Printf("Failed to get socket for app %s: %v", appID, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "App not available",
		})
		return
	}

	// Build target path (remove /api/apps/{appId}/proxy prefix)
	targetPath := "/" + pathParam
	if targetPath == "/" {
		targetPath = "/"
	}

	// Create HTTP client with Unix socket transport
	client := &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				return net.Dial("unix", socketPath)
			},
			MaxIdleConns:        1,
			MaxIdleConnsPerHost: 1,
			DisableKeepAlives:   false,
		},
		// No timeout for streaming responses
	}
	defer client.CloseIdleConnections()

	// Build request to app
	url := "http://unix" + targetPath
	if r.URL.RawQuery != "" {
		url += "?" + r.URL.RawQuery  // Preserve query parameters (including token)
	}

	proxyReq, err := http.NewRequestWithContext(r.Context(), r.Method, url, r.Body)
	if err != nil {
		log.Printf("Failed to create proxy request: %v", err)
		w.WriteHeader(http.StatusBadGateway)
		return
	}

	// Copy headers from original request
	proxyReq.Header = r.Header.Clone()

	// Log for debugging
	log.Printf("Proxy request to %s via socket %s", url, socketPath)

	// Send request to app
	resp, err := client.Do(proxyReq)
	if err != nil {
		log.Printf("Failed to proxy request to app %s: %v", appID, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Proxy error",
		})
		return
	}
	defer resp.Body.Close()

	log.Printf("Response from app %s: status=%d, content-length=%s", appID, resp.StatusCode, resp.Header.Get("Content-Length"))

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Set status code
	w.WriteHeader(resp.StatusCode)

	// Stream response body with detailed error logging
	copied, err := io.Copy(w, resp.Body)
	log.Printf("Copied %d bytes for app %s, error: %v", copied, appID, err)

	// Update activity timestamp
	appLauncher.mu.Lock()
	if proc, exists := appLauncher.processes[appID]; exists {
		proc.LastActivity = time.Now()
	}
	appLauncher.mu.Unlock()
}

// HandleAppStop - POST /api/apps/{appId}/stop
// Gracefully stops a running app
func HandleAppStop(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	appID := vars["appId"]

	if err := appLauncher.StopApp(appID); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Failed to stop app",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"appId":   appID,
		"message": "App stopped successfully",
	})
}

// HandleGetRunningApps - GET /api/apps/running
// Returns list of currently running apps with their status
func HandleGetRunningApps(w http.ResponseWriter, r *http.Request) {
	appLauncher.mu.RLock()
	defer appLauncher.mu.RUnlock()

	apps := make([]map[string]interface{}, 0, len(appLauncher.processes))
	for appID, proc := range appLauncher.processes {
		if proc.Status == StatusRunning || proc.Status == StatusLaunching {
			apps = append(apps, map[string]interface{}{
				"appId":         appID,
				"pid":           proc.PID,
				"status":        proc.Status,
				"startedAt":     proc.StartedAt,
				"lastActivity":  proc.LastActivity,
				"idleSeconds":   int(time.Since(proc.LastActivity).Seconds()),
				"socketPath":    proc.SocketPath,
				"restartCount":  proc.RestartCount,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"apps":  apps,
		"count": len(apps),
	})
}

// HandleAppHealth - GET /api/apps/{appId}/health
// Check health of a specific app
func HandleAppHealth(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	appID := vars["appId"]

	appLauncher.mu.RLock()
	proc, exists := appLauncher.processes[appID]
	appLauncher.mu.RUnlock()

	if !exists {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "not_found",
			"appId":  appID,
		})
		return
	}

	healthy := proc.Status == StatusRunning
	statusCode := http.StatusOK
	if !healthy {
		statusCode = http.StatusServiceUnavailable
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"appId":        appID,
		"status":       proc.Status,
		"healthy":      healthy,
		"pid":          proc.PID,
		"startedAt":    proc.StartedAt,
		"lastActivity": proc.LastActivity,
	})
}

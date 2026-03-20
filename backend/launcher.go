package main

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"sync"
	"time"
)

// AppProcess tracks a running mini-app process
type AppProcess struct {
	AppID             string
	PID               int
	SocketPath        string
	Status            string    // launching, running, idle, shutting_down, crashed
	StartedAt         time.Time
	LastActivity      time.Time
	LastHealthCheck   time.Time
	RestartCount      int
	Cmd               *exec.Cmd
	HealthCheckFails  int
}

// AppLauncher manages mini-app lifecycle
type AppLauncher struct {
	processes map[string]*AppProcess
	mu        sync.RWMutex
	ctx       context.Context
	cancel    context.CancelFunc
}

const (
	StatusLaunching    = "launching"
	StatusRunning      = "running"
	StatusIdle         = "idle"
	StatusShuttingDown = "shutting_down"
	StatusCrashed      = "crashed"

	SocketDir            = "/tmp"
	SocketPrefix         = "activity-hub-"

	IdleTimeout          = 10 * time.Minute
	HealthCheckInterval  = 30 * time.Second
	LaunchTimeout        = 10 * time.Second
	ShutdownTimeout      = 30 * time.Second
	MaxRestarts          = 3
	MaxHealthCheckFails  = 3
)

// NewAppLauncher creates a new app launcher
func NewAppLauncher() *AppLauncher {
	ctx, cancel := context.WithCancel(context.Background())
	al := &AppLauncher{
		processes: make(map[string]*AppProcess),
		ctx:       ctx,
		cancel:    cancel,
	}

	// Start background monitors
	go al.heartbeatMonitor()
	go al.healthCheckMonitor()

	return al
}

// LaunchApp starts an app if not already running
func (al *AppLauncher) LaunchApp(appID string, gameID string) error {
	al.mu.Lock()

	// Check if already running
	if proc, exists := al.processes[appID]; exists {
		al.mu.Unlock()
		if proc.Status == StatusRunning {
			proc.LastActivity = time.Now()
			return nil  // Already running
		}
		// Cleanup old process
		al.mu.Lock()
		delete(al.processes, appID)
		al.mu.Unlock()
	}
	al.mu.Unlock()

	// Get app definition from registry
	app := GetAppByID(appID)
	if app == nil {
		return fmt.Errorf("app not found: %s", appID)
	}

	// Build socket path
	socketPath := fmt.Sprintf("%s/%s%s.sock", SocketDir, SocketPrefix, appID)

	// Remove old socket if exists
	os.Remove(socketPath)

	// Build command - look for compiled binary in ./apps/{appId}/backend/
	// Use relative path from the backend directory
	binaryPath := fmt.Sprintf("./%s-app", appID)
	cmd := exec.Command(binaryPath)

	// Set environment variables
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("APP_ID=%s", appID),
		fmt.Sprintf("SOCKET_PATH=%s", socketPath),
		"ACTIVITY_HUB_URL=http://localhost:3000",
		"DB_HOST=127.0.0.1",
		"DB_PORT=5432",
		"DB_USER=activityhub",
		"DB_PASS=pubgames",
		"REDIS_HOST=127.0.0.1",
		"REDIS_PORT=6379",
	)

	// Add game ID if provided (for single-game-per-process apps)
	if gameID != "" {
		cmd.Env = append(cmd.Env, fmt.Sprintf("GAME_ID=%s", gameID))
	}

	// Set working directory
	cmd.Dir = fmt.Sprintf("./apps/%s/backend", appID)

	// Capture logs
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	// Start process
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start app: %w", err)
	}

	// Track process
	proc := &AppProcess{
		AppID:           appID,
		PID:             cmd.Process.Pid,
		SocketPath:      socketPath,
		Status:          StatusLaunching,
		StartedAt:       time.Now(),
		LastActivity:    time.Now(),
		Cmd:             cmd,
		HealthCheckFails: 0,
	}

	al.mu.Lock()
	al.processes[appID] = proc
	al.mu.Unlock()

	// Wait for socket to appear
	if err := al.waitForSocket(socketPath, LaunchTimeout); err != nil {
		al.killProcess(proc)
		return fmt.Errorf("app failed to create socket: %w", err)
	}

	proc.Status = StatusRunning
	log.Printf("✅ Launched app %s (PID %d) on socket %s", appID, proc.PID, socketPath)

	// Log to database
	go LogAppEvent(appID, "launched", proc.PID, gameID)

	return nil
}

// waitForSocket polls for socket file creation
func (al *AppLauncher) waitForSocket(socketPath string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if _, err := os.Stat(socketPath); err == nil {
			// Socket exists, try to connect
			conn, err := net.Dial("unix", socketPath)
			if err == nil {
				conn.Close()
				return nil
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("timeout waiting for socket")
}

// GetSocketPath returns socket path for an app (launches if needed)
func (al *AppLauncher) GetSocketPath(appID string, gameID string) (string, error) {
	if err := al.LaunchApp(appID, gameID); err != nil {
		return "", err
	}

	al.mu.RLock()
	defer al.mu.RUnlock()

	proc, exists := al.processes[appID]
	if !exists || proc.Status != StatusRunning {
		return "", fmt.Errorf("app not running")
	}

	proc.LastActivity = time.Now()
	return proc.SocketPath, nil
}

// StopApp gracefully shuts down an app
func (al *AppLauncher) StopApp(appID string) error {
	al.mu.Lock()
	proc, exists := al.processes[appID]
	if !exists {
		al.mu.Unlock()
		return nil  // Already stopped
	}

	proc.Status = StatusShuttingDown
	al.mu.Unlock()

	// Send SIGTERM
	if err := proc.Cmd.Process.Signal(os.Interrupt); err != nil {
		return err
	}

	// Wait for graceful shutdown
	done := make(chan error)
	go func() {
		done <- proc.Cmd.Wait()
	}()

	select {
	case <-time.After(ShutdownTimeout):
		// Force kill
		proc.Cmd.Process.Kill()
		log.Printf("⚠️  Force killed app %s (PID %d)", appID, proc.PID)
	case <-done:
		log.Printf("✅ App %s (PID %d) shut down gracefully", appID, proc.PID)
	}

	// Clean up socket
	os.Remove(proc.SocketPath)

	al.mu.Lock()
	delete(al.processes, appID)
	al.mu.Unlock()

	go LogAppEvent(appID, "stopped", proc.PID, "")

	return nil
}

// killProcess forcefully kills a process
func (al *AppLauncher) killProcess(proc *AppProcess) {
	if proc.Cmd != nil && proc.Cmd.Process != nil {
		proc.Cmd.Process.Kill()
		os.Remove(proc.SocketPath)
	}
}

// heartbeatMonitor checks for idle apps every 5 minutes
func (al *AppLauncher) heartbeatMonitor() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-al.ctx.Done():
			return
		case <-ticker.C:
			al.checkIdleApps()
		}
	}
}

// checkIdleApps shuts down apps idle for > 10 minutes
func (al *AppLauncher) checkIdleApps() {
	al.mu.Lock()
	defer al.mu.Unlock()

	now := time.Now()
	for appID, proc := range al.processes {
		if proc.Status != StatusRunning {
			continue
		}

		idleDuration := now.Sub(proc.LastActivity)
		if idleDuration > IdleTimeout {
			log.Printf("🔄 App %s idle for %v, shutting down", appID, idleDuration)
			// Don't hold lock while stopping
			al.mu.Unlock()
			al.StopApp(appID)
			al.mu.Lock()
		}
	}
}

// healthCheckMonitor pings apps every 30 seconds
func (al *AppLauncher) healthCheckMonitor() {
	ticker := time.NewTicker(HealthCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-al.ctx.Done():
			return
		case <-ticker.C:
			al.checkAppHealth()
		}
	}
}

// checkAppHealth sends /api/health request to each running app
func (al *AppLauncher) checkAppHealth() {
	al.mu.RLock()
	apps := make([]*AppProcess, 0, len(al.processes))
	for _, proc := range al.processes {
		if proc.Status == StatusRunning {
			apps = append(apps, proc)
		}
	}
	al.mu.RUnlock()

	for _, proc := range apps {
		if err := al.pingApp(proc); err != nil {
			log.Printf("⚠️  Health check failed for %s: %v", proc.AppID, err)
			al.handleFailedHealthCheck(proc)
		} else {
			al.mu.Lock()
			proc.LastHealthCheck = time.Now()
			proc.HealthCheckFails = 0  // Reset failures on success
			al.mu.Unlock()
		}
	}
}

// pingApp sends HTTP request through Unix socket
func (al *AppLauncher) pingApp(proc *AppProcess) error {
	client := &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				return net.Dial("unix", proc.SocketPath)
			},
		},
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get("http://unix/api/health")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("unhealthy: status %d", resp.StatusCode)
	}

	return nil
}

// handleFailedHealthCheck attempts to restart crashed apps
func (al *AppLauncher) handleFailedHealthCheck(proc *AppProcess) {
	al.mu.Lock()
	proc.HealthCheckFails++

	if proc.HealthCheckFails >= MaxHealthCheckFails {
		proc.Status = StatusCrashed
		proc.RestartCount++

		log.Printf("💥 App %s crashed (restart %d/%d)", proc.AppID, proc.RestartCount, MaxRestarts)

		if proc.RestartCount < MaxRestarts {
			// Attempt restart
			al.killProcess(proc)
			appID := proc.AppID
			al.mu.Unlock()

			go func() {
				time.Sleep(5 * time.Second)
				al.LaunchApp(appID, "")
			}()
		} else {
			log.Printf("❌ App %s exceeded max restarts, giving up", proc.AppID)
			al.killProcess(proc)
			delete(al.processes, proc.AppID)
			al.mu.Unlock()
		}

		go LogAppEvent(proc.AppID, "crashed", proc.PID, "")
	} else {
		al.mu.Unlock()
	}
}

// Cleanup stops all apps
func (al *AppLauncher) Cleanup() {
	al.cancel()

	al.mu.Lock()
	defer al.mu.Unlock()

	appIDs := make([]string, 0, len(al.processes))
	for appID := range al.processes {
		appIDs = append(appIDs, appID)
	}
	al.mu.Unlock()

	for _, appID := range appIDs {
		al.StopApp(appID)
	}
}

// ProxyRequest forwards an HTTP request through a Unix socket
func ProxyRequest(socketPath string, r *http.Request) (*http.Response, error) {
	// Connect to Unix socket
	conn, err := net.Dial("unix", socketPath)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to socket: %w", err)
	}
	defer conn.Close()

	// Build HTTP request to send through socket
	clientReq := &http.Request{
		Method: r.Method,
		URL:    r.URL,
		Header: r.Header,
		Body:   r.Body,
	}

	// Reset request fields for socket communication
	clientReq.RequestURI = ""
	clientReq.RemoteAddr = ""

	// Send request through socket
	if err := clientReq.Write(conn); err != nil {
		return nil, fmt.Errorf("failed to write request: %w", err)
	}

	// Read response from socket
	resp, err := http.ReadResponse(bufio.NewReader(conn), clientReq)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return resp, nil
}

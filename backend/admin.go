package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/achgithub/activity-hub-auth"
	"github.com/gorilla/mux"
	"github.com/lib/pq"
)

// requireAuth middleware - validates JWT token and adds email to context
func requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Extract token
		token := authHeader
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}

		// Validate token using auth library
		user, err := auth.ResolveToken(db, token)
		if err != nil {
			log.Printf("Auth failed: %v", err)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Add user email to context
		ctx := context.WithValue(r.Context(), "user_email", user.Email)
		next(w, r.WithContext(ctx))
	}
}

// requireSetupAdmin middleware - only allows users with setup_admin role
func requireSetupAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Extract token
		token := authHeader
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}

		// Validate token using auth library
		user, err := auth.ResolveToken(db, token)
		if err != nil {
			log.Printf("Auth failed for requireSetupAdmin: %v", err)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Check if user is admin using isUserAdmin helper
		if !isUserAdmin(user.Email) {
			http.Error(w, "Forbidden - admin role required", http.StatusForbidden)
			return
		}

		// User is authorized, proceed
		next(w, r)
	}
}

// requireSuperUser middleware - only allows users with super_user role
func requireSuperUser(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Extract token
		token := authHeader
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}

		// Validate token using auth library
		user, err := auth.ResolveToken(db, token)
		if err != nil {
			log.Printf("Auth failed for requireSuperUser: %v", err)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Check for ah_g_super group (replaces legacy super_user role)
		// Query user_roles table to check for ah_g_super
		var hasSuperGroup bool
		err = db.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM user_roles
				WHERE user_email = $1 AND role_id = 'ah_g_super'
			)
		`, user.Email).Scan(&hasSuperGroup)
		if err != nil || !hasSuperGroup {
			http.Error(w, "Forbidden - super admin role required", http.StatusForbidden)
			return
		}

		// User is authorized, proceed
		next(w, r)
	}
}

// handleAdminGetApps returns all apps (including disabled) for admin management
func handleAdminGetApps(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
		SELECT id, name, icon, type, description, category,
		       COALESCE(url, ''), COALESCE(backend_port, 0), COALESCE(realtime, 'none'),
		       min_players, max_players,
		       COALESCE(required_roles, '{}'), enabled, display_order,
		       created_at, updated_at
		FROM applications
		ORDER BY display_order, name
	`)
	if err != nil {
		log.Printf("Error querying apps: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var apps []map[string]interface{}
	for rows.Next() {
		var (
			id, name, icon, appType, description, category   string
			url, realtime                                    string
			backendPort, displayOrder                        int
			minPlayers, maxPlayers                            sql.NullInt64
			requiredRoles                                     pq.StringArray
			enabled                                           bool
			createdAt, updatedAt                              sql.NullTime
		)

		err := rows.Scan(
			&id, &name, &icon, &appType, &description, &category,
			&url, &backendPort, &realtime,
			&minPlayers, &maxPlayers,
			&requiredRoles, &enabled, &displayOrder,
			&createdAt, &updatedAt,
		)
		if err != nil {
			log.Printf("Error scanning app: %v", err)
			continue
		}

		app := map[string]interface{}{
			"id":            id,
			"name":          name,
			"icon":          icon,
			"type":          appType,
			"description":   description,
			"category":      category,
			"url":           url,
			"backendPort":   backendPort,
			"realtime":      realtime,
			"requiredRoles": requiredRoles,
			"enabled":       enabled,
			"displayOrder":  displayOrder,
		}

		// Add optional fields only if set
		if minPlayers.Valid {
			app["minPlayers"] = int(minPlayers.Int64)
		}
		if maxPlayers.Valid {
			app["maxPlayers"] = int(maxPlayers.Int64)
		}
		if createdAt.Valid {
			app["createdAt"] = createdAt.Time
		}
		if updatedAt.Valid {
			app["updatedAt"] = updatedAt.Time
		}

		apps = append(apps, app)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"apps": apps,
	})
}

// handleAdminUpdateApp updates an existing app
func handleAdminUpdateApp(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	appID := vars["id"]

	var req struct {
		Name          string   `json:"name"`
		Icon          string   `json:"icon"`
		Description   string   `json:"description"`
		Category      string   `json:"category"`
		URL           string   `json:"url"`
		BackendPort   int      `json:"backendPort"`
		Realtime      string   `json:"realtime"`
		MinPlayers    int      `json:"minPlayers"`
		MaxPlayers    int      `json:"maxPlayers"`
		RequiredRoles []string `json:"requiredRoles"`
		Enabled       bool     `json:"enabled"`
		DisplayOrder  int      `json:"displayOrder"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update app in database
	_, err := db.Exec(`
		UPDATE applications
		SET name = $1, icon = $2, description = $3, category = $4,
		    url = $5, backend_port = $6, realtime = $7,
		    min_players = $8, max_players = $9,
		    required_roles = $10, enabled = $11, display_order = $12
		WHERE id = $13
	`,
		req.Name, req.Icon, req.Description, req.Category,
		req.URL, req.BackendPort, req.Realtime,
		req.MinPlayers, req.MaxPlayers,
		pq.Array(req.RequiredRoles), req.Enabled, req.DisplayOrder,
		appID,
	)

	if err != nil {
		log.Printf("Error updating app: %v", err)
		http.Error(w, "Failed to update app", http.StatusInternalServerError)
		return
	}

	// Reload app registry
	if err := ReloadAppRegistry(); err != nil {
		log.Printf("Warning: Failed to reload app registry: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "App updated successfully",
	})
}

// handleAdminToggleApp enables or disables an app
func handleAdminToggleApp(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	appID := vars["id"]
	action := vars["action"] // "enable" or "disable"

	enabled := action == "enable"

	_, err := db.Exec("UPDATE applications SET enabled = $1 WHERE id = $2", enabled, appID)
	if err != nil {
		log.Printf("Error toggling app: %v", err)
		http.Error(w, "Failed to toggle app", http.StatusInternalServerError)
		return
	}

	// Reload app registry
	if err := ReloadAppRegistry(); err != nil {
		log.Printf("Warning: Failed to reload app registry: %v", err)
	}

	status := "disabled"
	if enabled {
		status = "enabled"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "App " + status + " successfully",
	})
}

// handleAdminDeleteApp deletes an app and all related data
func handleAdminDeleteApp(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	appID := vars["id"]

	// First, clean up app-specific user roles
	// app_roles will be cascade deleted, but user_roles needs manual cleanup
	_, err := db.Exec("DELETE FROM user_roles WHERE role_id LIKE $1", appID+":%")
	if err != nil {
		log.Printf("Error deleting app user roles: %v", err)
		http.Error(w, "Failed to delete app user roles", http.StatusInternalServerError)
		return
	}

	// Delete the application (CASCADE will delete app_roles, app_manifests, challenges, etc.)
	result, err := db.Exec("DELETE FROM applications WHERE id = $1", appID)
	if err != nil {
		log.Printf("Error deleting app: %v", err)
		http.Error(w, "Failed to delete app", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "App not found", http.StatusNotFound)
		return
	}

	// Reload app registry
	if err := ReloadAppRegistry(); err != nil {
		log.Printf("Warning: Failed to reload app registry: %v", err)
	}

	log.Printf("Deleted app: %s", appID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "App deleted successfully",
	})
}

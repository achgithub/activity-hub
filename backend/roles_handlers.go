package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/lib/pq"
)

// HandleGetUserContext - GET /api/user/context
// Returns current user's roles, app info, and whether they're in test mode
func HandleGetUserContext(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || len(authHeader) <= 7 {
		http.Error(w, "Missing authorization", http.StatusUnauthorized)
		return
	}

	token := authHeader[7:] // Remove "Bearer " prefix
	user, err := auth.ResolveToken(db, token)
	if err != nil {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	// Fetch user's roles
	var roles pq.StringArray
	err = db.QueryRow(`
		SELECT COALESCE(array_agg(role_id), ARRAY[]::text[])
		FROM user_roles
		WHERE user_email = $1
	`, user.Email).Scan(&roles)
	if err != nil {
		log.Printf("Failed to fetch user roles: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	// Check if user is admin (has any ah_g_* group or ah_r_app_control)
	isAdmin := false
	for _, role := range roles {
		if role == "ah_g_super" || role == "ah_g_admin" || role == "ah_r_app_control" {
			isAdmin = true
			break
		}
	}

	// Check if in test mode (admin accessing app)
	isTestMode := isAdmin

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"user": map[string]interface{}{
			"email": user.Email,
			"name":  user.Name,
		},
		"roles":     roles,
		"isTestMode": isTestMode,
	})
}

// HandleGetAHRoles - GET /api/admin/roles
// List all Activity Hub roles and groups
func HandleGetAHRoles(w http.ResponseWriter, r *http.Request) {
	// Check admin permission
	token := r.Header.Get("Authorization")
	if token == "" || len(token) <= 7 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := resolveToken(token[7:])
	if err != nil || !isUserAdmin(user.Email) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Fetch groups
	groupRows, err := db.Query(`
		SELECT id, name, description
		FROM ah_groups
		ORDER BY id
	`)
	if err != nil {
		log.Printf("Failed to fetch groups: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	defer groupRows.Close()

	var groups []map[string]interface{}
	for groupRows.Next() {
		var id, name string
		var description *string
		groupRows.Scan(&id, &name, &description)
		groups = append(groups, map[string]interface{}{
			"id":          id,
			"name":        name,
			"description": description,
			"type":        "group",
		})
	}

	// Fetch roles
	roleRows, err := db.Query(`
		SELECT id, name, description
		FROM ah_roles
		ORDER BY id
	`)
	if err != nil {
		log.Printf("Failed to fetch roles: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	defer roleRows.Close()

	var roles []map[string]interface{}
	for roleRows.Next() {
		var id, name string
		var description *string
		roleRows.Scan(&id, &name, &description)
		roles = append(roles, map[string]interface{}{
			"id":          id,
			"name":        name,
			"description": description,
			"type":        "role",
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"groups": groups,
		"roles":  roles,
	})
}

// HandleAssignRole - POST /api/admin/users/{email}/roles/{role}
// Assign a role to a user
func HandleAssignRole(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userEmail := vars["email"]
	roleId := vars["role"]

	// Check admin permission
	token := r.Header.Get("Authorization")
	if token == "" || len(token) <= 7 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	admin, err := resolveToken(token[7:])
	if err != nil || !isUserAdmin(admin.Email) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Insert or update role assignment
	_, err = db.Exec(`
		INSERT INTO user_roles (user_email, role_id, assigned_by)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_email, role_id) DO NOTHING
	`, userEmail, roleId, admin.Email)

	if err != nil {
		log.Printf("Failed to assign role: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Role assigned",
	})
}

// HandleRevokeRole - DELETE /api/admin/users/{email}/roles/{role}
// Remove a role from a user
func HandleRevokeRole(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userEmail := vars["email"]
	roleId := vars["role"]

	// Check admin permission
	token := r.Header.Get("Authorization")
	if token == "" || len(token) <= 7 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	admin, err := resolveToken(token[7:])
	if err != nil || !isUserAdmin(admin.Email) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Delete role assignment
	_, err = db.Exec(`
		DELETE FROM user_roles
		WHERE user_email = $1 AND role_id = $2
	`, userEmail, roleId)

	if err != nil {
		log.Printf("Failed to revoke role: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Role revoked",
	})
}

// HandleGetUserRoles - GET /api/admin/users/{email}/roles
// Get all roles assigned to a user
func HandleGetUserRoles(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userEmail := vars["email"]

	// Check admin permission
	token := r.Header.Get("Authorization")
	if token == "" || len(token) <= 7 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	admin, err := resolveToken(token[7:])
	if err != nil || !isUserAdmin(admin.Email) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var roles pq.StringArray
	err = db.QueryRow(`
		SELECT COALESCE(array_agg(role_id), ARRAY[]::text[])
		FROM user_roles
		WHERE user_email = $1
	`, userEmail).Scan(&roles)

	if err != nil {
		log.Printf("Failed to fetch user roles: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"email": userEmail,
		"roles": roles,
	})
}

// HandleRegisterApp - POST /api/admin/apps/register
// Register a new app with manifest
func HandleRegisterApp(w http.ResponseWriter, r *http.Request) {
	// Check admin permission
	token := r.Header.Get("Authorization")
	if token == "" || len(token) <= 7 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	admin, err := resolveToken(token[7:])
	if err != nil || !isUserAdmin(admin.Email) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var req struct {
		Id          string                   `json:"id"`
		Name        string                   `json:"name"`
		Icon        string                   `json:"icon"`
		Category    string                   `json:"category"`
		Description string                   `json:"description"`
		Realtime    string                   `json:"realtime"`
		MinPlayers  int                      `json:"minPlayers"`
		MaxPlayers  int                      `json:"maxPlayers"`
		Roles       []map[string]interface{} `json:"roles"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Insert application
	_, err = db.Exec(`
		INSERT INTO applications (id, name, icon, category, description, realtime, min_players, max_players, enabled, display_order, type)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, 999, $9)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			icon = EXCLUDED.icon,
			description = EXCLUDED.description,
			realtime = EXCLUDED.realtime,
			min_players = EXCLUDED.min_players,
			max_players = EXCLUDED.max_players
	`, req.Id, req.Name, req.Icon, req.Category, req.Description, req.Realtime, req.MinPlayers, req.MaxPlayers, req.Category)

	if err != nil {
		log.Printf("Failed to insert app: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	// Insert app roles
	for _, role := range req.Roles {
		roleId := role["id"].(string)
		label := role["label"].(string)
		description := role["description"].(string)
		isDefault := role["isDefault"].(bool)
		isRestricted := role["isRestricted"].(bool)

		_, err = db.Exec(`
			INSERT INTO app_roles (app_id, role_id, label, description, is_default, is_restricted)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (app_id, role_id) DO UPDATE SET
				label = EXCLUDED.label,
				description = EXCLUDED.description,
				is_default = EXCLUDED.is_default,
				is_restricted = EXCLUDED.is_restricted
		`, req.Id, req.Id+":"+roleId, label, description, isDefault, isRestricted)

		if err != nil {
			log.Printf("Failed to insert app role: %v", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "App registered successfully",
		"appId":   req.Id,
	})
}

// isUserAdmin checks if user has admin permissions
func isUserAdmin(email string) bool {
	var hasAdmin bool
	err := db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM user_roles
			WHERE user_email = $1 AND (
				role_id LIKE 'ah_g_%' OR
				role_id = 'ah_r_app_control' OR
				role_id = 'ah_r_user_manage'
			)
		)
	`, email).Scan(&hasAdmin)
	return hasAdmin && err == nil
}

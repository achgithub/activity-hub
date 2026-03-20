package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/achgithub/activity-hub-auth"
	"github.com/gorilla/mux"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
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

	user, err := auth.ResolveToken(db, token[7:])
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

	admin, err := auth.ResolveToken(db, token[7:])
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

	admin, err := auth.ResolveToken(db, token[7:])
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

	admin, err := auth.ResolveToken(db, token[7:])
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

	admin, err := auth.ResolveToken(db, token[7:])
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
		BinaryPath  string                   `json:"binaryPath"`
		StaticPath  string                   `json:"staticPath"`
		Roles       []map[string]interface{} `json:"roles"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Insert application
	_, err = db.Exec(`
		INSERT INTO applications (id, name, icon, category, description, realtime, min_players, max_players, binary_path, static_path, enabled, display_order, type)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, 999, $11)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			icon = EXCLUDED.icon,
			description = EXCLUDED.description,
			realtime = EXCLUDED.realtime,
			min_players = EXCLUDED.min_players,
			max_players = EXCLUDED.max_players,
			binary_path = EXCLUDED.binary_path,
			static_path = EXCLUDED.static_path
	`, req.Id, req.Name, req.Icon, req.Category, req.Description, req.Realtime, req.MinPlayers, req.MaxPlayers, req.BinaryPath, req.StaticPath, req.Category)

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

// HandleCreateUser - POST /api/admin/users
// Create a new user account
func HandleCreateUser(w http.ResponseWriter, r *http.Request) {
	// Check admin permission
	token := r.Header.Get("Authorization")
	if token == "" || len(token) <= 7 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	admin, err := auth.ResolveToken(db, token[7:])
	if err != nil || !isUserAdmin(admin.Email) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var req struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		http.Error(w, "Email and password required", http.StatusBadRequest)
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Failed to hash password: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	// Insert user
	_, err = db.Exec(`
		INSERT INTO users (email, name, code_hash, is_admin, email_verified, created_at)
		VALUES ($1, $2, $3, FALSE, FALSE, NOW())
		ON CONFLICT (email) DO NOTHING
	`, req.Email, req.Name, string(hashedPassword))

	if err != nil {
		log.Printf("Failed to create user: %v", err)
		if err.Error() == "pq: duplicate key value violates unique constraint \"users_pkey\"" {
			http.Error(w, "User already exists", http.StatusConflict)
		} else {
			http.Error(w, "Internal error", http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "User created successfully",
		"email":   req.Email,
	})
}

// HandleResetUserPassword - POST /api/admin/users/{email}/reset-password
// Reset a user's password
func HandleResetUserPassword(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userEmail := vars["email"]

	// Check admin permission
	token := r.Header.Get("Authorization")
	if token == "" || len(token) <= 7 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	admin, err := auth.ResolveToken(db, token[7:])
	if err != nil || !isUserAdmin(admin.Email) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var req struct {
		NewPassword string `json:"newPassword"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.NewPassword == "" {
		http.Error(w, "New password required", http.StatusBadRequest)
		return
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Failed to hash password: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	// Update user password
	result, err := db.Exec(`
		UPDATE users
		SET code_hash = $1
		WHERE email = $2
	`, string(hashedPassword), userEmail)

	if err != nil {
		log.Printf("Failed to reset password: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Password reset successfully",
	})
}

// HandleCreateRole - POST /api/admin/roles
// Create a new role or group
func HandleCreateRole(w http.ResponseWriter, r *http.Request) {
	// Check admin permission
	token := r.Header.Get("Authorization")
	if token == "" || len(token) <= 7 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	admin, err := auth.ResolveToken(db, token[7:])
	if err != nil || !isUserAdmin(admin.Email) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var req struct {
		Id          string `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		Type        string `json:"type"` // 'role' or 'group'
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Id == "" || req.Name == "" || (req.Type != "role" && req.Type != "group") {
		http.Error(w, "ID, name, and type required", http.StatusBadRequest)
		return
	}

	// Determine table based on type
	table := "ah_roles"
	if req.Type == "group" {
		table = "ah_groups"
	}

	// Insert role/group
	_, err = db.Exec(fmt.Sprintf(`
		INSERT INTO %s (id, name, description)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description
	`, table), req.Id, req.Name, req.Description)

	if err != nil {
		log.Printf("Failed to create role: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Role created successfully",
		"id":      req.Id,
	})
}

// HandleGetUsers - GET /api/admin/users
// List all users with their assigned roles
func HandleGetUsers(w http.ResponseWriter, r *http.Request) {
	// Check admin permission
	token := r.Header.Get("Authorization")
	if token == "" || len(token) <= 7 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := auth.ResolveToken(db, token[7:])
	if err != nil || !isUserAdmin(user.Email) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Query all users with their roles
	rows, err := db.Query(`
		SELECT
			u.email,
			u.name,
			u.email_verified,
			u.created_at,
			COALESCE(array_agg(ur.role_id) FILTER (WHERE ur.role_id IS NOT NULL), '{}') as roles
		FROM users u
		LEFT JOIN user_roles ur ON u.email = ur.user_email
		GROUP BY u.email, u.name, u.email_verified, u.created_at
		ORDER BY u.created_at DESC
	`)
	if err != nil {
		log.Printf("Failed to fetch users: %v", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type UserInfo struct {
		Email         string   `json:"email"`
		Name          string   `json:"name"`
		Roles         []string `json:"roles"`
		EmailVerified bool     `json:"email_verified"`
		CreatedAt     string   `json:"created_at"`
	}

	var users []UserInfo
	for rows.Next() {
		var user UserInfo
		var roles pq.StringArray
		err := rows.Scan(&user.Email, &user.Name, &user.EmailVerified, &user.CreatedAt, &roles)
		if err != nil {
			log.Printf("Failed to scan user: %v", err)
			continue
		}
		user.Roles = roles
		users = append(users, user)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"users": users,
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

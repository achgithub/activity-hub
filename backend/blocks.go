package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
)

// BlockUserRequest represents a request to block a user
type BlockUserRequest struct {
	BlockedEmail string `json:"blocked_email"`
}

// UnblockUserRequest represents a request to unblock a user
type UnblockUserRequest struct {
	BlockedEmail string `json:"blocked_email"`
}

// BlockedUser represents a blocked user record
type BlockedUser struct {
	ID           int64  `json:"id"`
	BlockerEmail string `json:"blocker_email"`
	BlockedEmail string `json:"blocked_email"`
	CreatedAt    string `json:"created_at"`
}

// BlockUserHandler handles blocking a user
func BlockUserHandler(w http.ResponseWriter, r *http.Request) {
	userEmail, ok := r.Context().Value("user_email").(string)
	if !ok || userEmail == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req BlockUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.BlockedEmail == "" {
		http.Error(w, "blocked_email is required", http.StatusBadRequest)
		return
	}

	if req.BlockedEmail == userEmail {
		http.Error(w, "Cannot block yourself", http.StatusBadRequest)
		return
	}

	// Insert block record (UNIQUE constraint prevents duplicates)
	_, err := db.Exec(`
		INSERT INTO user_blocks (blocker_email, blocked_email)
		VALUES ($1, $2)
		ON CONFLICT (blocker_email, blocked_email) DO NOTHING
	`, userEmail, req.BlockedEmail)

	if err != nil {
		log.Printf("❌ Failed to block user: %v", err)
		http.Error(w, "Failed to block user", http.StatusInternalServerError)
		return
	}

	log.Printf("🚫 User %s blocked %s", userEmail, req.BlockedEmail)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "User blocked successfully",
	})
}

// UnblockUserHandler handles unblocking a user
func UnblockUserHandler(w http.ResponseWriter, r *http.Request) {
	userEmail, ok := r.Context().Value("user_email").(string)
	if !ok || userEmail == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req UnblockUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.BlockedEmail == "" {
		http.Error(w, "blocked_email is required", http.StatusBadRequest)
		return
	}

	// Delete block record
	result, err := db.Exec(`
		DELETE FROM user_blocks
		WHERE blocker_email = $1 AND blocked_email = $2
	`, userEmail, req.BlockedEmail)

	if err != nil {
		log.Printf("❌ Failed to unblock user: %v", err)
		http.Error(w, "Failed to unblock user", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Block not found", http.StatusNotFound)
		return
	}

	log.Printf("✅ User %s unblocked %s", userEmail, req.BlockedEmail)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "User unblocked successfully",
	})
}

// GetBlockedUsersHandler returns list of users that the current user has blocked
func GetBlockedUsersHandler(w http.ResponseWriter, r *http.Request) {
	userEmail, ok := r.Context().Value("user_email").(string)
	if !ok || userEmail == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := db.Query(`
		SELECT id, blocker_email, blocked_email, created_at
		FROM user_blocks
		WHERE blocker_email = $1
		ORDER BY created_at DESC
	`, userEmail)

	if err != nil {
		log.Printf("❌ Failed to fetch blocked users: %v", err)
		http.Error(w, "Failed to fetch blocked users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var blockedUsers []BlockedUser
	for rows.Next() {
		var block BlockedUser
		if err := rows.Scan(&block.ID, &block.BlockerEmail, &block.BlockedEmail, &block.CreatedAt); err != nil {
			log.Printf("❌ Failed to scan blocked user: %v", err)
			continue
		}
		blockedUsers = append(blockedUsers, block)
	}

	if blockedUsers == nil {
		blockedUsers = []BlockedUser{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(blockedUsers)
}

// IsUserBlocked checks if two users have blocked each other (bidirectional)
func IsUserBlocked(emailA, emailB string) (bool, error) {
	var blocked bool
	err := db.QueryRow(`SELECT are_users_blocked($1, $2)`, emailA, emailB).Scan(&blocked)
	if err != nil {
		return false, err
	}
	return blocked, nil
}

// FilterBlockedUsers removes blocked users from a list of emails
// Returns filtered list excluding:
// - Users that currentUser has blocked
// - Users that have blocked currentUser
func FilterBlockedUsers(currentUser string, emails []string) ([]string, error) {
	if len(emails) == 0 {
		return emails, nil
	}

	// Query for all bidirectional blocks involving currentUser
	rows, err := db.Query(`
		SELECT CASE
			WHEN blocker_email = $1 THEN blocked_email
			ELSE blocker_email
		END as other_user
		FROM user_blocks
		WHERE blocker_email = $1 OR blocked_email = $1
	`, currentUser)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Build set of blocked users
	blockedSet := make(map[string]bool)
	for rows.Next() {
		var otherUser string
		if err := rows.Scan(&otherUser); err != nil {
			return nil, err
		}
		blockedSet[otherUser] = true
	}

	// Filter out blocked users
	filtered := make([]string, 0, len(emails))
	for _, email := range emails {
		if !blockedSet[email] {
			filtered = append(filtered, email)
		}
	}

	return filtered, nil
}

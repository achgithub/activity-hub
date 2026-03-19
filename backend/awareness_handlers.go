package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

const contextTimeout = 5 * time.Second

// HandleAwarenessHeartbeat - POST /api/awareness/heartbeat
// Clients send heartbeat every 20 seconds to maintain presence
func HandleAwarenessHeartbeat(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req HeartbeatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Invalid request",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), contextTimeout)
	defer cancel()

	// Update presence in Redis
	if err := SetUserAwareness(ctx, req.UserID, req.DisplayName, req.Status, req.CurrentApp, req.Platform); err != nil {
		log.Printf("Failed to update presence: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Failed to update presence",
		})
		return
	}

	// Log to database (async)
	go LogAwarenessEvent(req.UserID, "heartbeat", req.CurrentApp, "")

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Heartbeat received",
	})
}

// HandleAwarenessStatus - POST /api/awareness/status
// User manually changes their status (away, do_not_disturb, etc.)
func HandleAwarenessStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Get user from auth token
	token := r.Header.Get("Authorization")
	if len(token) < 7 || token[:7] != "Bearer " {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Missing authorization",
		})
		return
	}

	authUser, err := auth.ResolveToken(db, token[7:])
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Invalid token",
		})
		return
	}

	var req StatusChangeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Invalid request",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), contextTimeout)
	defer cancel()

	// Get current awareness to preserve app info
	current, _ := GetUserAwareness(ctx, authUser.Email)
	currentApp := ""
	if current != nil {
		currentApp = current.CurrentApp
	}

	// Update status
	if err := SetUserAwareness(ctx, authUser.Email, authUser.Name, req.Status, currentApp, "web"); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Failed to update status",
		})
		return
	}

	// Log to database
	go LogAwarenessEvent(authUser.Email, "status_change", "", "")

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"status":  req.Status,
	})
}

// HandleGetOnlineUsers - GET /api/awareness/users (or reuse /api/lobby/presence)
// Returns list of all online users
func HandleGetOnlineUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	ctx, cancel := context.WithTimeout(context.Background(), contextTimeout)
	defer cancel()

	users, err := GetAllAwareness(ctx)
	if err != nil {
		log.Printf("Failed to get awareness: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Failed to fetch users",
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"users": users,
		"count": len(users),
	})
}

// HandleAwarenessStream - GET /api/awareness/stream
// SSE stream for presence updates (all users)
func HandleAwarenessStream(w http.ResponseWriter, r *http.Request) {
	// Setup SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Subscribe to presence updates
	ch := sseBroadcaster.Subscribe("presence")
	defer sseBroadcaster.Unsubscribe("presence", ch)

	// Flush headers
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}

	// Keep connection open and send events as they come
	for {
		select {
		case event := <-ch:
			data, _ := json.Marshal(event)
			fmt.Fprintf(w, "data: %s\n\n", string(data))
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		case <-r.Context().Done():
			return
		}
	}
}

// HandleSessionJoin - POST /api/awareness/sessions/join
// User joins a multiplayer game session
func HandleSessionJoin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Get user from auth token
	token := r.Header.Get("Authorization")
	if len(token) < 7 || token[:7] != "Bearer " {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Missing authorization",
		})
		return
	}

	authUser, err := auth.ResolveToken(db, token[7:])
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Invalid token",
		})
		return
	}

	var req SessionJoinRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Invalid request",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), contextTimeout)
	defer cancel()

	// Join session
	if err := JoinGameSession(ctx, req.AppID, req.SessionID, authUser.Email, authUser.Name); err != nil {
		log.Printf("Failed to join session: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Failed to join session",
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Joined session",
	})
}

// HandleSessionLeave - POST /api/awareness/sessions/leave
// User leaves a multiplayer game session
func HandleSessionLeave(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Get user from auth token
	token := r.Header.Get("Authorization")
	if len(token) < 7 || token[:7] != "Bearer " {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Missing authorization",
		})
		return
	}

	authUser, err := auth.ResolveToken(db, token[7:])
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Invalid token",
		})
		return
	}

	var req SessionLeaveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Invalid request",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), contextTimeout)
	defer cancel()

	// Leave session (with grace period)
	if err := LeaveGameSession(ctx, req.AppID, req.SessionID, authUser.Email); err != nil {
		log.Printf("Failed to leave session: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Failed to leave session",
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Left session (grace period active)",
	})
}

// HandleGetSessionParticipants - GET /api/awareness/sessions/{appId}/{sessionId}
// Get list of participants in a game session
func HandleGetSessionParticipants(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	appID := vars["appId"]
	sessionID := vars["sessionId"]

	ctx, cancel := context.WithTimeout(context.Background(), contextTimeout)
	defer cancel()

	participants, err := GetSessionParticipants(ctx, appID, sessionID)
	if err != nil {
		log.Printf("Failed to get participants: %v", err)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"participants": []SessionParticipant{},
			"count":        0,
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"participants": participants,
		"count":        len(participants),
	})
}

// HandleSessionStream - GET /api/awareness/sessions/stream/{appId}/{sessionId}
// SSE stream for session participant updates
func HandleSessionStream(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	appID := vars["appId"]
	sessionID := vars["sessionId"]

	// Setup SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Subscribe to session updates
	channelID := fmt.Sprintf("session:%s:%s", appID, sessionID)
	ch := sseBroadcaster.Subscribe(channelID)
	defer sseBroadcaster.Unsubscribe(channelID, ch)

	// Flush headers
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}

	// Send current participants first
	ctx, cancel := context.WithTimeout(context.Background(), contextTimeout)
	defer cancel()

	participants, _ := GetSessionParticipants(ctx, appID, sessionID)
	currentEvent := AwarenessEvent{
		Type: "session_state",
		Data: map[string]interface{}{
			"participants": participants,
			"count":        len(participants),
		},
		Timestamp: time.Now().Unix(),
	}
	data, _ := json.Marshal(currentEvent)
	fmt.Fprintf(w, "data: %s\n\n", string(data))
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}

	// Keep connection open and send events as they come
	for {
		select {
		case event := <-ch:
			data, _ := json.Marshal(event)
			fmt.Fprintf(w, "data: %s\n\n", string(data))
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		case <-r.Context().Done():
			return
		}
	}
}

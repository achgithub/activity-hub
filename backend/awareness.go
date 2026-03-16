package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"
)

// Core Awareness Types

// UserAwareness represents a user's presence and activity status
type UserAwareness struct {
	UserID        string `json:"userId"`
	DisplayName   string `json:"displayName"`
	Status        string `json:"status"` // online, in_game, away, offline, do_not_disturb
	CurrentApp    string `json:"currentApp,omitempty"`
	CurrentSession string `json:"currentSession,omitempty"`
	LastSeen      int64  `json:"lastSeen"`
	Platform      string `json:"platform,omitempty"` // web, ios, android
}

// SessionParticipant represents a user in a multiplayer game session
type SessionParticipant struct {
	UserID  string `json:"userId"`
	Name    string `json:"displayName"`
	JoinedAt int64  `json:"joinedAt"`
	Status  string `json:"status"` // active, grace_period, left
}

// HeartbeatRequest is sent by clients every 20 seconds
type HeartbeatRequest struct {
	UserID      string `json:"userId"`
	DisplayName string `json:"displayName"`
	Status      string `json:"status"`
	CurrentApp  string `json:"currentApp,omitempty"`
	Platform    string `json:"platform,omitempty"`
}

// StatusChangeRequest is sent when user manually changes status
type StatusChangeRequest struct {
	Status string `json:"status"`
}

// SessionJoinRequest is sent when user joins a game session
type SessionJoinRequest struct {
	AppID     string `json:"appId"`
	SessionID string `json:"sessionId"`
}

// SessionLeaveRequest is sent when user leaves a game session
type SessionLeaveRequest struct {
	AppID     string `json:"appId"`
	SessionID string `json:"sessionId"`
}

// AwarenessEvent is broadcast via SSE
type AwarenessEvent struct {
	Type      string      `json:"type"` // presence_update, user_online, user_offline, participant_joined, participant_left, etc.
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp"`
}

// Status Constants
const (
	StatusOnline        = "online"
	StatusInGame        = "in_game"
	StatusAway          = "away"
	StatusOffline       = "offline"
	StatusDoNotDisturb  = "do_not_disturb"

	EventPresenceUpdate         = "presence_update"
	EventUserOnline             = "user_online"
	EventUserOffline            = "user_offline"
	EventParticipantJoined      = "participant_joined"
	EventParticipantLeft        = "participant_left"
	EventParticipantReconnected = "participant_reconnected"
	EventGracePeriodExpired     = "grace_period_expired"
)

// Timing Constants
const (
	PresenceTTL         = 45 * time.Second
	HeartbeatInterval   = 20 * time.Second
	GracePeriod         = 30 * time.Second
	SessionTTL          = 1 * time.Hour
	HealthCheckInterval = 30 * time.Second
)

// SSEBroadcaster manages in-memory pub/sub for SSE streams
type SSEBroadcaster struct {
	subscribers map[string][]chan AwarenessEvent
	mu          sync.RWMutex
}

// NewSSEBroadcaster creates a new broadcaster
func NewSSEBroadcaster() *SSEBroadcaster {
	return &SSEBroadcaster{
		subscribers: make(map[string][]chan AwarenessEvent),
	}
}

// Subscribe creates a new subscription channel for a broadcast channel
func (b *SSEBroadcaster) Subscribe(channelID string) <-chan AwarenessEvent {
	b.mu.Lock()
	defer b.mu.Unlock()

	ch := make(chan AwarenessEvent, 10) // Buffered channel to prevent blocking
	b.subscribers[channelID] = append(b.subscribers[channelID], ch)
	return ch
}

// Unsubscribe removes a subscription channel
func (b *SSEBroadcaster) Unsubscribe(channelID string, ch chan AwarenessEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if subs, exists := b.subscribers[channelID]; exists {
		for i, sub := range subs {
			if sub == ch {
				// Remove the channel from subscribers
				b.subscribers[channelID] = append(subs[:i], subs[i+1:]...)
				close(ch)
				break
			}
		}
	}
}

// Broadcast sends an event to all subscribers of a channel
func (b *SSEBroadcaster) Broadcast(channelID string, event AwarenessEvent) {
	b.mu.RLock()
	subs := b.subscribers[channelID]
	b.mu.RUnlock()

	for _, ch := range subs {
		select {
		case ch <- event:
		default:
			// Channel full or closed, skip this subscriber
			log.Printf("Warning: Could not broadcast event to subscriber on channel %s", channelID)
		}
	}
}

// GetUserAwareness retrieves a user's presence from Redis
func GetUserAwareness(ctx context.Context, userID string) (*UserAwareness, error) {
	key := fmt.Sprintf("awareness:user:%s", userID)
	data, err := redisClient.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var awareness UserAwareness
	if err := json.Unmarshal([]byte(data), &awareness); err != nil {
		return nil, err
	}

	return &awareness, nil
}

// GetAllAwareness retrieves all users' presence from Redis
func GetAllAwareness(ctx context.Context) ([]UserAwareness, error) {
	keys, err := redisClient.Keys(ctx, "awareness:user:*").Result()
	if err != nil {
		return nil, err
	}

	var users []UserAwareness
	for _, key := range keys {
		data, err := redisClient.Get(ctx, key).Result()
		if err != nil {
			continue
		}

		var awareness UserAwareness
		if err := json.Unmarshal([]byte(data), &awareness); err != nil {
			continue
		}

		// Skip offline users
		if awareness.Status != StatusOffline {
			users = append(users, awareness)
		}
	}

	return users, nil
}

// SetUserAwareness updates a user's presence in Redis
func SetUserAwareness(ctx context.Context, userID, displayName, status, currentApp, platform string) error {
	key := fmt.Sprintf("awareness:user:%s", userID)
	awareness := UserAwareness{
		UserID:      userID,
		DisplayName: displayName,
		Status:      status,
		CurrentApp:  currentApp,
		LastSeen:    time.Now().Unix(),
		Platform:    platform,
	}

	data, err := json.Marshal(awareness)
	if err != nil {
		return err
	}

	// Set with TTL (45 seconds)
	if err := redisClient.Set(ctx, key, data, PresenceTTL).Err(); err != nil {
		return err
	}

	// Also publish to presence updates stream
	eventData := AwarenessEvent{
		Type:      EventPresenceUpdate,
		Data:      awareness,
		Timestamp: time.Now().Unix(),
	}
	PublishAwarenessEvent("presence", eventData)

	return nil
}

// PublishAwarenessEvent broadcasts an awareness event to SSE subscribers
func PublishAwarenessEvent(channelID string, event AwarenessEvent) {
	if sseBroadcaster != nil {
		sseBroadcaster.Broadcast(channelID, event)
	}
}

// JoinGameSession adds a user to a multiplayer game session
func JoinGameSession(ctx context.Context, appID, sessionID, userID, displayName string) error {
	sessionKey := fmt.Sprintf("awareness:session:%s:%s", appID, sessionID)

	participant := SessionParticipant{
		UserID:   userID,
		Name:     displayName,
		JoinedAt: time.Now().Unix(),
		Status:   "active",
	}

	// Add to session participants hash
	participantData, err := json.Marshal(participant)
	if err != nil {
		return err
	}

	if err := redisClient.HSet(ctx, sessionKey, userID, participantData).Err(); err != nil {
		return err
	}

	// Set session TTL (1 hour)
	if err := redisClient.Expire(ctx, sessionKey, SessionTTL).Err(); err != nil {
		return err
	}

	// Update user's current session
	if err := SetUserAwareness(ctx, userID, displayName, StatusInGame, appID, ""); err != nil {
		log.Printf("Warning: Failed to update user awareness: %v", err)
	}

	// Broadcast participant joined event
	eventData := AwarenessEvent{
		Type:      EventParticipantJoined,
		Data:      participant,
		Timestamp: time.Now().Unix(),
	}
	PublishAwarenessEvent(fmt.Sprintf("session:%s:%s", appID, sessionID), eventData)

	// Log to database
	go LogAwarenessEvent(userID, "session_join", appID, sessionID)

	return nil
}

// LeaveGameSession removes a user from a multiplayer game session
func LeaveGameSession(ctx context.Context, appID, sessionID, userID string) error {
	sessionKey := fmt.Sprintf("awareness:session:%s:%s", appID, sessionID)

	// Get participant info before removing
	participantData, err := redisClient.HGet(ctx, sessionKey, userID).Result()
	if err != nil {
		return err
	}

	var participant SessionParticipant
	if err := json.Unmarshal([]byte(participantData), &participant); err != nil {
		return err
	}

	// Set grace period (30 seconds to reconnect)
	graceKey := fmt.Sprintf("awareness:grace:%s:%s:%s", appID, sessionID, userID)
	if err := redisClient.Set(ctx, graceKey, "1", GracePeriod).Err(); err != nil {
		log.Printf("Warning: Failed to set grace period: %v", err)
	}

	// Mark as in grace period
	participant.Status = "grace_period"
	participantData, _ = json.Marshal(participant)
	if err := redisClient.HSet(ctx, sessionKey, userID, participantData).Err(); err != nil {
		return err
	}

	// Update user status back to online
	if err := SetUserAwareness(ctx, userID, participant.Name, StatusOnline, "", ""); err != nil {
		log.Printf("Warning: Failed to update user awareness: %v", err)
	}

	// Broadcast participant left event
	eventData := AwarenessEvent{
		Type:      EventParticipantLeft,
		Data:      participant,
		Timestamp: time.Now().Unix(),
	}
	PublishAwarenessEvent(fmt.Sprintf("session:%s:%s", appID, sessionID), eventData)

	// Log to database
	go LogAwarenessEvent(userID, "session_leave", appID, sessionID)

	return nil
}

// GetSessionParticipants retrieves all participants in a game session
func GetSessionParticipants(ctx context.Context, appID, sessionID string) ([]SessionParticipant, error) {
	sessionKey := fmt.Sprintf("awareness:session:%s:%s", appID, sessionID)

	data, err := redisClient.HGetAll(ctx, sessionKey).Result()
	if err != nil {
		return nil, err
	}

	var participants []SessionParticipant
	for _, participantData := range data {
		var participant SessionParticipant
		if err := json.Unmarshal([]byte(participantData), &participant); err != nil {
			continue
		}
		participants = append(participants, participant)
	}

	return participants, nil
}

// ReconnectSession marks a user as reconnected in a session (exits grace period)
func ReconnectSession(ctx context.Context, appID, sessionID, userID, displayName string) error {
	sessionKey := fmt.Sprintf("awareness:session:%s:%s", appID, sessionID)
	graceKey := fmt.Sprintf("awareness:grace:%s:%s:%s", appID, sessionID, userID)

	// Check if grace period is still active
	_, err := redisClient.Get(ctx, graceKey).Result()
	if err != nil {
		// Grace period expired
		return fmt.Errorf("grace period expired")
	}

	// Get participant
	participantData, err := redisClient.HGet(ctx, sessionKey, userID).Result()
	if err != nil {
		return err
	}

	var participant SessionParticipant
	if err := json.Unmarshal([]byte(participantData), &participant); err != nil {
		return err
	}

	// Mark as active
	participant.Status = "active"
	participantData, _ = json.Marshal(participant)
	if err := redisClient.HSet(ctx, sessionKey, userID, participantData).Err(); err != nil {
		return err
	}

	// Clear grace period
	if err := redisClient.Del(ctx, graceKey).Err(); err != nil {
		log.Printf("Warning: Failed to clear grace period: %v", err)
	}

	// Update user status
	if err := SetUserAwareness(ctx, userID, displayName, StatusInGame, appID, ""); err != nil {
		log.Printf("Warning: Failed to update user awareness: %v", err)
	}

	// Broadcast reconnection event
	eventData := AwarenessEvent{
		Type:      EventParticipantReconnected,
		Data:      participant,
		Timestamp: time.Now().Unix(),
	}
	PublishAwarenessEvent(fmt.Sprintf("session:%s:%s", appID, sessionID), eventData)

	return nil
}

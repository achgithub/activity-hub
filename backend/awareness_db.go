package main

import (
	"log"
	"time"
)

// LogAwarenessEvent logs awareness events to PostgreSQL for analytics and debugging
// Events: heartbeat, status_change, session_join, session_leave, reconnect, timeout
func LogAwarenessEvent(userID, eventType, appID, sessionID string) {
	_, err := db.Exec(`
		INSERT INTO awareness_events (user_id, event_type, app_id, session_id, created_at)
		VALUES ($1, $2, $3, $4, NOW())
	`, userID, eventType, appID, sessionID)

	if err != nil {
		log.Printf("Warning: Failed to log awareness event: %v", err)
	}
}

// CleanupOldAwarenessEvents removes events older than 30 days
func CleanupOldAwarenessEvents() error {
	result, err := db.Exec(`
		DELETE FROM awareness_events
		WHERE created_at < NOW() - INTERVAL '30 days'
	`)

	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows > 0 {
		log.Printf("Cleaned up %d old awareness events", rows)
	}

	return nil
}

// GetUserAwarenessHistory retrieves a user's recent awareness events
func GetUserAwarenessHistory(userID string, limit int) error {
	rows, err := db.Query(`
		SELECT user_id, event_type, app_id, session_id, created_at
		FROM awareness_events
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)

	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var eventType, appID, sessionID string
		var timestamp time.Time

		if err := rows.Scan(&userID, &eventType, &appID, &sessionID, &timestamp); err != nil {
			continue
		}

		log.Printf("Event: %s @ %s - %s (app=%s, session=%s)", userID, timestamp.Format("15:04:05"), eventType, appID, sessionID)
	}

	return nil
}

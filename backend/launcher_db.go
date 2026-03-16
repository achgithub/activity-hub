package main

import (
	"log"
)

// LogAppEvent logs app lifecycle events to PostgreSQL
// Events: launched, stopped, crashed, health_check_failed
func LogAppEvent(appID, eventType string, pid int, gameID string) {
	_, err := db.Exec(`
		INSERT INTO app_lifecycle_events (app_id, event_type, pid, game_id, created_at)
		VALUES ($1, $2, $3, $4, NOW())
	`, appID, eventType, pid, gameID)

	if err != nil {
		log.Printf("Warning: Failed to log app event: %v", err)
	}
}

// CleanupOldAppEvents removes events older than 30 days
func CleanupOldAppEvents() error {
	result, err := db.Exec(`
		DELETE FROM app_lifecycle_events
		WHERE created_at < NOW() - INTERVAL '30 days'
	`)

	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows > 0 {
		log.Printf("Cleaned up %d old app lifecycle events", rows)
	}

	return nil
}

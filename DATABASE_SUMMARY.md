# Activity Hub - Database & Deployment Summary

## What Was Created

Complete database initialization and deployment infrastructure for Activity Hub on Raspberry Pi.

### Files Created

**Database:**
- `database/init.sql` - Complete PostgreSQL schema (7 tables, 20+ indexes, bootstrap data)
- `database/REDIS_SETUP.md` - Redis configuration guide (key patterns, TTLs, monitoring)
- `database/DEPLOYMENT_GUIDE.md` - Complete deployment guide (manual and automated steps)

**Deployment Script:**
- `scripts/deploy-pi.sh` - Automated deployment script (installs dependencies, creates DB, builds services)

---

## Database Schema (7 Tables)

### Table 1: `users`
**Purpose:** Authentication, user profiles, role-based access control

**Columns:**
- `email` (VARCHAR 255) - Primary key
- `name` (VARCHAR 255) - Display name
- `code_hash` (VARCHAR 255) - Bcrypt password hash (nullable for demo tokens)
- `is_admin` (BOOLEAN) - Legacy admin flag (use roles instead)
- `roles` (TEXT[]) - Array of roles: 'super_user', 'setup_admin', etc.
- `created_at`, `updated_at` (TIMESTAMP)

**Indexes:** email (PK), roles (GIN for array queries)

**Bootstrap Data:**
- admin@test.com (roles: super_user, setup_admin)
- alice@test.com (regular user)
- bob@test.com (regular user)

---

### Table 2: `applications`
**Purpose:** App registry - all mini-app definitions

**Columns:**
- `id` (VARCHAR 255) - Primary key (tic-tac-toe, leaderboard, etc.)
- `name`, `icon`, `description` (VARCHAR/TEXT)
- `type` (VARCHAR 50) - 'game' or 'utility'
- `category` (VARCHAR 100) - Category for organization
- `realtime` (VARCHAR 50) - 'none', 'sse', or 'websocket'
- `min_players`, `max_players` (INT) - For multiplayer games
- `required_roles` (TEXT[]) - Access control
- `guest_accessible` (BOOLEAN) - Can guests access?
- `enabled`, `display_order` (BOOLEAN, INT)
- `created_at`, `updated_at` (TIMESTAMP)

**Indexes:** type, category, enabled, display_order

**Bootstrap Data:**
- 9 games: tic-tac-toe, dots, last-man-standing, sweepstakes, quiz-player, spoof, sudoku, bulls-and-cows, rrroll-the-dice
- 5 utilities: leaderboard, game-admin, season-scheduler, quiz-master, quiz-display

---

### Table 3: `user_app_preferences`
**Purpose:** User customization per app (hidden, favorites, custom ordering)

**Columns:**
- `id` (SERIAL) - Primary key
- `user_email` (VARCHAR 255) - FK to users
- `app_id` (VARCHAR 255) - FK to applications
- `is_hidden` (BOOLEAN) - User hid this app
- `is_favorite` (BOOLEAN) - User marked favorite
- `custom_order` (INT) - User's sort order
- `updated_at` (TIMESTAMP)

**Indexes:** user_email, (user_email, is_hidden), (user_email, is_favorite)

**Constraints:** FK to users and applications (cascade delete), unique(user_email, app_id)

---

### Table 4: `challenges`
**Purpose:** Game challenges - 2-player (legacy) and multi-player (new)

**Columns:**
- `id` (VARCHAR 255) - Primary key (UUID)
- `from_user`, `to_user` (VARCHAR 255) - 2-player: who/to whom
- `initiator_id` (VARCHAR 255) - Multi-player: initiator
- `player_ids` (JSONB) - Multi-player: array of emails
- `app_id` (VARCHAR 255) - Which game (FK to applications)
- `status` (VARCHAR 50) - pending, active, completed, rejected, expired
- `min_players`, `max_players` (INT) - For multi-player
- `options` (JSONB) - Game-specific options
- `expires_at` (TIMESTAMP) - When challenge expires
- `created_at`, `responded_at`, `completed_at` (TIMESTAMP)

**Indexes:** from_user, to_user, initiator_id, app_id, status, expires_at, player_ids (GIN)

**Constraints:** FK to users (from_user, to_user, initiator_id) and applications (set null, cascade delete)

---

### Table 5: `impersonation_sessions`
**Purpose:** Admin impersonation tracking and audit trail

**Columns:**
- `id` (SERIAL) - Primary key
- `super_user_email` (VARCHAR 255) - Admin doing impersonation (FK to users)
- `impersonated_email` (VARCHAR 255) - User being impersonated (FK to users)
- `original_token` (VARCHAR 500) - Admin's original token
- `impersonation_token` (VARCHAR 500) - Generated impersonation token
- `is_active` (BOOLEAN) - Session still active?
- `created_at`, `ended_at` (TIMESTAMP)

**Indexes:** super_user_email, impersonated_email, is_active, created_at DESC

**Constraints:** FK to users (cascade delete for both users)

---

### Table 6: `app_lifecycle_events`
**Purpose:** App launcher event logging (for debugging and analytics)

**Columns:**
- `id` (SERIAL) - Primary key
- `app_id` (VARCHAR 255) - App that triggered event
- `event_type` (VARCHAR 50) - launched, stopped, crashed, health_check_failed, restarted
- `pid` (INT) - Process ID of app instance
- `game_id` (VARCHAR 255) - Game ID if launched for specific game
- `error_message` (TEXT) - Error details if crash/failure
- `created_at` (TIMESTAMP)

**Indexes:** (app_id, created_at DESC), (event_type, created_at DESC), pid

**Auto-Cleanup:** Events older than 30 days can be deleted manually

---

### Table 7: `awareness_events`
**Purpose:** User presence and session tracking (heartbeats, status changes, joins/leaves, grace period)

**Columns:**
- `id` (SERIAL) - Primary key
- `user_id` (VARCHAR 255) - User who triggered event
- `event_type` (VARCHAR 50) - heartbeat, status_change, session_join, session_leave, reconnect, grace_period_expired
- `status` (VARCHAR 50) - For status_change events
- `app_id` (VARCHAR 100) - For session events
- `session_id` (VARCHAR 255) - For session events (game ID, etc.)
- `metadata` (JSONB) - Flexible event metadata
- `created_at` (TIMESTAMP)

**Indexes:** (user_id, created_at DESC), (event_type, created_at DESC), (app_id, session_id, created_at DESC)

**Auto-Cleanup:** Events older than 30 days can be deleted manually

---

## Redis Configuration (No Schema - Key-Value Store)

### Key Patterns

| Pattern | Type | TTL | Purpose |
|---------|------|-----|---------|
| `user:presence:{email}` | Hash | 30s | Current user status |
| `user:challenges:received:{email}` | List | 5min | Incoming challenges |
| `user:challenges:sent:{email}` | List | 5min | Outgoing challenges |
| `challenge:{id}` | Hash | 60-120s | Challenge details |
| `session:{appId}:{sessionId}` | Hash | 1hr | Multiplayer session participants |

### Pub/Sub Channels

| Channel | Messages | Purpose |
|---------|----------|---------|
| `presence:updates` | user_online, user_offline, presence_update | Broadcast presence changes |
| `user:{email}` | challenge_received, challenge_accepted, status_change | Per-user notifications |

### Environment Variables

```bash
REDIS_HOST=127.0.0.1     # Default localhost
REDIS_PORT=6379          # Default Redis port
REDIS_PASSWORD=          # Empty if no auth (default)
```

---

## Deployment Options

### Option 1: Automated (Recommended)

```bash
cd ~/activity-hub
./scripts/deploy-pi.sh
```

This runs all phases automatically:
1. Install dependencies (Go, Node, PostgreSQL, Redis)
2. Create and initialize PostgreSQL database
3. Configure Redis
4. Set up environment variables
5. Build backend and frontend
6. Build all mini-apps
7. Verify everything works

**Time:** ~30-45 minutes

### Option 2: Manual

Follow steps in `database/DEPLOYMENT_GUIDE.md`:
1. Install system dependencies
2. Create PostgreSQL database
3. Run init.sql
4. Configure PostgreSQL and Redis
5. Build services
6. Start services

**Time:** ~45-60 minutes (more control)

---

## Bootstrap Data

### Users (Demo Tokens)

All users log in with token format: `demo-token-{email}`

```
admin@test.com       | Admin User | Roles: super_user, setup_admin
alice@test.com       | Alice      | Regular user
bob@test.com         | Bob        | Regular user
```

### Apps (14 Pre-Registered)

**Games (9):**
- tic-tac-toe (2-player, SSE)
- dots (2-4 players, SSE)
- last-man-standing (3-6 players, SSE)
- sweepstakes (2-8 players, SSE)
- quiz-player (1-100 players, SSE)
- spoof (3-6 players, SSE)
- rrroll-the-dice (2-6 players)
- sudoku (1 player)
- bulls-and-cows (2 players, SSE)

**Utilities (5):**
- leaderboard (enabled)
- game-admin (disabled)
- season-scheduler (disabled)
- quiz-master (enabled, SSE)
- quiz-display (enabled, SSE)

---

## Service Ports and Connections

| Service | Host | Port | User | Pass | Purpose |
|---------|------|------|------|------|---------|
| PostgreSQL | localhost | 5555 | activityhub | pubgames | Main database |
| Redis | localhost | 6379 | - | - | Real-time features |
| Backend | localhost | 3001 | - | - | API and frontend |

**Access Database:**
```bash
psql -h localhost -p 5555 -U activityhub -d activity_hub
```

**Access Redis:**
```bash
redis-cli
```

---

## Quick Start on Pi

```bash
# 1. SSH into Pi
ssh pi@your-pi-ip

# 2. Navigate to activity-hub
cd ~/activity-hub

# 3. Run deployment script
./scripts/deploy-pi.sh

# Follow prompts and wait for completion (30-45 min)

# 4. After script completes, start backend:
source ~/.activity-hub-env
cd backend
./activity-hub-backend

# 5. Access application:
# Browser: http://localhost:3001
# Login: Use any bootstrap user + demo token
```

---

## Troubleshooting Quick Reference

| Issue | Check | Fix |
|-------|-------|-----|
| PostgreSQL won't connect | `sudo systemctl status postgresql` | Check port 5555, restart service |
| Redis won't connect | `redis-cli ping` | Should return PONG, restart service |
| Backend won't start | Check env vars: `echo $DB_HOST $REDIS_HOST` | Load: `source ~/.activity-hub-env` |
| App won't launch | `ls /tmp/activity-hub-*.sock` | Check app binary exists, review logs |
| Port already in use | `sudo lsof -i :3001` | Change port or kill process |
| Out of memory | `free -h` | Reduce Redis maxmemory or use larger Pi |

See `database/DEPLOYMENT_GUIDE.md` for detailed troubleshooting.

---

## Documentation Files

| File | Purpose |
|------|---------|
| database/init.sql | PostgreSQL schema (7 tables, 20+ indexes) |
| database/REDIS_SETUP.md | Redis configuration and key patterns |
| database/DEPLOYMENT_GUIDE.md | Complete deployment instructions |
| scripts/deploy-pi.sh | Automated deployment script |
| docs/APP_LAUNCHER.md | App lifecycle management |
| docs/AWARENESS_SERVICE.md | Presence and session tracking |
| docs/MINI_APP_INTEGRATION.md | How to add mini-apps |
| IMPLEMENTATION_SUMMARY.md | Project overview |

---

## Next Steps

After deployment:

1. **Login to Application**
   - URL: http://localhost:3001
   - User: alice@test.com
   - Token: demo-token-alice@test.com

2. **Test App Launcher**
   - Click "Leaderboard" tile (static app)
   - Should launch and display in iframe

3. **Test Multiplayer**
   - Open two browser windows as alice and bob
   - Send challenge for tic-tac-toe
   - Both should see session participants

4. **Integrate Mini-App**
   - Follow docs/MINI_APP_INTEGRATION.md
   - Test app launch and proxy functionality
   - Verify multiplayer session tracking

5. **Monitor for 24 Hours**
   - Check database size growth
   - Monitor Redis memory
   - Review logs for errors

---

## Commit Information

**Commit:** 229dff0
**Message:** Add complete PostgreSQL schema and Pi deployment infrastructure

Includes:
- Complete database schema (init.sql)
- Redis configuration guide (REDIS_SETUP.md)
- Deployment guide (DEPLOYMENT_GUIDE.md)
- Automated deployment script (deploy-pi.sh)

**Status:** Ready for Pi deployment

**Last Updated:** 2026-03-16

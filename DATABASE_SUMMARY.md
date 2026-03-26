# Activity Hub - Database & Deployment Summary

## What Was Created

Complete database initialization and deployment infrastructure for Activity Hub on Raspberry Pi.

### Files Created

**Database:**
- `database/init.sql` - Complete PostgreSQL schema (9 tables, 20+ indexes, bootstrap data)
- `database/REDIS_SETUP.md` - Redis configuration guide (key patterns, TTLs, monitoring)

---

## Database Schema (9 Tables)

**Note:** Some tables below (email_verifications, password_resets) are defined in schema but their authentication flows were never fully implemented.

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

### Table 3: `email_verifications`
**Purpose:** Email verification tokens for sign-up and password reset flows

**Columns:**
- `id` (SERIAL) - Primary key
- `token` (VARCHAR 255) - Random token sent in verification email
- `email` (VARCHAR 255) - Email address to verify
- `purpose` (VARCHAR 50) - 'signup' or 'email_change'
- `expires_at` (TIMESTAMP) - When token expires (24 hours for signup)
- `used_at` (TIMESTAMP) - When token was used (NULL if unused)
- `created_at` (TIMESTAMP)

**Indexes:** token (unique), email, expires_at

**Single-use:** Once verified, token is marked used and can't be reused

---

### Table 4: `password_resets`
**Purpose:** Password reset tokens for forgotten passwords

**Columns:**
- `id` (SERIAL) - Primary key
- `token` (VARCHAR 255) - Random token sent in reset email
- `email` (VARCHAR 255) - User's email (FK to users)
- `expires_at` (TIMESTAMP) - When token expires (1 hour)
- `used_at` (TIMESTAMP) - When token was used (NULL if unused)
- `created_at` (TIMESTAMP)

**Indexes:** token (unique), email, expires_at

**Single-use:** Once password reset, token is marked used

---

### Table 5: `user_app_preferences`
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

### Table 6: `challenges`
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

### Table 7: `impersonation_sessions`
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

### Table 8: `app_lifecycle_events`
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

### Table 9: `awareness_events`
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

## Deployment on Pi

Use the **rpibuildscripts** project to set up dependencies:

```bash
# Clone rpibuildscripts
cd ~
git clone git@github.com:achgithub/rpibuildscripts.git
cd rpibuildscripts

# Run setup scripts (idempotent - safe to rerun)
./go_setup_fixed.sh
./postgresql_setup.sh
./redis_setup.sh

# Load environment
source ~/.postgresql_env.sh
source ~/.redis_env.sh
```

Then initialize activity-hub database:

```bash
cd ~/activity-hub
psql -U $PGUSER -d postgres -c "CREATE DATABASE activity_hub OWNER $PGUSER;"
psql -U $PGUSER -d activity_hub < database/init.sql
```

**Time:** ~30-45 minutes total

See [rpibuildscripts README](https://github.com/achgithub/rpibuildscripts#readme) for detailed instructions.

---

## Authentication

### Bootstrap Admin User

One admin user pre-created:

| Email | Password | Roles | Status |
|-------|----------|-------|--------|
| **admin@activity-hub.com** | 123456 | super_user, setup_admin | Email verified |

Login immediately:
```bash
POST /api/auth/login
{
  "email": "admin@activity-hub.com",
  "code": "123456"
}
```

**Note:** Self-registration (email verification) and password reset flows were never fully implemented. Only the bootstrap admin user can currently log in.

### Registered Mini-Apps (4)

**Games (2):**
- `tic-tac-toe` - 2-player real-time game with awareness
- `bulls-and-cows` - 2-player code-guessing game

**Utilities (2):**
- `dice` - Utility for rolling 1-6 dice (stateless, no database, guest-accessible)
- `lms-manager` - Learning management system with game setup and reporting

### Role-Based Access Control (RBAC)

Roles are stored in `users.roles` as a TEXT[] array. Format: `appid:rolename`

**Dice** (Guest Accessible)
- No authentication required
- Works for both authenticated and guest users

**Tic-Tac-Toe**
- `tictactoe:player` - Can play games (default role for all users)

**Bulls & Cows**
- `bullsandcows:player` - Can play games (default role for all users)

**LMS Manager** (Tab-Based Hierarchy)
- `lms-manager:setup` - Full access (Setup, Games, Reports tabs)
- `lms-manager:games` - Game management (Games, Reports tabs)
- `lms-manager:reports` - View-only (Reports tab only, default role for all users)

**Tab Hierarchy:** Having a role grants access to that tab + all tabs to its right
- `setup` (most privileges) → `games` → `reports` (least privileges)

---

## Service Ports and Connections

| Service | Host | Port | Purpose |
|---------|------|------|---------|
| PostgreSQL | localhost | 5432 | Main database (via rpibuildscripts) |
| Redis | localhost | 6379 | Real-time features (via rpibuildscripts) |
| Backend | localhost | 3001 | API and frontend |

**Access Database:**
```bash
psql -d activity_hub
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

# 2. Setup dependencies (rpibuildscripts)
cd ~ && git clone git@github.com:achgithub/rpibuildscripts.git
cd rpibuildscripts
./go_setup_fixed.sh && ./postgresql_setup.sh && ./redis_setup.sh

# 3. Initialize activity-hub database
cd ~/activity-hub
psql -c "CREATE DATABASE activity_hub OWNER activityhub;"
psql -d activity_hub < database/init.sql

# 4. Build and start backend
cd backend && go build -o activity-hub-backend .
./activity-hub-backend

# 5. Access application:
# Browser: http://localhost:3001
# Login with bootstrap admin:
#   Email: admin@activity-hub.com
#   Password: 123456
```

---

## Troubleshooting Quick Reference

| Issue | Check | Fix |
|-------|-------|-----|
| PostgreSQL won't connect | `psql -c "SELECT 1;"` | Verify service running, check env vars |
| Redis won't connect | `redis-cli ping` | Should return PONG, check service status |
| Backend won't start | Check `PGHOST`, `PGPORT`, `REDIS_HOST` | Load env: `source ~/.postgresql_env.sh ~/.redis_env.sh` |
| Database schema missing | `psql -d activity_hub -c "\dt"` | Should show 9 tables, run: `psql -d activity_hub < database/init.sql` |

See `database/REDIS_SETUP.md` for Redis configuration details.

---

## Database Audit Reference

To verify database state on Pi:

```sql
-- Check all databases and ownership
SELECT datname, pg_catalog.pg_get_userbyid(datdba) as owner,
       pg_size_pretty(pg_database_size(datname)) as size
FROM pg_database
WHERE datname NOT IN ('postgres', 'template0', 'template1')
ORDER BY datname;

-- Verify applications registered
SELECT id, name, type FROM applications ORDER BY id;

-- Verify roles defined
SELECT email, roles FROM users;
```

**Current State (Pi after cleanup):**
- activity_hub (11 MB) - Main database, owner: activityhub
- bullsandcows (7902 kB) - Tic Tac Toe and Bulls & Cows game data, owner: activityhub
- lms_manager (8182 kB) - LMS game setup and reporting, owner: activityhub
- tictactoe (7862 kB) - Tic Tac Toe games, owner: activityhub

All databases owned by `activityhub` user (PostgreSQL 17.9).

## Documentation Files

| File | Purpose |
|------|---------|
| database/init.sql | PostgreSQL schema (9 tables, 20+ indexes) |
| database/REDIS_SETUP.md | Redis configuration and key patterns |
| docs/AWARENESS_SERVICE.md | Presence and session tracking |
| docs/MINI_APP_INTEGRATION.md | How to add mini-apps |
| docs/AUTHENTICATION.md | Auth patterns and SDK usage |

**External:**
| File | Purpose |
|------|---------|
| [rpibuildscripts](https://github.com/achgithub/rpibuildscripts) | Idempotent Pi setup scripts (Go, PostgreSQL, Redis) |

---

## Next Steps

1. Database schema initialized
2. Start backend and test with bootstrap users
3. Follow docs/MINI_APP_INTEGRATION.md to add mini-apps

---

## Status

**What's Included:**
- ✅ Complete PostgreSQL schema (init.sql) - 9 tables with indexes and constraints
- ✅ Bootstrap admin user (admin@activity-hub.com / 123456)
- ✅ 4 registered mini-apps (Dice, Tic Tac Toe, Bulls & Cows, LMS Manager)
- ✅ Role-based access control via RBAC system
- ✅ Redis key patterns reference (REDIS_SETUP.md)
- ✅ Clean database ownership (all databases owned by `activityhub` user)

**Not Implemented:**
- ❌ Self-registration with email verification
- ❌ Password reset via email
- (email_verifications and password_resets tables defined but flows never completed)

**Deployment Uses:**
- 🔗 [rpibuildscripts](https://github.com/achgithub/rpibuildscripts) for dependencies

**Last Updated:** 2026-03-26

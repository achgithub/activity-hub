# Activity Hub - Complete Deployment Guide

## Overview

This guide covers the complete setup of Activity Hub on a fresh Raspberry Pi installation. It includes database setup, Redis configuration, and service startup.

**Estimated time:** 30-45 minutes (depending on Pi speed and internet connection)

---

## Prerequisites

### Hardware
- Raspberry Pi 4 or newer (2GB RAM minimum, 4GB+ recommended)
- 16GB SD card minimum
- Stable internet connection

### Software
- Fresh Raspberry Pi OS installation (Bullseye or Bookworm)
- SSH access to Pi
- Git repository cloned: `~/activity-hub`

---

## Quick Start (Automated)

The fastest way to deploy is using the automated script:

```bash
# SSH into your Pi
ssh pi@your-pi-ip

# Navigate to activity-hub
cd ~/activity-hub

# Run the deployment script (requires sudo)
./scripts/deploy-pi.sh

# Follow prompts and wait for completion
```

This script will:
1. Install all system dependencies (Go, Node, PostgreSQL, Redis)
2. Create and initialize PostgreSQL database
3. Configure Redis for real-time features
4. Set up environment variables
5. Build backend and frontend
6. Build all mini-apps
7. Verify installation

**That's it!** Your Activity Hub is ready to run.

---

## Manual Setup (If Automated Fails)

If you prefer manual setup or the script encounters issues, follow these steps:

### PHASE 1: System Dependencies

```bash
# Update package manager
sudo apt-get update
sudo apt-get upgrade -y

# Install Go 1.25
sudo apt-get install -y golang-1.25

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Install Redis
sudo apt-get install -y redis-server

# Install Git
sudo apt-get install -y git

# Install pnpm (monorepo package manager)
sudo npm install -g pnpm
```

### PHASE 2: PostgreSQL Setup

```bash
# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database user
sudo -u postgres createuser --createdb activityhub

# Create database
sudo -u postgres createdb --owner=activityhub activity_hub

# Initialize schema
sudo -u postgres psql -U activityhub -d activity_hub < ~/activity-hub/database/init.sql

# Verify (should show 7+ tables)
sudo -u postgres psql -U activityhub -d activity_hub -c "\dt"
```

### PHASE 3: PostgreSQL Custom Port (Optional)

If you want PostgreSQL on port 5555 instead of default 5432:

```bash
# Find postgres config
POSTGRES_CONF=$(sudo -u postgres psql -t -c "SHOW config_file;")

# Backup original
sudo cp "$POSTGRES_CONF" "${POSTGRES_CONF}.backup"

# Set custom port
sudo sed -i "s/^#port = 5432/port = 5555/" "$POSTGRES_CONF"

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### PHASE 4: Redis Setup

```bash
# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify
redis-cli ping
# Should respond: PONG
```

### PHASE 5: Environment Variables

```bash
# Create environment file
cat > ~/.activity-hub-env << 'EOF'
# Activity Hub Environment Variables

# Server
export PORT=3001
export ACTIVITY_HUB_URL=http://localhost:3001

# PostgreSQL
export DB_HOST=127.0.0.1
export DB_PORT=5555
export DB_USER=activityhub
export DB_PASS=pubgames
export DB_NAME=activity_hub

# Redis
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_PASSWORD=

# Node
export NODE_ENV=production

# Go
export GOPATH=${HOME}/go
export PATH=${PATH}:${GOPATH}/bin:/usr/lib/go-1.25/bin
EOF

# Load environment variables
source ~/.activity-hub-env
```

### PHASE 6: Build Backend

```bash
cd ~/activity-hub/backend
source ~/.activity-hub-env
go build -o activity-hub-backend .
```

### PHASE 7: Build Frontend

```bash
cd ~/activity-hub
pnpm install
pnpm run build
```

### PHASE 8: Build Mini-Apps

```bash
cd ~/activity-hub
bash ./scripts/build_apps.sh
```

### PHASE 9: Verify Installation

```bash
# Check PostgreSQL
sudo -u postgres psql -U activityhub -d activity_hub -c "SELECT COUNT(*) FROM users;"
# Should return: 3 (three bootstrap users)

# Check Redis
redis-cli ping
# Should return: PONG

# Check backend binary
ls -la ~/activity-hub/backend/activity-hub-backend

# Check frontend build
ls -la ~/activity-hub/frontend/build/
```

---

## Starting Activity Hub

### Terminal 1: Start Backend

```bash
cd ~/activity-hub/backend
source ~/.activity-hub-env

# Run backend
./activity-hub-backend

# Should see:
# ✅ Connected to PostgreSQL database
# ✅ Connected to Redis
# Identity Shell Backend starting on :3001
```

### Terminal 2: Frontend (Optional - if not serving from backend)

```bash
cd ~/activity-hub
source ~/.activity-hub-env
pnpm run dev

# Should see:
# Local: http://localhost:5173
```

### Access the Application

```
http://localhost:3001
```

---

## Bootstrap Data

The database is initialized with sample users and apps:

### Users (Demo Tokens)
- **admin@test.com** - Admin user with roles: super_user, setup_admin
  - Token: `demo-token-admin@test.com`
- **alice@test.com** - Regular user
  - Token: `demo-token-alice@test.com`
- **bob@test.com** - Regular user
  - Token: `demo-token-bob@test.com`

### Apps
14 apps are pre-registered:

**Games (Category: game)**
- tic-tac-toe (2 players)
- dots (2-4 players)
- last-man-standing (3-6 players)
- sweepstakes (2-8 players)
- quiz-player (1-100 players)
- spoof (3-6 players)
- rrroll-the-dice (2-6 players)
- sudoku (1 player)
- bulls-and-cows (2 players)

**Utilities (Category: utility)**
- leaderboard
- game-admin (disabled by default)
- season-scheduler (disabled by default)
- quiz-master
- quiz-display

---

## Database Schema

7 tables are created:

1. **users** - User authentication and profiles
2. **applications** - App registry
3. **user_app_preferences** - User customization (hidden apps, favorites)
4. **challenges** - Game challenges (2-player and multi-player)
5. **impersonation_sessions** - Admin impersonation audit trail
6. **app_lifecycle_events** - App launcher event logging (NEW)
7. **awareness_events** - User presence and session events (NEW)

See `database/init.sql` for complete schema with constraints and indexes.

---

## Redis Configuration

Redis uses an in-memory key-value store (no schema). Key patterns:

- `user:presence:{email}` (30s TTL) - User status
- `user:challenges:received:{email}` (5min TTL) - Incoming challenges
- `user:challenges:sent:{email}` (5min TTL) - Outgoing challenges
- `challenge:{id}` (60-120s TTL) - Challenge details
- `session:{appId}:{sessionId}` (1hr TTL) - Multiplayer session participants

See `database/REDIS_SETUP.md` for complete Redis documentation.

---

## Common Operations

### Check PostgreSQL Status

```bash
# Is PostgreSQL running?
sudo systemctl status postgresql

# Connect to database
psql -U activityhub -d activity_hub

# View all tables
\dt

# View specific table
SELECT * FROM users;

# Exit
\q
```

### Check Redis Status

```bash
# Is Redis running?
sudo systemctl status redis-server

# Connect to Redis CLI
redis-cli

# Check memory usage
INFO memory

# List all keys
KEYS *

# Exit
EXIT
```

### View Backend Logs

```bash
# If running in terminal, logs print to stdout
# If running as service, check systemd logs:
sudo journalctl -u activity-hub -f
```

### Restart Services

```bash
# PostgreSQL
sudo systemctl restart postgresql

# Redis
sudo systemctl restart redis-server

# Backend (if running as systemd service)
sudo systemctl restart activity-hub
```

### Reset Database

```bash
# WARNING: This deletes all data!

# Stop backend first
# Then in PostgreSQL:
sudo -u postgres dropdb activity_hub
sudo -u postgres createdb --owner=activityhub activity_hub
sudo -u postgres psql -U activityhub -d activity_hub < ~/activity-hub/database/init.sql
```

### Clear Redis

```bash
# WARNING: This clears all real-time data!
redis-cli FLUSHDB
```

---

## Troubleshooting

### PostgreSQL Connection Refused

**Error:** `psql: error: could not connect to server`

**Solutions:**
1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Check port is correct in env vars: `echo $DB_PORT`
3. Verify database exists: `sudo -u postgres psql -l | grep activity_hub`
4. Check password: Ensure `DB_PASS` matches user setup

### Backend Won't Start

**Error:** `Backend: Failed to connect to database`

**Solutions:**
1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Check environment variables are loaded: `echo $DB_HOST $DB_PORT $DB_USER`
3. Test database connection manually: `psql -h localhost -p 5555 -U activityhub -d activity_hub`
4. Check backend logs for specific error message

### Redis Connection Failed

**Error:** `Backend: Failed to connect to Redis`

**Solutions:**
1. Check Redis is running: `sudo systemctl status redis-server`
2. Check Redis is listening: `redis-cli ping` (should return PONG)
3. Check environment variables: `echo $REDIS_HOST $REDIS_PORT`
4. Verify no firewall blocks localhost:6379

### Port Already in Use

**Error:** `address already in use`

**Solutions:**
```bash
# Find what's using port 3001
sudo lsof -i :3001

# Kill process (if needed)
sudo kill -9 <PID>

# Or use a different port
export PORT=3002
./activity-hub-backend
```

### Out of Memory (OOM Killer)

**Error:** `Segmentation fault` or process killed

**Solutions:**
1. Check available RAM: `free -h`
2. Stop unnecessary services
3. Reduce Redis maxmemory in `/etc/redis/redis.conf`
4. Use Pi with more RAM (4GB minimum, 8GB recommended)

### Mini-App Won't Launch

**Error:** App doesn't start when tile clicked

**Solutions:**
1. Check app binary exists: `ls -la ~/activity-hub/apps/{appId}/backend/{appId}-app`
2. Check app socket is created: `ls -la /tmp/activity-hub-*.sock`
3. Check app logs: See backend logs for error message
4. Verify app database is initialized

---

## Performance Tuning

### For Limited RAM (2GB Pi)

```bash
# Reduce Redis memory limit
sudo sed -i 's/maxmemory 256mb/maxmemory 128mb/' /etc/redis/redis.conf
sudo systemctl restart redis-server

# Reduce PostgreSQL buffers
sudo -u postgres psql -c "ALTER SYSTEM SET shared_buffers = '64MB';"
sudo systemctl restart postgresql
```

### For Better Performance (4GB+ Pi)

```bash
# Increase Redis memory
sudo sed -i 's/maxmemory 256mb/maxmemory 512mb/' /etc/redis/redis.conf
sudo systemctl restart redis-server

# Increase PostgreSQL buffers
sudo -u postgres psql -c "ALTER SYSTEM SET shared_buffers = '256MB';"
sudo systemctl restart postgresql
```

---

## Monitoring

### Database Growth

```bash
# Check database size
sudo -u postgres psql -d activity_hub -c "SELECT pg_size_pretty(pg_database_size('activity_hub'));"

# Check table sizes
sudo -u postgres psql -d activity_hub -c "
  SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
  FROM pg_tables WHERE schemaname != 'pg_catalog'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

### Redis Memory

```bash
redis-cli INFO memory

# Output shows:
# used_memory_human: Current memory usage
# maxmemory: Max allowed
# evicted_keys: Keys removed due to policy
```

### Cleanup Old Events

```bash
# Manually clean up events older than 30 days
sudo -u postgres psql -d activity_hub << EOF
DELETE FROM app_lifecycle_events WHERE created_at < NOW() - INTERVAL '30 days';
DELETE FROM awareness_events WHERE created_at < NOW() - INTERVAL '30 days';
EOF
```

---

## Systemd Service Setup (Optional)

To run Activity Hub as a systemd service:

```bash
# Create service file
sudo tee /etc/systemd/system/activity-hub.service > /dev/null << 'EOF'
[Unit]
Description=Activity Hub Backend
After=postgresql.service redis-server.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/activity-hub/backend
EnvironmentFile=/home/pi/.activity-hub-env
ExecStart=/home/pi/activity-hub/backend/activity-hub-backend
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable activity-hub
sudo systemctl start activity-hub

# Check status
sudo systemctl status activity-hub

# View logs
sudo journalctl -u activity-hub -f
```

---

## Backup and Recovery

### Backup Database

```bash
# Create backup
sudo -u postgres pg_dump -U activityhub activity_hub > ~/activity_hub_backup.sql

# Compressed backup
sudo -u postgres pg_dump -U activityhub activity_hub | gzip > ~/activity_hub_backup.sql.gz
```

### Restore Database

```bash
# From backup
sudo -u postgres psql -U activityhub activity_hub < ~/activity_hub_backup.sql

# From compressed backup
zcat ~/activity_hub_backup.sql.gz | sudo -u postgres psql -U activityhub activity_hub
```

### Remote Backup (Copy to Mac)

```bash
# On Mac, copy from Pi
scp pi@your-pi-ip:activity_hub_backup.sql ~/backups/

# Or use rsync for incremental backups
rsync -avz pi@your-pi-ip:activity_hub_backup.sql.gz ~/backups/
```

---

## Next Steps After Deployment

1. **Test Locally**
   - Login to frontend as demo users
   - Click app tiles to verify launcher
   - Send a game challenge between users

2. **Integrate First Mini-App**
   - Follow docs/MINI_APP_INTEGRATION.md
   - Test app launch through proxy
   - Verify multi-player session tracking (if applicable)

3. **Monitor for 24 Hours**
   - Check database size growth
   - Monitor Redis memory usage
   - Review logs for errors
   - Verify app auto-cleanup after idle timeout

4. **Gradual Rollout**
   - Add one mini-app at a time
   - Test thoroughly on Pi
   - Document any issues or modifications
   - Update integration guide based on learnings

---

## Documentation Index

- **database/init.sql** - Complete PostgreSQL schema
- **database/REDIS_SETUP.md** - Redis configuration and key patterns
- **database/DEPLOYMENT_GUIDE.md** - This file
- **docs/APP_LAUNCHER.md** - How app launcher works
- **docs/AWARENESS_SERVICE.md** - User presence and session tracking
- **docs/MINI_APP_INTEGRATION.md** - How to integrate mini-apps
- **IMPLEMENTATION_SUMMARY.md** - Project overview and status

---

## Support

If you encounter issues:

1. **Check logs** - Backend stdout, PostgreSQL logs, Redis logs
2. **Review this guide** - Most issues are covered in Troubleshooting
3. **Check documentation** - Specific features documented in docs/
4. **Test connections** - Verify PostgreSQL and Redis are accessible
5. **Review code** - Check backend/main.go for startup sequence

---

## Checklist: Deployment Complete When...

- [ ] `./scripts/deploy-pi.sh` runs without errors
- [ ] PostgreSQL responding: `psql -U activityhub -d activity_hub -c "SELECT 1;"`
- [ ] Redis responding: `redis-cli ping`
- [ ] Backend binary exists: `ls ~/activity-hub/backend/activity-hub-backend`
- [ ] Frontend built: `ls ~/activity-hub/frontend/build/`
- [ ] All mini-apps compiled: `ls ~/activity-hub/apps/*/backend/*-app`
- [ ] Backend starts: `./activity-hub-backend` with no errors
- [ ] Frontend accessible: `http://localhost:3001`
- [ ] Can login as demo users
- [ ] Can click app tiles (triggers app launcher)

---

**Status:** Ready for production deployment

**Last Updated:** 2026-03-16

**Questions?** See documentation files in `database/` and `docs/` directories

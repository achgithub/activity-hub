#!/bin/bash

################################################################################
# Activity Hub - Raspberry Pi Deployment Script
#
# This script sets up a fresh Activity Hub installation on Raspberry Pi:
# 1. Installs system dependencies (PostgreSQL, Redis, Node, Go)
# 2. Configures PostgreSQL and creates database schema
# 3. Configures Redis for real-time features
# 4. Sets up environment variables
# 5. Builds backend and frontend
# 6. Starts all services
#
# Run this script on fresh Pi installation:
#   cd ~/activity-hub && ./scripts/deploy-pi.sh
#
# Requires sudo for system-level operations
################################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ACTIVITY_HUB_HOME="${HOME}/activity-hub"
DB_USER="activityhub"
DB_NAME="activity_hub"
DB_PORT=5555
REDIS_PORT=6379
BACKEND_PORT=3001

################################################################################
# Helper Functions
################################################################################

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        return 1
    fi
    return 0
}

################################################################################
# PHASE 1: System Dependencies
################################################################################

phase_1_dependencies() {
    log_info "PHASE 1: Installing system dependencies..."

    # Update package manager
    log_info "Updating package manager..."
    sudo apt-get update || log_error "Failed to update package manager"

    # Check and install Go
    if ! check_command go; then
        log_info "Installing Go 1.25..."
        sudo apt-get install -y golang-1.25 || log_error "Failed to install Go"
        # Create symlink if needed
        sudo ln -sf /usr/lib/go-1.25/bin/go /usr/local/bin/go 2>/dev/null || true
    else
        log_success "Go already installed: $(go version)"
    fi

    # Check and install Node.js/npm
    if ! check_command node; then
        log_info "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - || log_error "Failed to add NodeSource repo"
        sudo apt-get install -y nodejs || log_error "Failed to install Node.js"
    else
        log_success "Node.js already installed: $(node --version)"
    fi

    # Check and install PostgreSQL
    if ! check_command psql; then
        log_info "Installing PostgreSQL..."
        sudo apt-get install -y postgresql postgresql-contrib || log_error "Failed to install PostgreSQL"
    else
        log_success "PostgreSQL already installed: $(psql --version)"
    fi

    # Check and install Redis
    if ! check_command redis-server; then
        log_info "Installing Redis..."
        sudo apt-get install -y redis-server || log_error "Failed to install Redis"
    else
        log_success "Redis already installed: $(redis-server --version)"
    fi

    # Check and install Git
    if ! check_command git; then
        log_info "Installing Git..."
        sudo apt-get install -y git || log_error "Failed to install Git"
    else
        log_success "Git already installed: $(git --version)"
    fi

    # Install pnpm (package manager for monorepo)
    if ! check_command pnpm; then
        log_info "Installing pnpm..."
        sudo npm install -g pnpm || log_error "Failed to install pnpm"
    else
        log_success "pnpm already installed: $(pnpm --version)"
    fi

    log_success "All system dependencies installed"
}

################################################################################
# PHASE 2: PostgreSQL Setup
################################################################################

phase_2_postgresql() {
    log_info "PHASE 2: Setting up PostgreSQL..."

    # Start PostgreSQL service
    log_info "Starting PostgreSQL service..."
    sudo systemctl start postgresql || log_error "Failed to start PostgreSQL"
    sudo systemctl enable postgresql || log_error "Failed to enable PostgreSQL"

    # Create database user if not exists
    log_info "Creating database user '${DB_USER}'..."
    sudo -u postgres createuser --createdb "${DB_USER}" 2>/dev/null || log_warning "User may already exist"

    # Create database if not exists
    log_info "Creating database '${DB_NAME}'..."
    sudo -u postgres createdb --owner="${DB_USER}" "${DB_NAME}" 2>/dev/null || log_warning "Database may already exist"

    # Run schema initialization
    log_info "Initializing database schema..."
    if [ ! -f "${ACTIVITY_HUB_HOME}/database/init.sql" ]; then
        log_error "Schema file not found: ${ACTIVITY_HUB_HOME}/database/init.sql"
    fi

    # Run schema with the database user
    sudo -u postgres psql -U "${DB_USER}" -d "${DB_NAME}" < "${ACTIVITY_HUB_HOME}/database/init.sql" || \
        log_error "Failed to initialize database schema"

    # Verify database
    log_info "Verifying database..."
    TABLE_COUNT=$(sudo -u postgres psql -U "${DB_USER}" -d "${DB_NAME}" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

    if [ "$TABLE_COUNT" -ge 7 ]; then
        log_success "Database initialized with $TABLE_COUNT tables"
    else
        log_error "Database initialization failed (only $TABLE_COUNT tables found, expected 7+)"
    fi
}

################################################################################
# PHASE 3: PostgreSQL Configuration
################################################################################

phase_3_postgres_config() {
    log_info "PHASE 3: Configuring PostgreSQL..."

    # Find postgresql.conf
    POSTGRES_CONF=$(sudo -u postgres psql -t -c "SHOW config_file;" 2>/dev/null)

    if [ -z "$POSTGRES_CONF" ]; then
        log_warning "Could not find postgres config file, skipping custom port configuration"
        log_info "PostgreSQL will use default port 5432"
        return
    fi

    # Check if custom port is already configured
    if sudo grep -q "^port = ${DB_PORT}" "$POSTGRES_CONF" 2>/dev/null; then
        log_success "PostgreSQL already configured for port ${DB_PORT}"
    else
        log_info "Configuring PostgreSQL to use port ${DB_PORT}..."
        # Backup original
        sudo cp "$POSTGRES_CONF" "${POSTGRES_CONF}.backup"
        # Set custom port
        sudo sed -i "s/^#port = 5432/port = ${DB_PORT}/" "$POSTGRES_CONF" || \
            log_warning "Could not set custom PostgreSQL port, will use default 5432"

        # Restart PostgreSQL to apply changes
        sudo systemctl restart postgresql || log_error "Failed to restart PostgreSQL"
        log_success "PostgreSQL reconfigured"
    fi
}

################################################################################
# PHASE 4: Redis Setup
################################################################################

phase_4_redis() {
    log_info "PHASE 4: Setting up Redis..."

    # Start Redis service
    log_info "Starting Redis service..."
    sudo systemctl start redis-server || log_error "Failed to start Redis"
    sudo systemctl enable redis-server || log_error "Failed to enable Redis"

    # Configure Redis
    REDIS_CONF="/etc/redis/redis.conf"
    if [ -f "$REDIS_CONF" ]; then
        log_info "Configuring Redis..."

        # Set memory limit (256MB for Pi)
        sudo sed -i "s/^# maxmemory <bytes>/maxmemory 256mb/" "$REDIS_CONF" || \
            sudo sed -i "s/^maxmemory [0-9]*mb/maxmemory 256mb/" "$REDIS_CONF"

        # Set eviction policy
        sudo sed -i "s/^# maxmemory-policy/maxmemory-policy/" "$REDIS_CONF" || \
            sudo sed -i "s/^maxmemory-policy .*/maxmemory-policy allkeys-lru/" "$REDIS_CONF"

        # Disable persistence (not needed for session data)
        sudo sed -i "s/^save /#save /" "$REDIS_CONF" || true
        sudo sed -i "s/^appendonly yes/appendonly no/" "$REDIS_CONF" || true

        # Restart to apply changes
        sudo systemctl restart redis-server || log_error "Failed to restart Redis"
    fi

    # Verify Redis connectivity
    log_info "Verifying Redis connectivity..."
    if redis-cli ping > /dev/null 2>&1; then
        log_success "Redis is running and responding"
    else
        log_error "Redis is not responding to ping"
    fi
}

################################################################################
# PHASE 5: Environment Variables
################################################################################

phase_5_env_vars() {
    log_info "PHASE 5: Setting up environment variables..."

    ENV_FILE="${HOME}/.activity-hub-env"

    cat > "$ENV_FILE" << EOF
# Activity Hub Environment Variables
# Source this file: source ${ENV_FILE}

# Server
export PORT=3001
export ACTIVITY_HUB_URL=http://localhost:3001

# PostgreSQL
export DB_HOST=127.0.0.1
export DB_PORT=${DB_PORT}
export DB_USER=${DB_USER}
export DB_PASS=pubgames
export DB_NAME=${DB_NAME}

# Redis
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_PASSWORD=

# Node
export NODE_ENV=production

# Go
export GOPATH=\${HOME}/go
export PATH=\${PATH}:\${GOPATH}/bin:/usr/lib/go-1.25/bin
EOF

    log_success "Environment variables saved to: $ENV_FILE"
    log_info "To load: source $ENV_FILE"
}

################################################################################
# PHASE 6: Build Backend
################################################################################

phase_6_build_backend() {
    log_info "PHASE 6: Building backend..."

    cd "$ACTIVITY_HUB_HOME" || log_error "Cannot cd to $ACTIVITY_HUB_HOME"

    # Load environment variables
    if [ -f "${HOME}/.activity-hub-env" ]; then
        source "${HOME}/.activity-hub-env"
    fi

    log_info "Building activity-hub backend..."
    if [ ! -f "${ACTIVITY_HUB_HOME}/backend/main.go" ]; then
        log_error "Backend main.go not found"
    fi

    cd "${ACTIVITY_HUB_HOME}/backend" || log_error "Cannot cd to backend"
    go build -o activity-hub-backend . || log_error "Failed to build backend"

    log_success "Backend built: ./backend/activity-hub-backend"
}

################################################################################
# PHASE 7: Build Frontend
################################################################################

phase_7_build_frontend() {
    log_info "PHASE 7: Building frontend..."

    cd "$ACTIVITY_HUB_HOME" || log_error "Cannot cd to $ACTIVITY_HUB_HOME"

    log_info "Installing npm dependencies..."
    pnpm install || log_error "Failed to install dependencies"

    log_info "Building frontend..."
    pnpm run build || log_error "Failed to build frontend"

    log_success "Frontend built: ./frontend/build"
}

################################################################################
# PHASE 8: Build Mini-Apps
################################################################################

phase_8_build_mini_apps() {
    log_info "PHASE 8: Building mini-apps..."

    cd "$ACTIVITY_HUB_HOME" || log_error "Cannot cd to $ACTIVITY_HUB_HOME"

    if [ ! -f "./scripts/build_apps.sh" ]; then
        log_warning "Mini-app build script not found, skipping"
        return
    fi

    log_info "Building all mini-apps..."
    bash ./scripts/build_apps.sh || log_error "Failed to build mini-apps"

    log_success "All mini-apps built"
}

################################################################################
# PHASE 9: Verify Installation
################################################################################

phase_9_verify() {
    log_info "PHASE 9: Verifying installation..."

    ERRORS=0

    # Check PostgreSQL
    log_info "Checking PostgreSQL..."
    if sudo -u postgres psql -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1; then
        log_success "PostgreSQL is running and accessible"
    else
        log_error "PostgreSQL is not accessible"
        ERRORS=$((ERRORS + 1))
    fi

    # Check Redis
    log_info "Checking Redis..."
    if redis-cli ping > /dev/null 2>&1; then
        log_success "Redis is running"
    else
        log_error "Redis is not running"
        ERRORS=$((ERRORS + 1))
    fi

    # Check backend binary
    log_info "Checking backend binary..."
    if [ -f "${ACTIVITY_HUB_HOME}/backend/activity-hub-backend" ]; then
        log_success "Backend binary exists"
    else
        log_warning "Backend binary not found (may have been built as dependency)"
    fi

    # Check Node modules
    log_info "Checking npm dependencies..."
    if [ -d "${ACTIVITY_HUB_HOME}/node_modules" ]; then
        log_success "npm dependencies installed"
    else
        log_warning "npm dependencies not found"
    fi

    if [ $ERRORS -eq 0 ]; then
        log_success "All systems verified successfully"
        return 0
    else
        log_error "Verification found $ERRORS issues"
        return 1
    fi
}

################################################################################
# PHASE 10: Startup Instructions
################################################################################

phase_10_startup() {
    log_info "PHASE 10: Startup instructions..."

    cat << 'EOF'

╔════════════════════════════════════════════════════════════════════════════╗
║                  Activity Hub Deployment Complete! 🎉                      ║
╚════════════════════════════════════════════════════════════════════════════╝

Next Steps:

1. Load environment variables:
   source ~/.activity-hub-env

2. Verify all services are running:
   - PostgreSQL: psql -U activityhub -d activity_hub -c "SELECT COUNT(*) FROM users;"
   - Redis: redis-cli ping

3. Start the activity-hub backend:
   cd ~/activity-hub/backend
   source ~/.activity-hub-env
   ./activity-hub-backend

4. (In another terminal) Start the frontend dev server:
   cd ~/activity-hub
   pnpm run dev

5. Access the application:
   http://localhost:3001

Services:
├── PostgreSQL: 127.0.0.1:5555 (user: activityhub, db: activity_hub)
├── Redis: 127.0.0.1:6379 (no auth)
├── Backend: http://localhost:3001
└── Frontend: http://localhost:5173 (dev) or served by backend (prod)

Bootstrap Users:
- admin@test.com (admin, roles: super_user, setup_admin)
- alice@test.com (regular user)
- bob@test.com (regular user)

All users can be logged in with demo tokens: demo-token-{email}

Troubleshooting:

If PostgreSQL connection fails:
  psql -U postgres -c "SELECT * FROM pg_database WHERE datname='activity_hub';"

If Redis is not responding:
  sudo systemctl status redis-server
  redis-cli INFO

If backend won't start:
  Check: DATABASE connection, REDIS connection, PORT 3001 availability
  Logs: backend process output

Documentation:
- Database schema: database/init.sql
- Redis setup: database/REDIS_SETUP.md
- App launcher: docs/APP_LAUNCHER.md
- Awareness service: docs/AWARENESS_SERVICE.md

═══════════════════════════════════════════════════════════════════════════════

EOF

    log_success "Deployment complete!"
}

################################################################################
# Main Execution
################################################################################

main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║        Activity Hub - Raspberry Pi Deployment Script               ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo ""

    log_info "Starting deployment..."
    log_info "Activity Hub Home: $ACTIVITY_HUB_HOME"
    log_info "Database: $DB_NAME (user: $DB_USER, port: $DB_PORT)"
    log_info "Redis: port $REDIS_PORT"
    log_info "Backend: port $BACKEND_PORT"
    echo ""

    phase_1_dependencies
    phase_2_postgresql
    phase_3_postgres_config
    phase_4_redis
    phase_5_env_vars
    phase_6_build_backend
    phase_7_build_frontend
    phase_8_build_mini_apps
    phase_9_verify
    phase_10_startup
}

# Run main
main "$@"

#!/bin/sh
# Re-exec with bash when run via sh (dash) - avoids Bad substitution / [[ errors
if [ -z "${BASH_VERSION}" ] && command -v bash >/dev/null 2>&1; then
  exec bash "$0" "$@"
fi

set -e

# =============================================================================
# Address Work production installer
# Bootstrap script for fresh Linux - installs Docker, configures env, runs app
# Run from project root after: git clone <repo> && cd app
# Works with sh (dash), bash, etc.
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { printf '%b\n' "${GREEN}[INFO]${NC} $1"; }
log_warn()  { printf '%b\n' "${YELLOW}[WARN]${NC} $1"; }
log_error() { printf '%b\n' "${RED}[ERROR]${NC} $1"; }

# Need curl or wget to fetch Docker install script
if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -q -O "$2" "$1"; }
else
  printf '%b\n' "${RED}[ERROR]${NC} Need curl or wget. Install one: apt install curl"
  exit 1
fi

# Detect project root (script is in scripts/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -f docker-compose.yml ]; then
  log_error "docker-compose.yml not found. Run this script from the project root."
  exit 1
fi

log_info "Project root: $PROJECT_ROOT"

# -----------------------------------------------------------------------------
# 1. Ensure Docker is installed
# -----------------------------------------------------------------------------
install_docker() {
  if command -v docker >/dev/null 2>&1; then
    log_info "Docker is already installed: $(docker --version)"
    return 0
  fi

  log_info "Installing Docker..."
  fetch "https://get.docker.com" /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
  rm /tmp/get-docker.sh

  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start docker
    sudo systemctl enable docker
  fi

  if [ -n "$SUDO_USER" ]; then
    sudo usermod -aG docker "$SUDO_USER"
    log_warn "User $SUDO_USER added to docker group. You may need to log out and back in."
  else
    sudo usermod -aG docker "$(whoami)"
    log_warn "You may need to log out and back in for docker group to take effect."
  fi

  log_info "Docker installed successfully."
}

run_docker() {
  if docker info >/dev/null 2>&1; then
    docker "$@"
  elif sudo docker info >/dev/null 2>&1; then
    sudo docker "$@"
  else
    log_error "Cannot run Docker. Install Docker and ensure your user is in the docker group."
    exit 1
  fi
}

run_docker_compose() {
  if run_docker compose version >/dev/null 2>&1; then
    run_docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
    docker-compose "$@"
  else
    log_error "Docker Compose not found. Install: sudo apt install docker-compose-plugin"
    exit 1
  fi
}

install_docker

# Ensure Docker daemon is reachable
i=0
while [ $i -lt 5 ]; do
  if run_docker info >/dev/null 2>&1; then
    break
  fi
  log_info "Waiting for Docker daemon..."
  sleep 2
  i=$((i + 1))
done

if ! run_docker info >/dev/null 2>&1; then
  log_error "Docker daemon is not running. Start it with: sudo systemctl start docker"
  exit 1
fi

# -----------------------------------------------------------------------------
# 2. Prompt for environment variables (Postgres + JWT)
# Do NOT use command substitution $(...) - it redirects stdin and breaks read
# -----------------------------------------------------------------------------
log_info "Configuring production environment (Postgres database and secrets)..."

# Use env vars if already set (non-interactive), otherwise prompt
if [ -n "${APP_DB_PASSWORD}" ] && [ -n "${APP_JWT_SECRET}" ]; then
  log_info "Using APP_DB_* and APP_JWT_SECRET from environment"
  APP_DB_HOST=${APP_DB_HOST:-localhost}
  APP_DB_PORT=${APP_DB_PORT:-5432}
  APP_DB_USERNAME=${APP_DB_USERNAME:-postgres}
  APP_DB_NAME=${APP_DB_NAME:-address_work}
  APP_SENTRY=${APP_SENTRY:-}
else
  printf 'APP_DB_HOST (Postgres host) [localhost]: ' >&2
  read -r APP_DB_HOST
  APP_DB_HOST=${APP_DB_HOST:-localhost}

  printf 'APP_DB_PORT [5432]: ' >&2
  read -r APP_DB_PORT
  APP_DB_PORT=${APP_DB_PORT:-5432}

  printf 'APP_DB_USERNAME [postgres]: ' >&2
  read -r APP_DB_USERNAME
  APP_DB_USERNAME=${APP_DB_USERNAME:-postgres}

  printf 'APP_DB_PASSWORD: ' >&2
  read -r APP_DB_PASSWORD

  printf 'APP_DB_NAME [address_work]: ' >&2
  read -r APP_DB_NAME
  APP_DB_NAME=${APP_DB_NAME:-address_work}

  printf 'APP_JWT_SECRET (min 32 chars): ' >&2
  read -r APP_JWT_SECRET

  printf 'APP_SENTRY (optional) []: ' >&2
  read -r APP_SENTRY
fi

if [ -z "$APP_DB_PASSWORD" ]; then
  log_error "APP_DB_PASSWORD is required."
  exit 1
fi
if [ -z "$APP_JWT_SECRET" ]; then
  log_error "APP_JWT_SECRET is required for production."
  exit 1
fi
_len=$(printf '%s' "$APP_JWT_SECRET" | wc -c | tr -d ' ')
if [ "$_len" -lt 32 ] 2>/dev/null; then
  log_warn "APP_JWT_SECRET should be at least 32 characters for security."
fi

# -----------------------------------------------------------------------------
# 3. Write .env for docker-compose variable substitution
# -----------------------------------------------------------------------------
ENV_FILE="$PROJECT_ROOT/.env"
cat > "$ENV_FILE" << EOF
# Generated by installer.sh - Postgres & app config
APP_DB_HOST=$APP_DB_HOST
APP_DB_PORT=$APP_DB_PORT
APP_DB_USERNAME=$APP_DB_USERNAME
APP_DB_PASSWORD=$APP_DB_PASSWORD
APP_DB_NAME=$APP_DB_NAME
APP_JWT_SECRET=$APP_JWT_SECRET
APP_SENTRY=$APP_SENTRY
EOF

chmod 600 "$ENV_FILE"
log_info "Wrote $ENV_FILE"

# -----------------------------------------------------------------------------
# 4. Build and run in production mode
# -----------------------------------------------------------------------------
log_info "Building and starting services (this may take a few minutes)..."

run_docker_compose build --no-cache
run_docker_compose up -d

# -----------------------------------------------------------------------------
# 5. Verify
# -----------------------------------------------------------------------------
sleep 3
if run_docker ps | grep -q app-nginx-proxy; then
  log_info "Services are running."
  printf '\n'
  printf '%b\n' "${GREEN}============================================${NC}"
  printf '%b\n' "${GREEN}  Address Work is running in production mode${NC}"
  printf '%b\n' "${GREEN}============================================${NC}"
  printf '\n'
  printf '  URL: http://localhost:8000\n'
  printf '  API: http://localhost:8000/api\n'
  printf '\n'
  printf '  Containers: docker compose ps\n'
  printf '  Logs:       docker compose logs -f\n'
  printf '  Stop:       docker compose down\n'
  printf '\n'
else
  log_error "Containers may not have started. Check logs:"
  printf '  docker compose logs -f\n'
  exit 1
fi

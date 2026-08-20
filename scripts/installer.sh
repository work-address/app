#!/bin/sh
# Re-exec with bash when run via sh (dash) - avoids Bad substitution / [[ errors.
# Only safe when $0 is a real file on disk; when this script is piped straight
# into `sh` (rather than `bash`) there's nothing on disk to re-exec, so we ask
# the user to pipe into bash instead (the one-liner below already does this).
if [ -z "${BASH_VERSION}" ] && command -v bash >/dev/null 2>&1; then
  if [ -f "$0" ]; then
    exec bash "$0" "$@"
  else
    printf 'Please run this installer with bash, e.g.:\n  curl -fsSL <url> | bash\n' >&2
    exit 1
  fi
fi

set -e

# =============================================================================
# Address Work production installer
#
# Single-command install on a fresh machine (clones the repo for you):
#   curl -fsSL https://raw.githubusercontent.com/work-address/app/dev/scripts/installer.sh | bash
#
# Or, if you've already cloned the repo:
#   git clone https://github.com/work-address/app.git && cd app
#   ./scripts/installer.sh
#
# Either way: installs Docker (if missing), prompts for required env vars,
# builds, and runs the app in production mode. Works with sh (dash), bash, etc.
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { printf '%b\n' "${GREEN}[INFO]${NC} $1"; }
log_warn()  { printf '%b\n' "${YELLOW}[WARN]${NC} $1"; }
log_error() { printf '%b\n' "${RED}[ERROR]${NC} $1"; }

# Need curl or wget to fetch Docker's install script
if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -q -O "$2" "$1"; }
else
  log_error "Need curl or wget. Install one: apt install curl"
  exit 1
fi

# -----------------------------------------------------------------------------
# 0. Locate (or clone) the repo
#
# Supports two modes:
#  - Already cloned: script is run as ./scripts/installer.sh from inside a
#    checkout, so we can find the project root relative to this file.
#  - Piped one-liner: $0 isn't a real file, or there's no repo around it, so
#    we clone the repo ourselves and continue from there.
# -----------------------------------------------------------------------------
REPO_URL="${APP_REPO_URL:-https://github.com/work-address/app.git}"
REPO_REF="${APP_REPO_REF:-}"
INSTALL_DIR="${APP_INSTALL_DIR:-$PWD/app}"

ensure_git() {
  if command -v git >/dev/null 2>&1; then
    return 0
  fi

  log_info "Installing git..."
  if command -v apt-get >/dev/null 2>&1; then
    # Try a bare install first - many images already have a usable package
    # index, and this avoids a redundant `apt-get update` pass on top of the
    # one Docker's own install script runs later.
    sudo apt-get install -y git || (sudo apt-get update -y && sudo apt-get install -y git)
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y git
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y git
  elif command -v apk >/dev/null 2>&1; then
    sudo apk add --no-cache git
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --noconfirm git
  elif command -v zypper >/dev/null 2>&1; then
    sudo zypper install -y git
  elif command -v brew >/dev/null 2>&1; then
    brew install git
  else
    log_error "git is required but couldn't be auto-installed on this system. Install git and re-run."
    exit 1
  fi
}

PROJECT_ROOT=""
if [ -f "$0" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  CANDIDATE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  if [ -f "$CANDIDATE_ROOT/docker-compose.yml" ]; then
    PROJECT_ROOT="$CANDIDATE_ROOT"
  else
    log_warn "Running from $SCRIPT_DIR but docker-compose.yml wasn't found at $CANDIDATE_ROOT."
    log_warn "This doesn't look like a full checkout; falling back to cloning a fresh copy into $INSTALL_DIR..."
  fi
fi

if [ -z "$PROJECT_ROOT" ]; then
  ensure_git

  if [ -d "$INSTALL_DIR/.git" ]; then
    EXISTING_URL="$(git -C "$INSTALL_DIR" remote get-url origin 2>/dev/null || true)"
    if [ "$EXISTING_URL" != "$REPO_URL" ]; then
      log_error "$INSTALL_DIR is a git checkout but its 'origin' remote ($EXISTING_URL) doesn't match APP_REPO_URL ($REPO_URL)."
      log_error "Remove it, set APP_INSTALL_DIR to a different path, or set APP_REPO_URL to match, then re-run."
      exit 1
    fi
    if [ -n "$(git -C "$INSTALL_DIR" status --porcelain 2>/dev/null)" ]; then
      log_error "$INSTALL_DIR has uncommitted changes; refusing to discard them with 'git reset --hard'."
      log_error "Commit or stash your changes, remove the directory, or set APP_INSTALL_DIR to a different path, then re-run."
      exit 1
    fi
    log_info "Found existing checkout at $INSTALL_DIR, updating..."
    git -C "$INSTALL_DIR" fetch --depth 1 origin -- "${REPO_REF:-HEAD}"
    git -C "$INSTALL_DIR" reset --hard FETCH_HEAD
  elif [ -e "$INSTALL_DIR" ]; then
    log_error "$INSTALL_DIR already exists and isn't a git checkout."
    log_error "Remove it or set APP_INSTALL_DIR to a different path, then re-run."
    exit 1
  else
    log_info "Cloning $REPO_URL into $INSTALL_DIR..."
    if [ -n "$REPO_REF" ]; then
      git clone --depth 1 --branch "$REPO_REF" -- "$REPO_URL" "$INSTALL_DIR"
    else
      git clone --depth 1 -- "$REPO_URL" "$INSTALL_DIR"
    fi
  fi

  PROJECT_ROOT="$INSTALL_DIR"
fi

cd -- "$PROJECT_ROOT"

if [ ! -f docker-compose.yml ]; then
  log_error "docker-compose.yml not found in $PROJECT_ROOT. The clone may have failed or the repo layout changed."
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

DOCKER_SUDO=""

# Checks whether Docker is reachable, without exiting on failure - safe to use
# as a retry-loop condition. Sets DOCKER_SUDO for run_docker to use.
docker_ready() {
  if docker info >/dev/null 2>&1; then
    DOCKER_SUDO=""
    return 0
  elif sudo docker info >/dev/null 2>&1; then
    DOCKER_SUDO="sudo "
    return 0
  else
    return 1
  fi
}

run_docker() {
  if docker_ready; then
    # shellcheck disable=SC2086 # intentional word-split: turns "sudo " into a separate argv word
    ${DOCKER_SUDO}docker "$@"
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
  if docker_ready; then
    break
  fi
  log_info "Waiting for Docker daemon..."
  sleep 2
  i=$((i + 1))
done

if ! docker_ready; then
  log_error "Docker daemon is not running. Start it with: sudo systemctl start docker"
  exit 1
fi

if [ -n "$DOCKER_SUDO" ]; then
  log_warn "Using sudo to run Docker (your user's docker group membership may not be active in this shell yet)."
fi

# -----------------------------------------------------------------------------
# 2. Prompt for environment variables (Postgres + JWT)
#
# Do NOT use command substitution $(...) for reads - it redirects stdin and
# breaks read. Below, stdin is redirected to /dev/tty once (via `exec`) before
# prompting, so this still works when the installer itself is being fed via
# `curl ... | bash` - stdin in that case is the script body, not the user's
# keyboard.
# -----------------------------------------------------------------------------
log_info "Configuring production environment (Postgres database and secrets)..."

# Use env vars if already set (non-interactive), otherwise prompt
if [ -n "${APP_DB_PASSWORD}" ] && [ -n "${APP_JWT_SECRET}" ]; then
  log_info "Using APP_DB_* and APP_JWT_SECRET from environment"
  APP_DB_HOST=${APP_DB_HOST:-host.docker.internal}
  APP_DB_PORT=${APP_DB_PORT:-5432}
  APP_DB_USERNAME=${APP_DB_USERNAME:-postgres}
  APP_DB_NAME=${APP_DB_NAME:-address_work}
  APP_SENTRY=${APP_SENTRY:-}
else
  # A bare `-e /dev/tty` check only proves the device node exists, not that it
  # can actually be opened (e.g. no controlling terminal at all) - so probe by
  # actually opening it. The probe runs in a subshell so its own `2>/dev/null`
  # (there just to hide the "No such device" message on failure) stays scoped
  # to the subshell - applying it directly to a bare `exec` in THIS shell would
  # permanently redirect the rest of the script's stderr to /dev/null on
  # success, silently swallowing every prompt below.
  if [ ! -e /dev/tty ] || ! (exec < /dev/tty) 2>/dev/null; then
    log_error "No terminal available for interactive prompts, and APP_DB_PASSWORD/APP_JWT_SECRET aren't set."
    log_error "Set the required environment variables and re-run for a non-interactive install, e.g.:"
    log_error "  APP_DB_PASSWORD=... APP_JWT_SECRET=... curl -fsSL <url> | bash"
    exit 1
  fi
  exec < /dev/tty

  printf '\n' >&2
  printf 'You will be asked for a few values below. Press Enter to accept the\n' >&2
  printf 'default shown in [brackets], or type a value and press Enter.\n' >&2
  printf '  - APP_DB_HOST, APP_DB_PORT, APP_DB_USERNAME, APP_DB_NAME: have defaults\n' >&2
  printf '  - APP_DB_PASSWORD, APP_JWT_SECRET: required, no default\n' >&2
  printf '  - APP_SENTRY: optional, leave blank to skip\n' >&2
  printf '\n' >&2

  printf 'APP_DB_HOST (Postgres host) [host.docker.internal]: ' >&2
  read -r APP_DB_HOST
  APP_DB_HOST=${APP_DB_HOST:-host.docker.internal}

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
  printf '  Project dir: %s\n' "$PROJECT_ROOT"
  printf '  Containers:  cd %s && %sdocker compose ps\n' "$PROJECT_ROOT" "$DOCKER_SUDO"
  printf '  Logs:        cd %s && %sdocker compose logs -f\n' "$PROJECT_ROOT" "$DOCKER_SUDO"
  printf '  Stop:        cd %s && %sdocker compose down\n' "$PROJECT_ROOT" "$DOCKER_SUDO"
  printf '\n'
else
  log_error "Containers may not have started. Check logs:"
  printf '  cd %s && %sdocker compose logs -f\n' "$PROJECT_ROOT" "$DOCKER_SUDO"
  exit 1
fi

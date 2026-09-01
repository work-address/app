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
#
# NOT installed by this script: PostgreSQL. The compose stack deliberately
# talks to an *external* database (see README-DOCKER.md), so Postgres must
# already be running and the target database must already exist before you
# run this. Everything else - Docker, git, Redis, the app itself - is handled.
#
# Tunable via environment:
#   APP_REPO_URL, APP_REPO_REF, APP_INSTALL_DIR  - where to clone from/to
#   APP_PUBLIC_URL          - URL this install is served at (default http://localhost:8000)
#   APP_DB_*, APP_JWT_SECRET, APP_SENTRY         - app config (prompted if unset)
#   APP_BUILD_NO_CACHE=1    - force a cache-free rebuild
#   APP_SKIP_SMOKE_TEST=1   - skip the post-start HTTP check
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
  fetch()   { curl -fsSL "$1" -o "$2"; }
  http_ok() { curl -fsS -o /dev/null --max-time 5 "$1"; }
elif command -v wget >/dev/null 2>&1; then
  fetch()   { wget -q -O "$2" "$1"; }
  http_ok() { wget -q -O /dev/null --timeout=5 "$1"; }
else
  log_error "Need curl or wget. Install one: apt install curl"
  exit 1
fi

# -----------------------------------------------------------------------------
# Privilege helper
#
# Fresh VPS images often hand you a root shell with no `sudo` binary at all, so
# hard-coding `sudo` turns "already root" into "command not found". Resolve the
# escalation strategy once, and only fail when a step genuinely needs root.
# -----------------------------------------------------------------------------
as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    log_error "This step needs root, but you are not root and sudo is not installed:"
    log_error "  $*"
    log_error "Re-run as root, or install sudo."
    exit 1
  fi
}

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
    as_root apt-get install -y git || (as_root apt-get update -y && as_root apt-get install -y git)
  elif command -v dnf >/dev/null 2>&1; then
    as_root dnf install -y git
  elif command -v yum >/dev/null 2>&1; then
    as_root yum install -y git
  elif command -v apk >/dev/null 2>&1; then
    as_root apk add --no-cache git
  elif command -v pacman >/dev/null 2>&1; then
    as_root pacman -Sy --noconfirm git
  elif command -v zypper >/dev/null 2>&1; then
    as_root zypper install -y git
  elif command -v brew >/dev/null 2>&1; then
    brew install git
  else
    log_error "git is required but couldn't be auto-installed on this system. Install git and re-run."
    exit 1
  fi
}

# A private (or moved) repo fails here with git's own credential prompt or a
# bare "Repository not found", which tells the user nothing about what to do.
clone_failed() {
  log_error "Could not clone $REPO_URL."
  log_error "If the repository is private, give the installer an authenticated URL, e.g.:"
  log_error "  APP_REPO_URL=git@github.com:work-address/app.git   (SSH key already set up)"
  log_error "  APP_REPO_URL=https://<token>@github.com/work-address/app.git"
  log_error "Or clone it yourself and run ./scripts/installer.sh from inside the checkout."
  exit 1
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
    git -C "$INSTALL_DIR" fetch --depth 1 origin -- "${REPO_REF:-HEAD}" || clone_failed
    git -C "$INSTALL_DIR" reset --hard FETCH_HEAD
  elif [ -e "$INSTALL_DIR" ]; then
    log_error "$INSTALL_DIR already exists and isn't a git checkout."
    log_error "Remove it or set APP_INSTALL_DIR to a different path, then re-run."
    exit 1
  else
    log_info "Cloning $REPO_URL into $INSTALL_DIR..."
    if [ -n "$REPO_REF" ]; then
      git clone --depth 1 --branch "$REPO_REF" -- "$REPO_URL" "$INSTALL_DIR" || clone_failed
    else
      git clone --depth 1 -- "$REPO_URL" "$INSTALL_DIR" || clone_failed
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
  as_root sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh

  if command -v systemctl >/dev/null 2>&1; then
    as_root systemctl start docker
    as_root systemctl enable docker
  fi

  # Nothing to add when we're already root - root reaches the socket directly.
  if [ "$(id -u)" -ne 0 ]; then
    as_root usermod -aG docker "$(whoami)"
    log_warn "You may need to log out and back in for docker group to take effect."
  elif [ -n "$SUDO_USER" ]; then
    as_root usermod -aG docker "$SUDO_USER"
    log_warn "User $SUDO_USER added to docker group. You may need to log out and back in."
  fi

  log_info "Docker installed successfully."
}

# 1 when the Docker socket is only reachable via root.
DOCKER_NEEDS_ROOT=0

# Checks whether Docker is reachable, without exiting on failure - safe to use
# as a retry-loop condition. Sets DOCKER_NEEDS_ROOT for run_docker to use.
docker_ready() {
  if docker info >/dev/null 2>&1; then
    DOCKER_NEEDS_ROOT=0
    return 0
  fi
  if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    DOCKER_NEEDS_ROOT=1
    return 0
  fi
  return 1
}

run_docker() {
  if [ "$DOCKER_NEEDS_ROOT" -eq 1 ]; then
    sudo docker "$@"
  else
    docker "$@"
  fi
}

# Always pin the compose file: an unrelated docker-compose.override.yml sitting
# in the project root would otherwise be merged in silently and change what
# gets built.
compose() { run_docker compose -f docker-compose.yml "$@"; }

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

DOCKER_PREFIX=""
if [ "$DOCKER_NEEDS_ROOT" -eq 1 ]; then
  DOCKER_PREFIX="sudo "
  log_warn "Using sudo to run Docker (your user's docker group membership may not be active in this shell yet)."
fi

# -----------------------------------------------------------------------------
# 1b. Require Docker Compose v2
#
# docker-compose v1 (the Python one) cannot run this stack at all: the compose
# file uses the `env_file: [{path:, required:}]` long syntax (Compose 2.24+)
# and `pull_policy: build`, and web/dockerfile.prod uses a BuildKit
# `RUN --mount`. Failing here with the reason beats failing mid-build with a
# schema error nobody can act on.
# -----------------------------------------------------------------------------
COMPOSE_MIN="2.24.0"

version_lt() {
  # version_lt A B -> true when A < B, comparing dot-separated numbers.
  [ "$1" = "$2" ] && return 1
  awk -v a="$1" -v b="$2" '
    BEGIN {
      na = split(a, x, "."); nb = split(b, y, ".")
      n = (na > nb ? na : nb)
      for (i = 1; i <= n; i++) {
        xi = (i <= na ? x[i] + 0 : 0); yi = (i <= nb ? y[i] + 0 : 0)
        if (xi < yi) exit 0
        if (xi > yi) exit 1
      }
      exit 1
    }'
}

if ! run_docker compose version >/dev/null 2>&1; then
  log_error "Docker Compose v2 is required but 'docker compose' is not available."
  if command -v docker-compose >/dev/null 2>&1; then
    log_error "Found the legacy 'docker-compose' v1 binary, which cannot build this stack."
  fi
  log_error "Install it with: sudo apt install docker-compose-plugin"
  exit 1
fi

COMPOSE_VERSION="$(run_docker compose version --short 2>/dev/null | sed 's/^v//' | tr -d ' ')"
COMPOSE_NUMERIC="$(printf '%s' "$COMPOSE_VERSION" | sed 's/[^0-9.].*$//')"
if [ -n "$COMPOSE_NUMERIC" ] && version_lt "$COMPOSE_NUMERIC" "$COMPOSE_MIN"; then
  log_error "Docker Compose $COMPOSE_VERSION is too old; this stack needs $COMPOSE_MIN or newer."
  log_error "Upgrade with: sudo apt install --only-upgrade docker-compose-plugin"
  exit 1
fi
log_info "Docker Compose ${COMPOSE_VERSION:-v2} detected."

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

# Reads a secret without echoing it. `read -s` is a bashism; when this is
# somehow running under a shell without it, fall back to `stty -echo` and, if
# even that is unavailable, to a visible read rather than failing the install.
read_secret() {
  _prompt="$1"
  printf '%s' "$_prompt" >&2
  if [ -n "${BASH_VERSION}" ]; then
    read -r -s _secret_value
    printf '\n' >&2
  elif command -v stty >/dev/null 2>&1; then
    _saved_stty="$(stty -g 2>/dev/null || true)"
    stty -echo 2>/dev/null || true
    read -r _secret_value
    [ -n "$_saved_stty" ] && stty "$_saved_stty" 2>/dev/null || stty echo 2>/dev/null || true
    printf '\n' >&2
  else
    read -r _secret_value
  fi
}

# Use env vars if already set (non-interactive), otherwise prompt
if [ -n "${APP_DB_PASSWORD}" ] && [ -n "${APP_JWT_SECRET}" ]; then
  log_info "Using APP_DB_* and APP_JWT_SECRET from environment"
  APP_PUBLIC_URL=${APP_PUBLIC_URL:-http://localhost:8000}
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
  printf '  - APP_PUBLIC_URL: where this install will be reached from a browser\n' >&2
  printf '  - APP_DB_HOST, APP_DB_PORT, APP_DB_USERNAME, APP_DB_NAME: have defaults\n' >&2
  printf '  - APP_DB_PASSWORD, APP_JWT_SECRET: required, no default (input is hidden)\n' >&2
  printf '  - APP_SENTRY: optional, leave blank to skip\n' >&2
  printf '\n' >&2
  printf 'Postgres is NOT installed by this script. Point APP_DB_* at a running\n' >&2
  printf 'server with the database already created (use host.docker.internal, not\n' >&2
  printf 'localhost, when Postgres runs on this machine).\n' >&2
  printf '\n' >&2

  printf 'APP_PUBLIC_URL (browser URL for this install) [http://localhost:8000]: ' >&2
  read -r APP_PUBLIC_URL
  APP_PUBLIC_URL=${APP_PUBLIC_URL:-http://localhost:8000}

  printf 'APP_DB_HOST (Postgres host) [host.docker.internal]: ' >&2
  read -r APP_DB_HOST
  APP_DB_HOST=${APP_DB_HOST:-host.docker.internal}

  printf 'APP_DB_PORT [5432]: ' >&2
  read -r APP_DB_PORT
  APP_DB_PORT=${APP_DB_PORT:-5432}

  printf 'APP_DB_USERNAME [postgres]: ' >&2
  read -r APP_DB_USERNAME
  APP_DB_USERNAME=${APP_DB_USERNAME:-postgres}

  read_secret 'APP_DB_PASSWORD (hidden): '
  APP_DB_PASSWORD="$_secret_value"

  printf 'APP_DB_NAME [address_work]: ' >&2
  read -r APP_DB_NAME
  APP_DB_NAME=${APP_DB_NAME:-address_work}

  read_secret 'APP_JWT_SECRET (min 32 chars, hidden): '
  APP_JWT_SECRET="$_secret_value"

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

# Trailing slashes would show up doubled in every URL printed at the end.
APP_PUBLIC_URL="$(printf '%s' "$APP_PUBLIC_URL" | sed 's#/*$##')"

# The web bundle and the TON proof check both need to know the public origin.
# Strip the scheme and any path so what's left is host[:port] - the exact shape
# APP_TON_ALLOWED_DOMAINS expects (comma-separated, no scheme).
PUBLIC_HOST="$(printf '%s' "$APP_PUBLIC_URL" | sed -e 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##' -e 's#/.*$##')"
if [ -z "$PUBLIC_HOST" ]; then
  log_error "APP_PUBLIC_URL ($APP_PUBLIC_URL) doesn't contain a hostname."
  exit 1
fi

# -----------------------------------------------------------------------------
# 3. Write .env for docker-compose variable substitution
#
# Values are single-quoted because compose's dotenv parser interpolates bare
# values: an unquoted secret containing `$` is expanded (so `s3cret$1` silently
# becomes `s3cret`) and everything after an unquoted ` #` is dropped as a
# comment. Inside single quotes the only character the parser still treats
# specially is `'` itself, which it accepts escaped as \'.
# -----------------------------------------------------------------------------
env_escape() { printf '%s' "$1" | sed "s/'/\\\\'/g"; }

ENV_FILE="$PROJECT_ROOT/.env"

# Create with restrictive permissions *before* the secrets land in it, so the
# file is never briefly world-readable.
: > "$ENV_FILE"
chmod 600 "$ENV_FILE"

write_env_var() {
  # A value ending in a backslash would escape the closing quote, and the
  # parser has no second escape to express it - refuse rather than corrupt it.
  case "$2" in
    *\\)
      log_error "$1 ends with a backslash, which cannot be represented in the .env file."
      log_error "Choose a value that doesn't end in '\\' and re-run."
      exit 1
      ;;
  esac
  printf "%s='%s'\n" "$1" "$(env_escape "$2")" >> "$ENV_FILE"
}

printf '# Generated by installer.sh - Postgres & app config\n' >> "$ENV_FILE"
write_env_var APP_DB_HOST     "$APP_DB_HOST"
write_env_var APP_DB_PORT     "$APP_DB_PORT"
write_env_var APP_DB_USERNAME "$APP_DB_USERNAME"
write_env_var APP_DB_PASSWORD "$APP_DB_PASSWORD"
write_env_var APP_DB_NAME     "$APP_DB_NAME"
write_env_var APP_JWT_SECRET  "$APP_JWT_SECRET"
write_env_var APP_SENTRY      "$APP_SENTRY"

printf '\n# Public origin of this install.\n' >> "$ENV_FILE"
write_env_var APP_PUBLIC_URL "$APP_PUBLIC_URL"

# Empty on purpose: nginx serves the web app and proxies /api on the SAME
# origin, and every generated client path is already rooted at /api, so an
# empty base URL makes the browser call whatever host it loaded the page from.
# Baking an absolute URL in here instead would point a self-hosted install at
# someone else's API. Compose defaults this to the hosted domain when the
# variable is *unset*, so it must be present-but-empty rather than omitted.
printf '\n# Same-origin API calls - see docker-compose.yml.\n' >> "$ENV_FILE"
write_env_var VITE_API_URL ""

# TON wallet proofs carry the domain the wallet signed for; the API rejects a
# proof whose domain is not listed here. Left empty the check is skipped
# entirely, so pinning it to the public host is what makes wallet login safe.
write_env_var APP_TON_ALLOWED_DOMAINS "$PUBLIC_HOST"

log_info "Wrote $ENV_FILE"

# -----------------------------------------------------------------------------
# 4. Build and run in production mode
# -----------------------------------------------------------------------------
log_info "Building and starting services (this may take a few minutes)..."

if [ -n "${APP_BUILD_NO_CACHE}" ]; then
  compose build --no-cache
else
  # BuildKit's cache is content-addressed, so a plain build still picks up every
  # source change - and re-running the installer doesn't pay for a full rebuild.
  compose build
fi
compose up -d

# -----------------------------------------------------------------------------
# 5. Verify
#
# `docker ps | grep nginx` only proves the proxy is up. The API runs
# `schema:sync` before it serves anything, so an unreachable Postgres, a wrong
# password or a missing database kills that container while nginx keeps
# answering - which used to be reported as a successful install. Wait for the
# API to actually respond, and surface its own logs when it doesn't.
# -----------------------------------------------------------------------------
service_state() {
  _cid="$(compose ps -q "$1" 2>/dev/null | head -1)"
  if [ -z "$_cid" ]; then
    printf 'missing'
    return 0
  fi
  run_docker inspect -f '{{.State.Status}}' "$_cid" 2>/dev/null || printf 'unknown'
}

report_failure() {
  log_error "$1"
  printf '\n' >&2
  log_error "Last lines from the API container:"
  compose logs --tail 30 api >&2 2>&1 || true
  printf '\n' >&2
  log_error "Common causes:"
  log_error "  - Postgres is not running, or not reachable at ${APP_DB_HOST}:${APP_DB_PORT}"
  log_error "    (use host.docker.internal, not localhost, for a database on this machine)"
  log_error "  - The database '${APP_DB_NAME}' does not exist yet - create it first:"
  log_error "      createdb -h <host> -U ${APP_DB_USERNAME} ${APP_DB_NAME}"
  log_error "  - APP_DB_USERNAME / APP_DB_PASSWORD are wrong"
  printf '\n' >&2
  # log_error only interpolates its single argument, so build this line with printf.
  printf '%b\n' "${RED}[ERROR]${NC} Full logs: cd $PROJECT_ROOT && ${DOCKER_PREFIX}docker compose logs -f" >&2
  exit 1
}

SMOKE_URL="http://localhost:8000/api/help/openApi"

if [ -n "${APP_SKIP_SMOKE_TEST}" ]; then
  log_warn "APP_SKIP_SMOKE_TEST set - skipping the post-start health check."
else
  log_info "Waiting for the API to come up..."
  READY=0
  i=0
  # schema:sync against a cold database can take a while on first boot.
  while [ $i -lt 60 ]; do
    API_STATE="$(service_state api)"
    if [ "$API_STATE" = "exited" ] || [ "$API_STATE" = "dead" ]; then
      report_failure "The API container stopped (state: $API_STATE)."
    fi
    if http_ok "$SMOKE_URL" >/dev/null 2>&1; then
      READY=1
      break
    fi
    sleep 2
    i=$((i + 1))
  done

  if [ "$READY" -ne 1 ]; then
    report_failure "The API did not respond at $SMOKE_URL after 2 minutes."
  fi

  for svc in nginx web api redis; do
    STATE="$(service_state "$svc")"
    if [ "$STATE" != "running" ]; then
      report_failure "Service '$svc' is not running (state: $STATE)."
    fi
  done
fi

log_info "Services are running."
printf '\n'
printf '%b\n' "${GREEN}============================================${NC}"
printf '%b\n' "${GREEN}  Address Work is running in production mode${NC}"
printf '%b\n' "${GREEN}============================================${NC}"
printf '\n'
printf '  URL:     %s\n' "$APP_PUBLIC_URL"
printf '  API:     %s/api\n' "$APP_PUBLIC_URL"
printf '  Swagger: %s/swagger\n' "$APP_PUBLIC_URL"
printf '\n'
if [ "$PUBLIC_HOST" != "localhost:8000" ]; then
  printf '  (served locally on http://localhost:8000 - put your reverse proxy in front of that port)\n'
  printf '\n'
fi
printf '  Project dir: %s\n' "$PROJECT_ROOT"
printf '  Containers:  cd %s && %sdocker compose ps\n' "$PROJECT_ROOT" "$DOCKER_PREFIX"
printf '  Logs:        cd %s && %sdocker compose logs -f\n' "$PROJECT_ROOT" "$DOCKER_PREFIX"
printf '  Stop:        cd %s && %sdocker compose down\n' "$PROJECT_ROOT" "$DOCKER_PREFIX"
printf '\n'

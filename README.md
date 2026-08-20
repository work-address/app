## Installation

Bootstrap a fresh machine with a single command — no need to clone first. This installs Docker (if missing), installs `git` (if missing), clones the repo, prompts for Postgres credentials and a JWT secret, then builds and runs the app in production mode:

```sh
curl -fsSL https://raw.githubusercontent.com/work-address/app/dev/scripts/installer.sh | bash
```

The repo is cloned into `./app` in your current directory (override with `APP_INSTALL_DIR=/some/path`). Running the command again later re-clones/updates that same checkout and re-runs the install.

**Already have the repo cloned?** Run the script directly instead:

```sh
git clone https://github.com/work-address/app.git && cd app
./scripts/installer.sh
```

If you see "Bad substitution" or "[[: not found]", run with bash explicitly: `bash scripts/installer.sh`

**Prerequisites:** `curl` or `wget`. `git` and Docker are installed automatically if missing (requires `sudo`).

**Interactive prompts:** You will be asked for `APP_DB_HOST`, `APP_DB_PORT`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_NAME`, `APP_JWT_SECRET`, and optional `APP_SENTRY`.

**Non-interactive (e.g. CI, or no controlling terminal):** Set `APP_DB_PASSWORD` and `APP_JWT_SECRET` (and optionally other vars) in the environment before running:

```sh
APP_DB_PASSWORD=... APP_JWT_SECRET=... curl -fsSL https://raw.githubusercontent.com/work-address/app/dev/scripts/installer.sh | bash
```

---

For running via Docker Compose directly (production or development), see [README-DOCKER.md](README-DOCKER.md).

## Install

From the **monorepo root** (`app/`):

```sh
pnpm install
```

## Configuration

Copy the example env and adjust values:

```sh
cp .env.example .env
```

Key variables (see `.env.example`): `APP_HOST`, `APP_PORT`, `APP_DB_*`, `APP_REDIS`, `APP_JWT_SECRET`, `APP_SENTRY`.

## Database

Create databases (names should match your env):

```sql
CREATE DATABASE address_work_dev;
CREATE DATABASE address_work_test;
```

Apply the schema with TypeORM (run from **`api/`**):

```sh
NODE_ENV=development pnpm run schema:sync
NODE_ENV=test pnpm run schema:sync
```

Drop and recreate (destructive):

```sh
pnpm run schema:drop
pnpm run schema:sync
```

## Scripts

| Script                                     | Purpose                                            |
| ------------------------------------------ | -------------------------------------------------- |
| `pnpm run dev`                             | Development server (`ts-node-dev`, HTTPS env flag) |
| `pnpm run build`                           | Compile TypeScript to `build/`                     |
| `pnpm run prod`                            | Run `build/server.js` (set `NODE_ENV=production`)  |
| `pnpm test`                                | Tests with coverage (`nyc` + `mocha` + `ts-node`)  |
| `pnpm run lint` / `lint:check` / `lint:fix` | ESLint (`@app/eslint-config`, `eslint.config.js`) |
| `pnpm run prettier:check` / `prettier:fix` | Formatting                                         |
| `pnpm run schema:sync` / `schema:drop`    | TypeORM schema sync/drop (`src/ormconfig.ts`)      |
| `pnpm run typeorm:cli`                     | TypeORM CLI (pass subcommand + `-f src/ormconfig.ts`) |

## API documentation

All HTTP routes are under the **`/api`** prefix.

- **Swagger UI:** `http://<host>:<port>/swagger`
- **OpenAPI spec (JSON):** `GET /api/help/openApi`

## Testing

```sh
NODE_ENV=test pnpm test
```

Run a single file (example):

```sh
NODE_ENV=test ./node_modules/.bin/mocha --require ts-node/register ./src/test/service/Authenticator.test.ts
```

Integration-style controller tests expect Postgres/Redis according to your test env.

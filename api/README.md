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

Key variables (see `.env.example`): `APP_HOST`, `APP_PORT`, `APP_DB_*`, `APP_REDIS`, `APP_JWT_SECRET`, `APP_SENTRY`, `APP_LOGGLY`, and `APP_IDENTITY_*` for the IdentityRegistry profiles are anchored to (unset disables anchoring).

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

| Script                                      | Purpose                                                          |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm run dev`                              | Development server (`ts-node-dev`, HTTPS env flag)               |
| `pnpm run build`                            | Compile TypeScript to `build/`                                   |
| `pnpm run prod`                             | Run `build/server.js` (set `NODE_ENV=production`)                |
| `pnpm test`                                 | Tests with coverage (`nyc` + `mocha` + `ts-node`)                |
| `pnpm run lint` / `lint:check` / `lint:fix` | ESLint (`@app/eslint-config`, `eslint.config.js`)                |
| `pnpm run prettier:check` / `prettier:fix`  | Formatting                                                       |
| `pnpm run schema:sync` / `schema:drop`      | TypeORM schema sync/drop (`src/ormconfig.ts`)                    |
| `pnpm run typeorm:cli`                      | TypeORM CLI (pass subcommand + `-d src/ormconfig.ts`)            |
| `pnpm run backfill:invoice-snapshot`        | One-off, after `schema:sync`: marks pre-snapshot invoices legacy |

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

The identity routes also run against the real `IdentityRegistry` on a local
Hardhat node. In the contracts repository run `npm run node` and then
`npm run deploy:localhost`; then here:

```sh
IDENTITY_TEST_MANIFEST=<contracts>/deployments/localhost.json pnpm test
```

Without `IDENTITY_TEST_MANIFEST` that suite is skipped, and the same cases run
against the contract's state machine in memory. It refuses any chain but
31337, and funds its wallets from Hardhat's public test accounts.

# API Backend — Reference

Detailed conventions for the `api/` package: routing-controllers, Inversify DI, and TypeORM.

## Package location

| Item | Path |
|------|------|
| Backend app | `api/` |
| Source root | `api/src/` |
| Path alias | `@` → `api/src` |
| Entry point | `api/src/server.ts` |
| TypeORM CLI config | `api/src/ormconfig.ts` |

pnpm workspaces: `api`, `web`, `packages/*`. Run scripts via `pnpm --filter ./api <script>` or `cd api && pnpm <script>`. Dev server: `cd api && pnpm dev` (port 4000).

`@` resolves to `api/src` via `tsconfig.json` `paths`. Runtime: `tsconfig-paths/register` in dev/test; `register-path-alias.ts` patches `_resolveFilename` in prod.

## Directory structure

```
api/src/
├── server.ts                    # register-path-alias → createApp → bootstrap → start
├── register-path-alias.ts       # Runtime @/ → src/ resolution (prod)
├── ormconfig.ts                 # TypeORM CLI config
│
├── app/
│   ├── app.ts                   # Express + routing-controllers bootstrap
│   ├── app-container.ts         # Inversify container bindings
│   ├── app-config.ts            # Env detection, dotenv, IConfigParameters
│   └── app-bootstrap.ts         # createApp() / createAppTest()
│
├── connector/db-connector.ts    # TypeORM Connection creation
│
├── controller/                  # HTTP controllers (@JsonController)
├── decorator/                   # @CurrentUser, @EntityFromParam, openapi/
├── entity/                      # TypeORM entities + entity/constraint/
├── exception/                   # Custom HTTP errors
├── middleware/                  # error-handler, validate-roles, payload-logger
├── model/                       # I*/E* types; model/dto/ for *Dto
├── repository/                  # AbstractRepositoryTemplate + concrete repos
├── service/                     # *Manager + infra + service/auth/
├── scripts/export-openapi-spec.ts
├── test/                        # *.test.ts co-located under src/
└── types/global.d.ts
```

## Core rule: no helper methods without classes

Every function that carries domain or utility logic is a **method on a class**. Stateless utilities use `static` methods on a named class; stateful collaborators are `@injectable()` services.

```typescript
// service/helper.ts
export class Helper {
  public static toFixedDecimals(value: number, numberDecimals: number) {
    return Number(value.toFixed(numberDecimals))
  }
}

// service/calc.ts
export class Calc {
  public static rateTotal(/* ... */) { /* ... */ }
}
```

### Documented exceptions (framework plumbing only)

| Category | Location | Example |
|----------|----------|---------|
| Bootstrap | `app/app-bootstrap.ts` | `createApp()`, `createAppTest()` |
| Authorization callback | `middleware/validate-roles.ts` | `export const ValidateRoles = async (action, roles) => …` |
| Decorator factories | `decorator/*.ts`, `decorator/openapi/*.ts` | `CurrentUser()`, `EntityFromParam()`, `OpenAPIExtended()` |
| OpenAPI internals | `decorator/openapi/*.ts` | private module functions |
| Crypto/auth helpers | `service/auth/ton-wallets.ts` | `loadWalletV1Data()`, `tryParsePublicKey()` |
| Test fixtures | `test/fixture/*.ts` | `buildTonAuthPayload()` |
| Type-only exports | `model/dto/search.ts` | `SORT_DIRECTIONS`, `type SortDirection` |

Anything that is domain or reusable business logic must be in a class, not a loose function.

## Layer responsibilities

### Controllers (`controller/`)

HTTP routing, request/response shaping, auth decorators; delegate to managers/repositories. DI is **manual** via `App.container.get('Token')` in the constructor (not `@inject`).

```typescript
@Authorized([EUserRole.ROLE_USER])
@JsonController('/project')
export class ProjectController {
  protected projectManager: ProjectManager
  protected projectRepository: ProjectRepository

  constructor() {
    this.projectManager = App.container.get('ProjectManager')
    this.projectRepository = App.container.get('ProjectRepository')
  }
}
```

Registered in `app/app.ts` via `useExpressServer` with `routePrefix: '/api'`.

### Services (`service/`)

Business logic, orchestration, external integrations. `@injectable()` + property `@inject('Token')`.

```typescript
@injectable()
export class ProjectManager {
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository
  @inject('UserRepository')
  protected userRepository: UserRepository
}
```

Naming: `*Manager` for domain orchestration; plain names for infra (`Filter`, `Http`, `Mailer`, `RedisClient`, `OpenApi`, `ImageResizer`). Auth services in `service/auth/` (`Authenticator`, `AuthenticatorTimeTracker`, `Signer`, `TonProofService`).

### Repositories (`repository/`)

TypeORM data access, query builders, search/pagination. Extend `AbstractRepositoryTemplate<T>`, set `protected target`, inject `Filter`.

```typescript
@injectable()
export class ProjectRepository extends AbstractRepositoryTemplate<Project> {
  @inject('Filter')
  protected filter: Filter
  @inject('UserRepository')
  protected userRepository: UserRepository
  protected target = Project
}
```

`AbstractRepositoryTemplate` provides `validateAndSave`, `findBy`, `saveSingle`, query-builder helpers via `getRepository(this.target)`. `validateAndSave()` runs class-validator → throws `ConstraintsValidationException`.

### Entities (`entity/`)

TypeORM DB models + validation + serialization groups + OpenAPI schema metadata. Extend `AbstractBaseEntity`, implement the matching `I*` interface.

```typescript
@Entity('project')
@Exclude()
export class Project extends AbstractBaseEntity implements IProject {
  @IsNotEmpty()
  @Expose({ groups: ['search', 'create', 'edit'] })
  @Column('text', { nullable: true })
  @IsString()
  title: string
}
```

- `AbstractBaseEntity`: `id` (UUID), `createdAt`, `updatedAt`, `deletedAt` (soft delete)
- Relations: `@ManyToOne`, `@OneToMany`, `@JoinColumn`, often `eager: true`
- Serialization: `@Exclude()` on class, `@Expose({ groups })` per field — drives output + OpenAPI groups
- Custom validators: `@ValidatorConstraint` classes in `entity/constraint/`

### Models (`model/`)

Pure TypeScript — **no TypeORM decorators**.

| Kind | Location | Naming | Example |
|------|----------|--------|---------|
| Enums | `model/*.ts` | `E` prefix | `EProjectState`, `EUserRole` |
| Interfaces | `model/*.ts` | `I` prefix | `IProject`, `IConfigParameters` |
| DTO classes | `model/dto/*.ts` | `*Dto` suffix | `ProjectSearchDto`, `AuthEthLoginDto` |
| Type aliases | `model/dto/*.ts` | no prefix | `SortDirection` |

DTOs use class-validator + class-transformer (`@Type()`, `@ValidateNested()`). Search DTOs extend `SearchDto` and nest filter/sort sub-DTOs.

### Middleware (`middleware/`)

- `ErrorHandler` — `@Middleware({ type: 'after' })` implements `ExpressErrorMiddlewareInterface`; uses `ErrorFormatter.format()`; Sentry capture.
- `ValidateRoles` — exported async function passed as `authorizationChecker`; resolves user via `Authenticator`, compares `user.roles` to `@Authorized([...])`. Empty roles array → any authenticated user.

```typescript
@Middleware({ type: 'after' })
export class ErrorHandler implements ExpressErrorMiddlewareInterface {
  error(error: unknown, _request, response, _next): void {
    const errorFormatted = ErrorFormatter.format(error)
    response.status(httpCode)
    response.send(errorFormatted)
  }
}
```

### Exceptions (`exception/`)

Default-exported classes extending routing-controllers errors. Set `static NAME`, fix prototype chain.

```typescript
class AccessException extends UnauthorizedError {
  public static NAME = 'UserAccessException'
  constructor(message: string = "The data can't be accessed by your user") {
    super(`Access error: ${message}`)
    Object.setPrototypeOf(this, AccessException.prototype)
    this.name = AccessException.NAME
  }
}
export default AccessException
```

| Exception | Extends | HTTP |
|-----------|---------|------|
| `AccessException` | `UnauthorizedError` | 401 |
| `AuthenticationException` | `UnauthorizedError` | 401 |
| `TimeTrackerException` | `UnauthorizedError` | 401 |
| `ConstraintsValidationException` | `HttpError` | 400 (+ `violations`) |
| `RejectedExecutionException` | `Error` | internal/bootstrap |

Import as default: `import AccessException from '@/exception/access-exception'`.

## Dependency injection (Inversify)

### Container (`app/app-container.ts`)

```typescript
public static build(parameters: IConfigParameters, env: string) {
  const container = new Container({ skipBaseClassChecks: true })
  container.bind<string>('env').toConstantValue(env)
  container.bind<IConfigParameters>('parameters').toConstantValue(parameters)
  container.bind<Http>('Http').to(Http)
  container.bind<UserRepository>('UserRepository').to(UserRepository)
  container.bind<ProjectManager>('ProjectManager').to(ProjectManager)
  container.bind<UserFixture>('UserFixture').to(UserFixture)
  return container
}
```

**Token convention:** token string = PascalCase class name. Exceptions: `'env'`, `'parameters'`. No Symbols.

| Layer | DI pattern |
|-------|------------|
| Services, repositories, fixtures | `@injectable()` + `@inject('Token')` |
| Controllers | `App.container.get('Token')` in constructor |
| Middleware (`ValidateRoles`), `@CurrentUser` | `AppContainer.getContainer().get('Token')` |

Add every new service/repository/fixture to `app-container.ts` or `@inject` resolution fails at runtime.

## routing-controllers usage

### Global setup (`app/app.ts`)

```typescript
useExpressServer(this.express, {
  defaultErrorHandler: false,
  middlewares: [ErrorHandler],
  authorizationChecker: ValidateRoles,
  routePrefix: '/api',
  controllers: [HelpController, ProjectController, AuthController, /* ... */],
})
```

`app.ts` also configures `trust proxy` (behind nginx in prod / vite dev proxy), Sentry (non-local), `bodyParser.json`, and swagger UI at `/swagger`.

### Decorators

| Decorator | Usage |
|-----------|-------|
| `@JsonController('/path')` | all controllers |
| `@Get`, `@Post`, `@Put`, `@Delete` | route methods |
| `@HttpCode(200\|201)` | explicit status |
| `@Authorized([EUserRole.ROLE_USER])` | class or method level |
| `@Body({ validate: { groups }, transform: { groups } })` | validation groups |
| `@CurrentUser()` | custom — JWT user resolution |
| `@EntityFromParam({ paramName: 'id' })` | custom — load entity from route param |
| `@Req()`, `@Res()`, `@Param('name')` | request params |
| `@OpenAPIExtended({ ... })` | preferred OpenAPI composition |
| `@OpenAPI({ ... })` | raw OpenAPI (auth-time-tracker, help) |

### Preferred OpenAPI pattern

```typescript
@OpenAPIExtended({
  summary: 'Search projects accessible to the current user',
  searchRequestBody: {
    example: { filter: { state: 'DRAFT' }, sort: { createdAt: 'DESC' }, page: 0 },
  },
  response: {
    schema: Project,
    options: { isPagination: true, serializationGroup: 'search' },
  },
})
@Post('/search')
@HttpCode(200)
public search(@CurrentUser() user: User, @Body() search: ProjectSearchDto) {}
```

Supports `body`, `response`, `searchRequestBody`, `optionalAuthorizationHeader`, and auto-404 from `@EntityFromParam`.

### Auth flow

`ValidateRoles` reads the `Authorization` header → `Authenticator.getUserFromJwtTokenOrThrowException` → checks roles against `@Authorized([...])`.

## Config / parameters

### `IConfigParameters` (`model/config.ts`)

```typescript
export interface IConfigParameters {
  host: string
  port: number
  sentry: string
  redis: string
  jwtSecret: string
  tonAllowedDomains: string[]
  database: { type; host; port; username; password; database }
}
```

### `AppConfig` (`app/app-config.ts`)

- Loads `.env` (or `.env.test` when `NODE_ENV=test`)
- `getEnv()`, `isTest()`, `isProduction()`
- `readConfig()` maps env vars (`APP_HOST`, `APP_PORT`, `APP_DB_*`, `APP_REDIS`, …)

Injected as `@inject('parameters')` or `App.container.get('parameters')`.

## Testing

**Location:** `api/src/test/` (inside `src`).

**Naming:** `*.test.ts`; DB integration `*.integration.test.ts`.

**Stack:** Mocha runner, Chai assertions, `@testdeck/mocha` (`@suite()`, `@test()`, `@timeout()`), nyc coverage, nock (HTTP mocking), node-mocks-http (middleware), `@app/api-client` generated client for controller tests.

**Base classes:**
- `BaseControllerTest` — boots real `App` on a random port, exposes fixtures + `apiClient()`
- `AbstractDatabaseIntegration` — DB connection + container for repository tests

Fixtures (`UserFixture`, etc.) are `@injectable()` and bound in `AppContainer`.

Run: `pnpm --filter ./api test` (`NODE_ENV=test nyc mocha -r tsconfig-paths/register -r ts-node/register ./src/test/**/*.test.ts`).

## Adding an endpoint (checklist)

1. Entity in `entity/` with `@Expose({ groups })` + class-validator.
2. `I*`/`E*` types in `model/`; `*Dto` in `model/dto/` for request bodies.
3. Repository methods in `repository/*-repository.ts`.
4. Business logic in `service/*-manager.ts` (`@injectable` + `@inject`).
5. Bind new service/repo in `app/app-container.ts`.
6. Controller method with `@JsonController`, `@Authorized`, `@OpenAPIExtended`, `@Body`/`@CurrentUser`/`@EntityFromParam`.
7. Register new controllers in `app/app.ts` `controllers` array.
8. Test extending `BaseControllerTest` in `test/controller/`.

## Do not

- Write domain/utility logic as standalone module functions — put it in a class (static utility or injectable service)
- Put business logic in controllers — controllers do HTTP only, delegate to a `*Manager`
- Add TypeORM decorators to `model/` types — DB models live in `entity/`
- Use `@inject` in controllers — controllers resolve via `App.container.get`
- Add a service/repository without binding it in `app/app-container.ts`
- Bypass `validateAndSave` for persistence that needs validation

## Reference implementations

| Pattern | Location |
|---------|----------|
| Controller (search + CRUD) | `controller/project-controller.ts` |
| Injectable manager | `service/project-manager.ts` |
| Repository template usage | `repository/project-repository.ts` |
| Repository base | `repository/abstract-repository-template.ts` |
| Static utility class | `service/helper.ts`, `service/calc.ts`, `service/date-helper.ts` |
| Entity with groups | `entity/project.ts` |
| Entity base | `entity/abstract-base-entity.ts` |
| Custom exception | `exception/access-exception.ts` |
| Error middleware | `middleware/error-handler.ts` |
| Auth checker | `middleware/validate-roles.ts` |
| Custom param decorator | `decorator/current-user.ts`, `decorator/entity-from-param.ts` |
| Container bindings | `app/app-container.ts` |
| Express bootstrap | `app/app.ts` |
| Config | `app/app-config.ts`, `model/config.ts` |
| Controller test base | `test/controller/base-controller.test.ts` |

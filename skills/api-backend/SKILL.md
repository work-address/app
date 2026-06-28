---
name: api-backend
description: >-
  Guides work in the api package (Node/Express backend) built on
  routing-controllers, Inversify DI, and TypeORM. Use when editing api/src,
  adding endpoints, controllers, services/managers, repositories, entities,
  models, DTOs, middleware, decorators, or exceptions, or when the user mentions
  the API, backend, inversify, routing-controllers, or TypeORM.
---

# API Package & Backend Conventions

## Quick start

1. **Locate code** under `api/src/` (`@` → `api/src`).
2. **Follow the layers:** controller → service (`*Manager`) → repository → entity. Controllers do HTTP only; business logic lives in `*Manager` services.
3. **There should be no helper methods without classes** — every function lives inside a class as a method (often `static` for stateless utilities). See how classes are organized below. Standalone module functions are reserved for the few documented exceptions.
4. **Wire dependencies** in `app/app-container.ts`; services/repositories use `@injectable()` + `@inject('Token')`, controllers use `App.container.get('Token')`.
5. **Register endpoints** with routing-controllers decorators (`@JsonController`, `@Get/@Post`, `@Authorized`, `@OpenAPIExtended`).

For full conventions, code patterns, and file-level reference, see [REFERENCE.md](REFERENCE.md).

## Package

| Item | Path |
|------|------|
| Backend | `api/` |
| Source | `api/src/` |
| Path alias | `@` → `api/src` |
| Entry | `api/src/server.ts` → `createApp` → bootstrap → start |

Dev: `cd api && pnpm dev` (port 4000). Tests: `pnpm --filter ./api test`.

## Layers

```
api/src/
├── app/           # Express + routing-controllers bootstrap, Inversify container, config
├── connector/     # Infra bootstrapping outside DI (TypeORM Connection)
├── controller/    # HTTP routing only; delegate to managers/repositories
├── service/       # Business logic (*Manager), infra (Http, Mailer, RedisClient), auth/
├── repository/    # TypeORM data access; extend AbstractRepositoryTemplate<T>
├── entity/        # TypeORM DB models + validation + serialization groups
├── model/         # Pure TS types: I* interfaces, E* enums; dto/ for *Dto request bodies
├── middleware/    # error-handler, validate-roles
├── decorator/     # Custom param decorators (@CurrentUser, @EntityFromParam) + openapi/
├── exception/     # Custom HTTP errors (default-exported classes)
└── test/          # *.test.ts (Mocha/Chai/@testdeck), co-located under src/
```

## Core rule: no helper methods without classes

Domain and utility logic must be a **method on a class**, not a loose module function.

```typescript
// Good — static utility class
export class Helper {
  public static toFixedDecimals(value: number, numberDecimals: number) {
    return Number(value.toFixed(numberDecimals))
  }
}

// Good — injectable service
@injectable()
export class ProjectManager {
  @inject('ProjectRepository')
  protected projectRepository: ProjectRepository
}
```

```typescript
// Avoid — standalone domain helper at module scope
export function toFixedDecimals(value: number, n: number) { /* ... */ }
```

**Allowed exceptions** (framework plumbing only): app bootstrap (`createApp`), the `ValidateRoles` `authorizationChecker` callback, decorator factories under `decorator/`, low-level crypto/OpenAPI plumbing, test fixtures, and type-only exports. Everything else goes in a class.

## Class organization by layer

| Layer | Class shape | DI |
|-------|-------------|-----|
| Controller | `@JsonController('/x')`, methods with route decorators | `App.container.get('Token')` in constructor |
| Service / Manager | `@injectable()` class | `@inject('Token')` on `protected` props |
| Repository | `extends AbstractRepositoryTemplate<T>`, `protected target = Entity` | `@inject('Filter')`, etc. |
| Entity | `@Entity()` `extends AbstractBaseEntity implements I*` | n/a |
| Exception | default-exported class, `extends` routing-controllers error | n/a |
| Utility | `class` with `static` methods | n/a |

## Naming

| Artifact | Convention | Example |
|----------|------------|---------|
| Files | kebab-case | `project-controller.ts` |
| Classes | PascalCase | `ProjectController` |
| Enums | `E` prefix | `EUserRole` |
| Interfaces | `I` prefix | `IProject` |
| DTOs | `*Dto` suffix | `ProjectSearchDto` |
| Services | `*Manager` (domain) | `InvoiceManager` |
| Repositories | `*Repository` | `TimeRepository` |
| DI tokens | PascalCase class name | `'ProjectManager'` |

## Adding an endpoint

1. Entity in `entity/` with `@Expose({ groups })` + validators.
2. `I*` / `E*` types in `model/`; `*Dto` in `model/dto/` for request bodies.
3. Repository methods in `repository/*-repository.ts`.
4. Business logic in `service/*-manager.ts` (`@injectable` + `@inject`).
5. Bind any new service/repo in `app/app-container.ts`.
6. Controller method with `@JsonController`, `@Authorized`, `@OpenAPIExtended`, `@Body`/`@CurrentUser`/`@EntityFromParam`.
7. Register new controllers in `app/app.ts` `controllers` array.
8. Test in `test/controller/` extending `BaseControllerTest`.

## Do not

- Write domain/utility logic as standalone module functions — put it in a class
- Put business logic in controllers — delegate to a `*Manager`
- Add TypeORM decorators to `model/` types — entities live in `entity/`
- Inject into controllers with `@inject` — use `App.container.get` (services/repos use `@inject`)
- Use raw IP/socket access without normalizing through the owning service
- Add a new service/repository without binding it in `app/app-container.ts`

## Reference implementations

| Pattern | Location |
|---------|----------|
| Controller (search + CRUD) | `controller/project-controller.ts` |
| Injectable manager | `service/project-manager.ts` |
| Repository template usage | `repository/project-repository.ts` |
| Static utility class | `service/helper.ts`, `service/calc.ts` |
| Entity with groups | `entity/project.ts` |
| Custom exception | `exception/access-exception.ts` |
| Container bindings | `app/app-container.ts` |
| Express bootstrap | `app/app.ts` |
| Controller test base | `test/controller/base-controller.test.ts` |

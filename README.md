# Inventory reservation and order management

Full-stack take-home assignment using React, NestJS, TypeScript, and PostgreSQL.

**Current delivery: Phases 1–9.** Runnable React/NestJS apps, PostgreSQL schema/migration/seed, bearer authentication, products, atomic stock reservation, customer order creation/list/detail/cancellation, and simulated payment callbacks with durable event deduplication. The frontend uses React Query, React Hook Form/Zod, and shared Tailwind/daisyUI components. PostgreSQL races are verified across independent NestJS instances. Operations can inspect all customers' orders through a read-only list/detail workspace. Required workflows, automated verification, Postman artifacts, engineering notes, and source packaging are complete. Clean-archive results and remaining limitations are recorded in docs/SUBMISSION.md. Optional deployment is not included.

## Prerequisites

- Node.js 22.19 or a later Node 22 release; npm 10 or later.
- PostgreSQL 16 binaries (`initdb`, `pg_ctl`, `psql`), available on PATH or through `PG_BIN_PATH` in `.env`.
- No paid accounts or hosted services. Docker is not required.

Verified toolchain: Node 22.19.0, npm 10.9.3, PostgreSQL 16.1; lockfile resolves NestJS 11.2.7, React 19.3.0, Vite 8.3.3, Prisma 6.19.3, Tailwind 4.3.3, daisyUI 5.7.47, React Query 5.104.1, React Hook Form 7.89.0, and Zod 4.6.5. TypeScript is 5.9.3 for the API and 6.0.2 for the web app. Use the committed lockfile through npm ci.

Development ports: frontend **5173**, API **4000**, isolated PostgreSQL **5433**. An existing PostgreSQL service on 5432 is left untouched.

## Install and start

Run in the repository root:

```sh
npm ci --include=optional
npm run setup:env
npm run db:init
npm run db:reset
npm run dev
```

`setup:env` creates an ignored root `.env` with random local database/JWT secrets. It preserves an existing file. `.env.example` documents the variables; do not copy its password placeholders directly into a working database connection.

`db:init` uses PostgreSQL's native commands to initialize an isolated password-protected cluster in ignored `.local/postgres`, bound to 127.0.0.1:5433. It creates separate `inventory_development` and `inventory_test` databases and checks both connections. Repeating it preserves existing databases/data. It does not migrate, reset, or seed domain data.

On Windows, the helper also detects `C:/Program Files/PostgreSQL/16/bin`. For another installation, set `PG_BIN_PATH` to its binary directory. On Linux, run as an ordinary user with PostgreSQL binaries installed; `initdb` cannot run as root.

Open [the frontend](http://localhost:5173) and sign in using a demo account below. The product table shows exact LKR prices and available stock. Customers can select Reserve, enter quantity, create a PENDING order, and inspect snapshots/history under My orders with filtering and pagination. Pending details offer cancellation, which returns stock exactly once. Payment changes appear through Refresh order or Refresh orders. Operations can browse products and inspect every customer's orders under Operations orders, with status filtering, pagination, customer IDs, and full history. Lists/details share components across roles, preserve filters/page on return, and move keyboard focus to the new view. The foundation endpoint [GET /api](http://localhost:4000/api) returns `{"status":"ok","database":"connected"}` after a real database query.

Press Ctrl+C to stop both app development servers. PostgreSQL runs separately:

```sh
npm run db:check
npm run db:stop
npm run db:start
```

`db:stop` stops only the isolated cluster. It does not remove data. `db:start` requires an initialized cluster. If a crash leaves a stale PID file, investigate the cluster state rather than deleting data or initializing a replacement blindly.

### Existing PostgreSQL instead of the isolated cluster

Create separate local `inventory_development` and `inventory_test` databases and an appropriate local user using your normal PostgreSQL tools. Set `DATABASE_URL` and `TEST_DATABASE_URL` in `.env`, then run `npm run db:check` and `npm run db:reset`. Do not run the cluster management commands for a server managed elsewhere. The application only requires PostgreSQL connection URLs, not the cluster helper.

## Migrations and demo data

```sh
npm run db:migrate
npm run db:seed
npm run db:reset
```

`db:migrate` applies checked-in migrations without resetting data. `db:seed` adds missing demo accounts/products and preserves existing inventory and orders. **`db:reset` deletes all assignment data in the development database**, then restores exactly three users and five products in one transaction. These helpers restrict targets to the named local databases and never print database passwords. Stop the apps before regenerating the Prisma client on Windows; running API/test processes can lock its engine DLL.

All three demo accounts use password **`DemoPass123!`**, stored as bcrypt hashes: `alice@example.test` (CUSTOMER), `bob@example.test` (CUSTOMER), and `ops@example.test` (OPERATIONS). Login is available at `POST /api/auth/login`.

| Product | Unit price minor (LKR) | Stock |
| --- | ---: | ---: |
| Mechanical Keyboard | 1500000 | 20 |
| USB C Hub | 800000 | 20 |
| Laptop Stand | 600000 | 20 |
| Wireless Mouse | 450000 | 20 |
| Limited Edition Headphones | 2500000 | 1 |

There are no orders, retry records, transition entries, or payment events after reset. One LKR equals 100 minor units. [Database notes](docs/DATABASE.md) explain constraints, transaction boundaries, and database correctness decisions.

## Configuration

| Variable | Purpose |
| --- | --- |
| PORT | API port; default 4000 |
| FRONTEND_ORIGIN | Single browser origin allowed by CORS; default local setup is http://localhost:5173 |
| VITE_API_BASE_URL | Browser API URL; default http://localhost:4000/api |
| DATABASE_URL | Development PostgreSQL connection |
| TEST_DATABASE_URL | Separate PostgreSQL database for API integration tests |
| JWT_SECRET | Private bearer-token signing secret |
| WEBHOOK_SECRET | Private configured payment webhook secret; local demo value is local-demo-webhook-secret |
| PG_BIN_PATH | Optional native PostgreSQL binary directory for local cluster helpers |

NestJS loads the root `.env` and validates configuration at startup. Vite loads that same file but exposes only variables beginning with `VITE_` to browser code. Never prefix database, JWT, or webhook secrets with `VITE_`. Restart app servers after configuration changes; Vite's API URL is embedded during production builds.

## Build, verify, and production-mode smoke run

```sh
npm run build
npm run lint
npm test
npm run test:web
npm run test:api:e2e
```

Unit checks validate startup configuration and exact integer serialization. `test:api:e2e` first migrates and **resets the separate local test database**, then verifies authentication/products/roles, the foundation API, exact seed, repeat seed/reset behavior, READ COMMITTED isolation, and direct-SQL constraint violations. Test fixtures roll back, restore, or reset their changes. The command rejects development/test database name reuse. The order suite also checks exact contracts, ownership, snapshots, overflow, rollback, and controlled reservations across two independent NestJS instances. It observes waiting PostgreSQL locks before releasing its test-only barrier. Transition tests also cover webhook authorization/validation, APPLIED/IGNORED/DUPLICATE/conflict behavior, cancellation access, rollback, both cancellation/payment race outcomes, duplicate callbacks, concurrent product releases, and restart persistence. Operations tests additionally verify all-customer visibility, read-only state, strict list contracts, and cross-role access. Run builds/client generation before integration tests on Windows to avoid engine DLL locks.

`test:web` runs frontend validation/API/query/component tests using Vitest, including React Hook Form integration, invalid quantities, API errors, cancellation/retries, and DOM login/logout/account-switch/session-expiry checks. Order flow checks cover creation/history/filtering/pagination, a lost response and reload retry with unchanged key/input, and corrected input after definitive stock errors. Cancellation tests cover success, stale 409 state refresh, an uncertain committed response, and session expiry. Operations tests cover shared list/detail behavior, filter/page preservation, read-only actions, recoverable errors, and role/account cache isolation.

## Frontend state and forms

Tailwind CSS 4 and daisyUI 5 handle styling through the Vite plugin and a single emerald theme in `src/index.css`. The old `App.css` was removed. Use shared components for consistent styling and accessibility across both role workflows.

| Layer | Responsibility |
| --- | --- |
| App | Composes the application shell and current page |
| pages | Page composition and page headings |
| features | Query/form state and domain-specific feedback/actions |
| components/layout | Application shell, skip link, header/footer, page header |
| components/ui | Button, Loading, Feedback, EmptyState, FormField, typed DataTable |
| api and validation | Requests/query state and centralized schemas/resolvers |

DataTable renders explicit typed columns, accessible caption/headers, a keyboard-focusable horizontal scroll region, and separate loading/error/empty states. Customer order features supply server pagination/filtering with shared Pagination and StatusBadge components. FormField links labels, hints, and errors while preserving input registration; actual React Hook Form wiring remains in feature components. No component showcase or additional application screen was added.

React Query manages API server state through a single QueryClient/provider and typed query hooks. Product reads support loading/error/empty states and manual refresh, pass cancellation signals to fetch, retry transient failures at most once, and skip client-error retries. Automatic mutation retries are disabled. Redux/RTK Query is unnecessary for this assignment's current state needs.

`apps/web/src/validation/forms.ts` centralizes login/order Zod schemas, inferred input types, and React Hook Form options with Zod resolvers. Login uses `useForm(loginFormOptions)` with shared FormField/Button/Feedback components; the order form uses `useForm(createOrderFormOptions)` with `valueAsNumber` for quantity. API response validation lives in `validation/api.ts`. Browser validation does not replace NestJS DTOs or database checks.

AuthProvider keeps the token/session in React memory, so reloading the page requires signing in again. No token is stored in localStorage or cookies. Sign-in/logout clears cached queries/mutations; product queries include the current user ID. Unauthorized product reads return to login. The login mutation does not retry or retain inactive credential inputs. Logout ends the browser session; a previously issued token remains valid until its one-hour expiry because server-side revocation/refresh is outside assignment scope. Successful reservation mutations invalidate product/order queries. Before sending an order, the frontend saves only its customer-scoped key and canonical product/quantity in sessionStorage. Uncertain results keep that input read-only for explicit same-key retry, including after reload and re-login. No bearer token or password is stored there. Success clears the intent; definitive 400/404/409 rejections permit corrected input with a new key. Closing the browser tab removes sessionStorage, so recover unresolved orders through My orders. Cancellation mutations refresh product/order queries, do not retry automatically, and discover current order state after 409 or uncertain failures. Terminal orders hide the cancellation action. The payment secret remains API-only and callbacks are demonstrated through Postman/API clients.

NestJS signs HS256 tokens using the configured private JWT secret, with fixed issuer/audience and one-hour expiry. Guards verify those values and load the user's current identity/role from PostgreSQL. Client-supplied role claims cannot grant access. [Implemented API contracts](docs/API.md) cover all nine assigned routes and error responses.

After a build, start the API and frontend preview in separate terminals:

```sh
npm run start:api
```

```sh
npm run preview:web
```

The preview is a local verification server, not a cloud deployment. It uses port 5173 so the configured CORS origin remains consistent.

Current Phase 7 verification: **131 PostgreSQL/API tests, 48 frontend tests, and 13 unit tests passed**, along with both builds/lints. [Verification guide](docs/VERIFICATION.md) maps the required scenarios to executable tests and explains database contention proof and evidence limits.

## Postman collection

Import [the collection](postman/inventory.postman_collection.json) and [placeholder environment](postman/local.postman_environment.json). Follow [the Postman guide](postman/README.md) to enter local demo credentials/webhook secret and run all nine folders in order from fresh seed. Tokens and IDs are captured automatically. All 91 requests and 182 assertions passed, and each request has a real sanitized response example.

The isolated compatible runner preserves development orders, resets only inventory_test, starts/stops a temporary built API, and verifies persisted stock/history/events:

```sh
npm run postman:validate
npm run postman:test
```

Build first with API processes stopped on Windows. Do not run the Postman runner and API integration tests simultaneously, because they share test fixtures. Capture updates are available through `npm run postman:capture`; the default test run preserves exported artifacts.

## Structure and generators

- `apps/api`: NestJS CLI-generated application, `main.ts`, root `AppModule`, and generated feature modules. Injectable `PrismaService` connects/disconnects through NestJS lifecycle hooks.
- `apps/web`: create-vite-generated React + TypeScript application with Tailwind/daisyUI styling, shared UI/layout components, and a separated connection-status feature/page.
- `tools`: environment and native local PostgreSQL setup helpers.
- `docs/WORK_LOG.md`: actual work, verification evidence, limitations, and AI usage.
- `IMPLEMENTATION_PLAN.md`: phased scope and acceptance gates.

The initial apps were generated with:

```sh
npx --yes @nestjs/cli@11.0.16 new api --directory apps/api --package-manager npm --skip-install --skip-git --strict
npm create vite@9.2.1 apps/web -- --template react-ts --no-interactive
```

Feature modules and the Prisma service were generated using `nest generate module` and `nest generate service`. Framework starter files were generated by the CLIs, then adapted for this workspace. Prisma is pinned to the compatible 6.19.3 line; its CLI generates the database client during installation/build. The initial migration was generated with `prisma migrate dev --name initial_inventory --create-only`, extended with SQL checks, then applied using `prisma migrate deploy`.

Prisma's schema/configuration were initialized using `prisma init --datasource-provider postgresql --generator-provider prisma-client-js`, then adjusted to use the root environment and default client package. NestJS configuration is pinned to 4.0.2 for compatibility with the generated Jest setup on Node 22.

## Submission and walkthrough

See [submission evidence and limitations](docs/SUBMISSION.md), [engineering decisions](docs/ENGINEERING.md), and [the 45-minute walkthrough](docs/WALKTHROUGH.md). Measured implementation time and AI assistance are recorded in [the work log](docs/WORK_LOG.md); earlier planning time was not measured. Do not claim a guaranteed score or production readiness.

The source ZIP contains apps, migrations/seed, tests, local setup tools, configuration examples, docs, the lockfile, and sanitized Postman exports. It excludes dependencies, builds, private environment files, database data, and runtime tokens. To rebuild/verify it on Windows with PowerShell 7:

```sh
npm run package:source
npm run package:verify
```

Generated output is `.local/submission/inventory-assignment-source.zip` with a SHA-256 file manifest alongside it. Extract into a fresh folder, then follow Install and start above. The source repository is [PrabathMadushan/inventory-reservation-assignment](https://github.com/PrabathMadushan/inventory-reservation-assignment) (private). The ZIP remains available for submission without GitHub access.

## Optional deployment

Required Phases 1–9 are complete. Optional deployment remains unimplemented and needs separate provider/configuration decisions; the local submission does not depend on it. See docs/SUBMISSION.md for verification evidence and limitations.

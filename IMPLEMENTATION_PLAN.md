# Inventory Reservation and Order Management - Implementation Plan

Status: Required Phases 1–9 complete and locally verified. Source ZIP prepared. Optional deployment is documented from the 9 October 2026 hosted checks. Known limitations and unmeasured planning time remain disclosed.

Current status, 10 October 2026: the signed-in session is React state plus `sessionStorage` key `inventory.session`. Latest measured checks: lint passed, build passed, 14 API unit tests, 53 frontend tests, 131 PostgreSQL/API tests, and Postman 91 requests / 182 assertions. Older phase paragraphs below keep the counts from those phases.

Pre-Phase 3 UI foundation revision: complete and verified. Tailwind CSS/daisyUI and shared component separation are ready for Phase 3.

Source: `C:\Users\praba\Downloads\SSE Assignment Full Stack.pdf`, all four pages.

Purpose: implement only the assigned application, maximize coverage of the assessment criteria, and work through reviewable phases one at a time. This plan does not guarantee a particular grade.

The workspace was empty when inspected. The supplied workspace instruction references `RTK.md`, but that file was not found in the workspace or its parent directories. Recheck if it is supplied before implementation.

## 1. Scope and assessment priorities

### Required scope

- React, NestJS, TypeScript, and PostgreSQL.
- Seeded customer and operations login using bearer tokens.
- Product browsing and single-product order creation with stock reservation.
- Customer order list, details, and pending-order cancellation.
- Operations order list, filtering, pagination, and inspection.
- Simulated, secret-protected payment webhook.
- Durable idempotency, event deduplication, transition history, and correct concurrent stock handling.
- Responsive, keyboard-accessible frontend with loading, empty, validation, error, and success states.
- Required automated tests, including real PostgreSQL concurrency tests.
- API documentation, runnable Postman collection and environment, reproducible setup, and engineering/submission notes.

### Explicit exclusions

Do not implement real payments, registration, password recovery, automatic reservation expiry, or microservices. Also exclude shopping carts, multiple products per order, product administration, stock replenishment screens, refunds, notifications, analytics, and other unrequested features.

Manual refresh is sufficient for payment updates. Do not add WebSockets or background reservation jobs. Discuss production expiry only in the engineering note.

### Marks-to-evidence map

| Area | Weight | Evidence to deliver | Primary phases |
| --- | ---: | --- | --- |
| Data correctness and concurrency | 35% | Transactional stock, durable keys/events, correct terminal states, PostgreSQL race assertions | 2, 4, 5, 7 |
| API design, validation, security | 20% | Exact routes/models/errors, hashed passwords, bearer authentication, role and ownership enforcement, webhook secret | 3-5, 7-8 |
| Frontend behavior and usability | 15% | Complete customer/operations flows, state feedback, keyboard access, responsive layout | 4, 6-7 |
| Meaningful automated tests | 15% | Real-database concurrency tests, API access tests, main frontend flow and failure test | 4-7 |
| Architecture and operational reasoning | 10% | Small modular monolith, explained transactions/locks/indexes, restart evidence, tradeoffs | 2, 5, 9 |
| Documentation and reproducibility | 5% | Exact setup commands, migrations/reset/seed, API docs, runnable sanitized Postman exports, time/AI notes | 1, 8-9 |
| Optional cloud deployment | Up to 5 bonus | Hosted flows, persistent PostgreSQL, HTTPS/configuration, access/deployment documentation | 10 |

Maximum stated score: 100 required marks + 5 optional marks = 105. Docker and CI do not independently earn bonus marks.

## 2. Time budget and execution rules

The assignment allows 8-12 working hours and requires stopping at 12 hours. Count planning, implementation, debugging, verification, documentation, and deployment effort in the actual work log; do not substitute estimates for actual time. Subtract time already spent from the remaining allocation.

| Phase | Target allowance | Cumulative target |
| --- | ---: | ---: |
| 1. Foundation and runnable setup | 40 min | 0h 40m |
| 2. Database, migrations, reset, seed | 45 min | 1h 25m |
| 3. Authentication and API contract foundation | 45 min | 2h 10m |
| 4. First vertical slice: safe reservation to customer UI | 95 min | 3h 45m |
| 5. Payments, cancellation, state history | 85 min | 5h 10m |
| 6. Complete frontend and operations workflow | 80 min | 6h 30m |
| 7. Complete automated verification | 95 min | 8h 05m |
| 8. Postman collection and real response examples | 65 min | 9h 10m |
| 9. Documentation, clean setup, walkthrough preparation | 50 min | 10h 00m |
| Shared planning/debugging buffer | 60 min | 11h 00m |
| 10. Optional deployment, only if required gates pass | At most remaining 60 min | 12h 00m |

These are provisional allocations, not promised completion times. If a phase overruns, use the buffer and reduce optional deployment effort first. Preserve required tests and submission artifacts. At 12 hours, stop and document every incomplete item honestly.

For each phase:

1. Record actual start/end and active working time.
2. Implement only the listed deliverables and necessary supporting code.
3. Run the phase acceptance checks before moving on.
4. Record results and any unresolved limitation in this file or the work log.
5. Keep each completed phase reviewable; commit it if a repository has been initialized.

## 3. Proposed implementation choices

These are implementation decisions permitted by the assignment, not additional requirements.

- **Structure:** npm workspace with `apps/api` and `apps/web`; one backend application and one PostgreSQL database.
- **Backend:** A standard NestJS application with `main.ts`, `AppModule`, feature modules, controllers, injectable services, DTO classes, guards, and exception filters. NestJS dependency injection wires these together. Shared order services coordinate database transactions.
- **Database access:** Prisma through an injectable `PrismaService` for schema, migrations, and ordinary queries; parameterized SQL for conditional updates, unique-key claims, and row locks inside the same interactive transaction.
- **Concurrency authority:** PostgreSQL transactions at READ COMMITTED, conditional stock/state updates, row locks, and unique constraints. No JavaScript mutex, in-memory key/event map, or application-instance lock is used for correctness. Multiple NestJS processes share the same database protection.
- **Frontend:** React with Vite, React Router, native semantic controls, and a small responsive stylesheet. Use a shared typed API client; keep forms and state management simple.
- **Authentication:** hashed seeded passwords using bcrypt; signed JWT access tokens; verified server-side identity and role. Resolve the user from the database after token verification. No refresh-token system is required.
- **Testing:** Jest/Supertest for API integration tests against a dedicated PostgreSQL test database; Playwright for the main frontend flow and an API failure state.
- **API documentation:** checked-in `docs/API.md`, plus the required Postman collection. A separate documentation UI is unnecessary.
- **Local operation:** local PostgreSQL with exact setup instructions. Add a database-only Docker Compose convenience only if it saves setup effort; it is not a scoring feature or a required dependency for the app's logic.
- **Configuration:** API defaults to `http://localhost:4000/api`; frontend reads a configurable API base URL. Database URL, JWT secret, webhook secret, and frontend origin are configuration values.
- **Dependency versions:** choose compatible stable versions during setup and commit the lockfile. Do not spend the budget upgrading tooling unnecessarily.

Planned layout: `apps/api` is the NestJS project root inside an npm workspace. Its location does not change the framework. The explicit files below follow NestJS feature-module conventions; `apps/web` is a separate React application.

```text
apps/
  api/
    nest-cli.json
    package.json
    tsconfig.json
    tsconfig.build.json
    prisma/
      schema.prisma
      migrations/            # Including SQL checks and unique constraints
      seed.ts
    src/
      main.ts                # NestFactory bootstrap, /api, validation, CORS
      app.module.ts          # Root module imports all feature modules
      prisma/
        prisma.module.ts
        prisma.service.ts    # Injectable DB client and lifecycle management
      auth/
        auth.module.ts
        auth.controller.ts
        auth.service.ts
        dto/login.dto.ts
        guards/jwt-auth.guard.ts
        guards/roles.guard.ts
        decorators/current-user.decorator.ts
        decorators/roles.decorator.ts
      products/
        products.module.ts
        products.controller.ts
        products.service.ts
      orders/
        orders.module.ts
        orders.controller.ts
        orders.service.ts    # Create/list/detail/cancel transaction orchestration
        order-transitions.service.ts
        dto/create-order.dto.ts
        dto/list-orders-query.dto.ts
      operations/
        operations.module.ts
        operations.controller.ts
      webhooks/
        webhooks.module.ts
        payments-webhook.controller.ts
        payments-webhook.service.ts
        dto/payment-event.dto.ts
        guards/webhook-secret.guard.ts
      common/
        filters/api-exception.filter.ts
        config/environment.ts
    test/
      auth.e2e-spec.ts
      orders.e2e-spec.ts
      concurrency.e2e-spec.ts
      payments.e2e-spec.ts
      helpers/               # Dedicated PostgreSQL fixtures and app instances
  web/
    src/
      api/
      validation/            # Central Zod schemas and React Hook Form resolvers
      components/
        layout/              # Shared application shell and page headers
        ui/                  # Buttons, feedback/loading, empty states, form fields, tables
      features/
        connection/          # Query-connected connection card
      pages/
    tests/                   # Browser flow tests
docs/
  API.md
  ENGINEERING.md
  WORK_LOG.md
postman/
  InventoryReservation.postman_collection.json
  Local.postman_environment.json
.env.example
README.md
IMPLEMENTATION_PLAN.md
package.json
package-lock.json
```

### NestJS responsibilities and dependency wiring

- `main.ts` bootstraps `AppModule` with `NestFactory`, sets the global prefix and `ValidationPipe`, installs the API exception filter, configures CORS, and starts the configured port.
- `AppModule` imports configuration and the Prisma, Auth, Products, Orders, Operations, and Webhooks modules.
- `PrismaModule` exports one injectable `PrismaService` per application instance. Its client opens real PostgreSQL connections; it holds no authoritative inventory or deduplication state in memory.
- Feature modules register their controllers and `@Injectable()` providers explicitly. Auth exports its authentication/role guards as needed; Orders exports order read/transition services to Operations and Webhooks. Avoid circular module imports.
- Controllers declare the exact HTTP routes with NestJS decorators, apply guards, accept validated DTOs, and map success statuses. They contain no inventory mutation logic.
- Services receive dependencies through constructors. Transaction services pass the transaction-scoped Prisma client to every participating database operation; never use the root client for a write inside that transaction.
- `OrderTransitionsService` performs the guarded database state update and associated stock/history writes for both cancellation and payment. Sharing it prevents divergent implementations.
- `OperationsController` reuses exported order read services with operations scope. A separate operations service is unnecessary unless it contains actual behavior.
- DTOs use validation decorators. Guards enforce bearer identity/roles and webhook secrets. The exception filter translates validation and domain errors into the contracted error shape.

This is a NestJS modular monolith. No standalone Express routing layer, extra backend, queue, or distributed cache is planned. The module/provider arrangement follows the [official NestJS module conventions](https://docs.nestjs.com/modules).

### Frontend state and validation choices

- Use TanStack React Query for server state, typed query hooks, loading/error states, and cache invalidation. Redux and RTK Query are unnecessary for the current assignment; keep small UI/session state in React.
- Use React Hook Form with `@hookform/resolvers/zod` for assignment forms. Keep reusable Zod schemas and inferred types centrally in `apps/web/src/validation`; avoid inline or duplicated form validation.
- Phase 2 adds these foundations and converts the existing connection check to React Query. It prepares login/order schemas and resolvers without adding login/order screens or APIs ahead of their scheduled phases.
- Phase 3 implements login with its centralized resolver, authentication-aware API requests/cache cleanup, and a shared product table. Phase 4 adds order quantity input with its resolver and query invalidation following successful reservations. Phases 5–6 extend the same query/form approach for the required workflows.
- Disable automatic mutation retries. Preserve the logical order input/idempotency key for explicit retries after uncertain responses. Prevent retries of client/auth errors; keep cancellation signals wired to requests. Clear user-scoped cached data on logout/account change.
- Browser validation improves feedback; NestJS validation and PostgreSQL constraints remain authoritative. Frontend Zod schemas do not replace backend DTO validation or database concurrency control.
- Style the frontend with Tailwind CSS and daisyUI through the Vite plugin. Shared layout/UI components own consistent styling, semantics, and accessibility; pages compose features; feature components bind query/form state. Keep API and validation logic outside visual primitives.
- Reuse shared loading/feedback, buttons, empty states, form fields, and responsive semantic tables in later assignment screens. Keep table columns typed and rendering explicit; do not add an unrequested table framework, client-side business rules, or showcase screens.

Integration references: [React Query provider/query pattern](https://tanstack.com/query/latest/docs/framework/react/quick-start), [React Hook Form Zod resolver](https://github.com/react-hook-form/resolvers#zod), and [Zod strict objects and safe integers](https://zod.dev/api).

Styling references: [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite) and [daisyUI Vite setup](https://daisyui.com/docs/install/vite/). Use the configured emerald theme and shared components consistently; add shared components when a real repeated assignment flow needs them.

## 4. Exact contract checklist

### Routes

All routes below are relative to `/api`. Use JSON; do not rename routes or wrap contracted responses in an incompatible envelope.

| Method | Route | Access and input | Success response |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public; email, password | 200 Login |
| GET | `/products` | Any authenticated user | 200 `{items: Product[]}` |
| POST | `/orders` | CUSTOMER; productId, quantity; required `Idempotency-Key` | 201 Order; identical retry 200 Order |
| GET | `/orders` | CUSTOMER; optional page, pageSize, status | 200 Page<Order>, own orders only |
| GET | `/orders/:id` | Owning CUSTOMER | 200 Order |
| POST | `/orders/:id/cancel` | Owning CUSTOMER; empty body | 200 Order |
| GET | `/operations/orders` | OPERATIONS; optional page, pageSize, status | 200 Page<Order> |
| GET | `/operations/orders/:id` | OPERATIONS | 200 Order |
| POST | `/webhooks/payments` | Configured `X-Webhook-Secret`; PaymentEvent | 200 PaymentResult |

Pagination: default `page=1`, `pageSize=10`; positive integers only; maximum pageSize 100. Optional status must be an uppercase valid order status. Order by `createdAt DESC, id DESC` as the chosen stable tie-break direction. Count `total` using exactly the active customer/status filter. Beyond-end pages return `items: []`.

### Required response fields

| Model | Contracted fields |
| --- | --- |
| Login | `accessToken`; `user: {id, email, role}` with role CUSTOMER or OPERATIONS |
| Product | `id`, `name`, `unitPriceMinor`, `currency: LKR`, `availableQuantity` |
| Order | `id`, `customerId`, `productId`, `productName`, `quantity`, `unitPriceMinor`, `totalMinor`, `currency: LKR`, `status`, `createdAt`, `updatedAt`, `history` |
| Transition | `fromStatus` (nullable), `toStatus`, `reason`, `occurredAt` |
| Page<Order> | `items`, `page`, `pageSize`, `total` |
| PaymentEvent input | Nonempty `eventId`, `orderId`, `type: PAYMENT_SUCCEEDED or PAYMENT_FAILED` |
| PaymentResult | `eventId`, `orderId`, `outcome: APPLIED or DUPLICATE or IGNORED`, `orderStatus` reflecting the current order status |
| Error | `code`, readable `message` |

IDs are opaque strings. Every Order response, including list items and retry responses, includes history. Use ISO 8601 timestamps with a timezone, preferably UTC `Z`. Prices/totals are nonnegative integers; quantities are positive integers. Calculate `totalMinor = quantity * unitPriceMinor` on the server, never from submitted prices.

### Required errors

| HTTP | Code | Condition |
| ---: | --- | --- |
| 400 | VALIDATION_ERROR | Invalid body, invalid list query, missing/empty idempotency key |
| 401 | UNAUTHORIZED | Missing/invalid bearer token, invalid credentials, missing/invalid webhook secret |
| 403 | FORBIDDEN | Valid authenticated user has a disallowed role |
| 404 | NOT_FOUND | Unknown resource or another customer's order |
| 409 | INSUFFICIENT_STOCK | Requested quantity exceeds available stock |
| 409 | IDEMPOTENCY_CONFLICT | Same customer/key reused with different productId or quantity |
| 409 | INVALID_TRANSITION | Cancellation of a terminal order |
| 409 | EVENT_ID_CONFLICT | Accepted eventId reused with a different orderId or type |

Validate JSON quantities without coercing strings, booleans, or fractions to valid integers. Parse query strings deliberately and reject invalid values rather than silently fixing them. Reject unsupported body fields so callers cannot supply price, status, role, or customer identity.

## 5. Data model and correctness design

### Persisted entities

| Entity | Essential data and constraints |
| --- | --- |
| User | Opaque id; unique email; passwordHash; role enum |
| Product | Opaque id; exact seeded name; unitPriceMinor; currency LKR; availableQuantity with nonnegative constraint |
| Order | Customer/product foreign keys; immutable productName/unitPriceMinor/currency snapshots; quantity; totalMinor; status enum; createdAt/updatedAt |
| OrderTransition | Order FK; fromStatus nullable; toStatus; reason enum; occurredAt; sequence with unique `(orderId, sequence)`; sequence 0 for creation and 1 for the sole terminal transition |
| OrderIdempotency | Customer FK; key; canonical productId/quantity; nullable order FK while claimed inside an uncommitted transaction; unique `(customerId, key)`; completed before commit |
| PaymentEvent | Unique eventId; order FK; type; nullable outcome while claimed inside an uncommitted transaction, finalized to APPLIED/IGNORED before commit; accepted timestamp |

Use database checks for positive quantity and nonnegative stock/money, foreign keys for references, and unique constraints for idempotency/events/history. Add a history sequence check restricting sequence to 0 or 1 for this assignment's two-step lifecycle. Store total values in a sufficiently wide integer column and convert to JSON numbers only when safely representable; validate arithmetic before committing. Never use floating-point currency calculations.

Claim records are transaction-internal implementation details, not public states. Creation/event processing never commits a claim without its final order link/outcome. A crash or rejected request rolls back the entire transaction. Tests must assert that no incomplete claims remain after success, rejection, or rollback.

Suggested indexes: orders `(customerId, createdAt DESC, id DESC)` and `(customerId, status, createdAt DESC, id DESC)` for customer lists; `(createdAt DESC, id DESC)` and `(status, createdAt DESC, id DESC)` for operations; transition `(orderId, sequence)`; unique customer/key and eventId indexes. Explain the intended query each index supports.

Only an available-stock counter is needed: creation subtracts stock, confirmation leaves it subtracted, failure/cancellation restore it. Do not add a separate inventory ledger or stock administration workflow.

### Database-level race protection: the chosen approach

PostgreSQL decides which request may change stock or status. NestJS starts the transaction, executes the statements, and interprets returned rows. Correctness must not depend on which application process receives the request.

Use explicit **READ COMMITTED** mutation transactions. Phase 4 customer list/detail use read-only **REPEATABLE READ** snapshots for consistent count/items/status/history; these do not enforce reservation correctness. This isolation level is intentional: conflicting writes wait on PostgreSQL row/unique-key locks, and a subsequent statement can see the newly committed winner. PostgreSQL rechecks an UPDATE predicate after a conflicting row update. Do not assume that calling `$transaction` alone makes an unguarded read-then-write safe. These behaviors are documented in [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

The reservation statement is a single atomic conditional decrement, executed inside the transaction containing the order, initial history, and idempotency record:

```sql
-- Illustrative table/column names; bind parameters through the transaction client.
UPDATE products
SET available_quantity = available_quantity - $2
WHERE id = $1
  AND available_quantity >= $2
RETURNING id, name, unit_price_minor, currency, available_quantity;
```

If one unit remains and two customers request it, the first update holds the row lock until commit/rollback. After a successful commit, the second update rechecks `available_quantity >= 1`, finds zero, and returns no row. Only the winner can proceed to a committed order. If the winner rolls back, its decrement is undone and the waiting request may succeed. A `CHECK (available_quantity >= 0)` is additional database protection.

Do not read availableQuantity into JavaScript and later overwrite it with a calculated value. Do not use `SKIP LOCKED`, because a busy product is not evidence of insufficient stock. Use the returned product data for immutable order snapshots and server-side integer totals.

### Transaction A: create an order

1. Authenticate CUSTOMER and validate productId, positive integer quantity, and nonempty idempotency key.
2. Begin a READ COMMITTED PostgreSQL transaction. Attempt a database claim with `INSERT ... ON CONFLICT (customer_id, key) DO NOTHING RETURNING ...` into OrderIdempotency, storing the canonical validated productId/quantity.
3. If no claim is returned, another committed request owns the key. Read it in a **separate subsequent statement** and compare canonical fields. Identical input: acquire FOR SHARE on its order row, load existing order/history, and return 200. This keeps replay status/history coherent with future terminal changes. Changed input: 409 IDEMPOTENCY_CONFLICT. Never reserve stock on this branch.
4. A concurrent claim for the same customer/key waits in PostgreSQL for the first transaction. If the first commits, the duplicate branch sees its completed record; if it rolls back, the waiting insert can claim the key. No in-memory deduplication is needed.
5. For a newly claimed key, execute the conditional stock decrement above. No returned row: check product existence to distinguish 404 NOT_FOUND from 409 INSUFFICIENT_STOCK, then roll back the claim too.
6. Use the returned name/price/currency to calculate the safe integer total; create the PENDING order and sequence-0 `null -> PENDING / ORDER_CREATED` history entry; finalize the claim's orderId.
7. Commit claim, stock, order, and history together; return 201. Any calculation, insert, or history failure rolls back every write.

The unique `(customer_id, key)` constraint arbitrates duplicate requests. Different customers may use the same text key independently. The claim is acquired before product mutation on every path. Use `ON CONFLICT DO NOTHING`, rather than catching a unique violation and continuing inside an aborted PostgreSQL transaction. See [PostgreSQL INSERT/ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html).

### Transaction B: payment event

1. Validate the configured webhook secret and event body before attempting acceptance.
2. Begin a READ COMMITTED transaction. Look up an already accepted eventId first: changed orderId/type returns 409 EVENT_ID_CONFLICT; identical input returns DUPLICATE with the current order status and no writes.
3. For a potentially new event, verify that its order exists. Unknown order: 404 and rollback with no accepted event. This precheck is not the state-transition decision.
4. Claim eventId using `INSERT ... ON CONFLICT (event_id) DO NOTHING RETURNING ...` with its order FK and type. If a concurrent insert wins, read its committed payload in a subsequent statement and use the duplicate/conflict rules. Do not modify an order on this branch.
5. With a new claim, lock the referenced order using `SELECT ... FOR UPDATE` inside this transaction. Use the locked current status, not the earlier precheck. PostgreSQL holds the row lock until transaction end, including across competing application processes.
6. If PENDING, run a conditional `UPDATE orders ... WHERE id = $1 AND status = 'PENDING' RETURNING ...` through the shared transition service. PAYMENT_SUCCEEDED sets CONFIRMED; PAYMENT_FAILED sets FAILED. A real transition requires exactly one returned row.
7. Only after a successful state update, restore quantity for FAILED using an atomic product increment; CONFIRMED makes no stock increment. Insert the sequence-1 terminal history entry with the matching reason and timestamp.
8. If already terminal, make no state/stock/history changes and use IGNORED.
9. Finalize the event outcome to APPLIED or IGNORED and commit it with all related writes. Return the locked resulting order status.

The payment event/order foreign key is DEFERRABLE INITIALLY DEFERRED. Immediate event insertion would acquire KEY SHARE before the planned order FOR UPDATE, risking lock-upgrade deadlocks between two callbacks. Referential integrity is checked at commit; tests prove invalid references cannot commit.

Persist IGNORED events too: a retry becomes DUPLICATE, and changed input conflicts. Rejected invalid/unauthorized/unknown-order requests do not consume event IDs. Check an existing accepted event before resolving a changed orderId so an accepted event reused with an unknown order still returns EVENT_ID_CONFLICT, not 404.

### Transaction C: customer cancellation

1. Authenticate CUSTOMER and validate the empty body.
2. Begin a READ COMMITTED transaction. Fetch/lock the order using `SELECT ... WHERE id = $1 AND customer_id = $2 FOR UPDATE`. Missing or another customer's order returns 404.
3. If its locked status is terminal, return 409 INVALID_TRANSITION without writes.
4. Update with `WHERE id = $1 AND customer_id = $2 AND status = 'PENDING' RETURNING ...`, setting CANCELLED and updatedAt. Require one returned row.
5. Only for that successful update, restore stock with `available_quantity = available_quantity + quantity` and append the sequence-1 CUSTOMER_CANCELLED transition.
6. Commit state, stock, timestamp, and history together. Any failure rolls back all changes.

### Lock order and why stock is released once

Creation claims its customer/key before updating the product. Payment claims its eventId, then locks the order, then updates the product when releasing stock. Cancellation locks the order, then updates the product. New-order creation never subsequently locks an existing order; creation replay locks its existing order without touching products; transition paths never claim a customer idempotency key. Keep this order consistent, transactions short, and network/password-hashing work outside transactions.

Payment and cancellation compete for the **same PostgreSQL order-row lock**. The second transaction sees the winner's committed terminal status. Its conditional PENDING update cannot succeed, so it cannot run a stock release or append history. An atomic product increment also prevents lost updates when different orders release stock for the same product concurrently. PostgreSQL row-lock semantics are described in [explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html).

Terminal state behavior remains exactly the assignment contract: later cancellation gets 409; a new later event gets IGNORED; an identical accepted event gets DUPLICATE. All transaction callbacks must throw on failures so partial writes cannot commit. A database deadlock/serialization failure rolls back the whole transaction; any bounded retry must restart the entire transaction with the same key/event, never retry only the stock write.

### Worked race examples

| Race | PostgreSQL arbitration | Committed result |
| --- | --- | --- |
| Alice and Bob buy the one-unit headphones using different keys | Conditional product UPDATE and row lock | One order, stock 0; loser 409 INSUFFICIENT_STOCK |
| Two identical Alice requests use one key | Unique customer/key INSERT conflict | One order/reservation/history entry; winner 201, retry 200 with same ID |
| Two requests use one accepted eventId with changed payload | Unique eventId plus stored payload comparison | Accepted payload stays unchanged; conflicting request 409 |
| Cancellation races payment success | Order `FOR UPDATE` plus conditional PENDING update | CONFIRMED with consumed stock or CANCELLED with stock restored once |
| Cancellation races payment failure | Same order lock/predicate | FAILED or CANCELLED; one restoration and one terminal history entry |
| Failures for two different orders restore the same product | Atomic increments serialize on product row | Both quantities restored with no lost increment |

These are planned behaviors, not test results. No advisory locks, Redis locks, application mutexes, or in-memory authoritative stock are part of the revised design.

### Invariants to demonstrate

- Available stock never becomes negative.
- Each successfully created order reserves quantity exactly once.
- Failed/cancelled orders release their reserved quantity exactly once; confirmed orders retain their stock consumption.
- One customer/key identifies one successfully created order and input.
- One accepted eventId identifies one orderId/type payload across restarts.
- Each order has one initial history entry and at most one terminal transition.
- Retries, ignored events, and rejected requests add no transition.
- Order snapshots do not change when the current product changes.
- A process restart preserves stock, orders, histories, idempotency, and accepted events.

## 6. Implementation phases

### Phase 1 - Foundation and runnable setup

Dependencies: none.

- [x] Initialize the npm workspace, React/Vite app, and a standard NestJS CLI-style application with `nest-cli.json`, `main.ts`, `app.module.ts`, TypeScript configuration, and lockfile.
- [x] Register feature modules and constructor-injected providers using the module wiring in section 3; use NestJS bootstrap/controllers rather than standalone route handlers.
- [x] Set API port 4000 and global `/api` prefix; make frontend API URL configurable.
- [x] Add environment examples for database, JWT, webhook secret, and allowed frontend origin. Use `local-demo-webhook-secret` as the documented local value, read through configuration.
- [x] Add root install/dev/build/test/database scripts and ignore generated files and real secrets.
- [x] Start README and actual work/AI usage log now.
- [x] Establish local PostgreSQL and a separate test database configuration.

Acceptance: both apps start; frontend reaches the configured API; database connection works; production builds run. No paid service is required locally. Record exact working commands rather than speculative commands.

Completed: 2026-10-08 11:04:42 Asia/Colombo. Verified clean lockfile install, both production builds, lint, 10 configuration tests, 4 real-PostgreSQL API integration tests, separate database connections after restart, and browser connection feedback. See `README.md` and `docs/WORK_LOG.md`. Business schema, seed, and assignment workflows remain in their planned phases.

### Phase 2 - Schema, migrations, deterministic reset and seed

Dependencies: phase 1.

- [x] Implement the entities, enums, constraints, and indexes in section 5; retain needed SQL checks/indexes in migrations.
- [x] Verify PostgreSQL enforces nonnegative stock, unique customer/key and eventId, unique history sequence, and foreign keys. Configure explicit READ COMMITTED transaction boundaries through `PrismaService`.
- [x] Add a repeatable reset/seed command targeting the configured local database, clearly identifying that it deletes demo data.
- [x] Hash seeded passwords; use these exact accounts, all with local password `DemoPass123!`:

| Email | Role |
| --- | --- |
| alice@example.test | CUSTOMER |
| bob@example.test | CUSTOMER |
| ops@example.test | OPERATIONS |

- [x] Seed these exact products and no orders, idempotency records, transitions, or payment events:

| Name | Unit price minor | Available quantity |
| --- | ---: | ---: |
| Mechanical Keyboard | 1500000 | 20 |
| USB C Hub | 800000 | 20 |
| Laptop Stand | 600000 | 20 |
| Wireless Mouse | 450000 | 20 |
| Limited Edition Headphones | 2500000 | 1 |

All products use LKR, with 100 minor units = LKR 1.00. Seed IDs may be deterministic opaque strings; Postman still discovers product IDs by name.

Acceptance: migrate an empty database and reset twice; both runs produce exactly 3 users and 5 products with the specified values, no orders/events, and hashed passwords. Confirm invalid stock/quantity data is rejected by constraints.

Verified: CLI-generated migration applied to both initially empty databases; direct-SQL constraint checks, READ COMMITTED, bcrypt verification, seed preservation, and two successive resets passed against real PostgreSQL. Both builds/lint and 10 unit + 23 integration tests passed. See `docs/DATABASE.md` and `docs/WORK_LOG.md`. Transactional reservation/payment handlers and concurrency proof remain in Phases 4–5.

Requested Phase 2 revision (frontend foundations only):

- [x] Install React Query, React Hook Form, Zod, and the Zod resolver integration.
- [x] Configure one application QueryClient/provider and migrate the existing connection check into a typed, cancellable query hook with usable refresh/error feedback.
- [x] Add centralized login/order input schemas, inferred types, and form resolvers for the later scheduled forms; validate API connection/error responses centrally.
- [x] Verify schema boundaries and API/query behavior; run frontend build/lint and keep backend/database behavior intact.
- [x] Record final changes and evidence in this plan and the work log. Do not advance to Phase 3.

Revision verified: frontend build, both workspace lints, 26 frontend tests, and 10 existing backend unit tests passed. Live preview shows Application connected after manual refresh. Offline startup remains pending until a response is available; aborts during fetch/body reading remain cancellation. Database schema/seed and backend endpoints were unchanged. Forms are prepared through centralized schemas/resolvers; actual login/order screens remain scheduled work.

Pre-Phase 3 UI foundation revision:

- [x] Install and configure Tailwind CSS/daisyUI; remove the old page-specific stylesheet.
- [x] Separate App, page, feature, layout, and shared UI responsibilities. Add reusable loading/feedback, button, empty state, field, and table primitives for the planned screens.
- [x] Restyle the existing connection page with responsive spacing, a consistent theme, and accessible feedback/controls.
- [x] Verify frontend build/lint/tests and browser layout/refresh; update plan and work log. Keep Phase 3 unstarted.

Verified: Tailwind 4.3.3/daisyUI 5.7.47 production build and frontend lint passed; all 32 frontend tests passed. Shared table/form/button/loading checks cover semantics and state boundaries. Browser refresh passed; 375px and 1280px layouts showed no horizontal overflow. Existing API health remains connected. No authentication, order screen, or new backend feature was added.

### Phase 3 - Authentication, validation, error handling, product API

Dependencies: phases 1-2.

- [x] Implement login with generic unauthorized responses for incorrect credentials; return exactly the Login fields.
- [x] Add bearer authentication, verified user lookup, and role guards. Never trust customerId or role submitted in a body.
- [x] Add DTO validation and consistent `{code, message}` errors, including mapped NestJS validation/auth errors.
- [x] Implement authenticated product listing with required fields and safe integer serialization.
- [x] Restrict CORS to the configured frontend origin; load secrets from configuration and avoid logging credentials/tokens.
- [x] Extend the Phase 2 React Query API/error foundation with authentication, user-cache cleanup, login via React Hook Form/central Zod resolver, and role-based navigation.
- [x] Compose authentication screens from the shared application shell, page header, form fields, buttons, and feedback components; keep queries/mutations/form wiring in feature components.
- [x] Add focused login/product/authentication checks as the endpoints become available.

Acceptance: each seeded account logs in; incorrect login and missing/invalid tokens produce 401 UNAUTHORIZED; authenticated product listing returns the exact seed inventory; passwords never appear in API responses. API authorization works independently of frontend navigation.

Verified: both builds/lints passed; 13 backend unit, 43 real-PostgreSQL/API integration, and 36 frontend tests passed. API tests cover every seeded login, generic credential errors, strict DTO fields, malformed/expired/invalid-signature/algorithm/audience tokens, live database identity/roles, exact numeric products, and both role directions using test-only routes. DOM/browser checks cover validation, login/logout, bearer requests, account cache cleanup, role navigation, session failure, and live seeded inventory. Browser login/product views fit 375px without page overflow. Tokens remain in memory; reload requires re-login. Order tabs are explicit placeholders; order routes/creation/cancellation/payment logic remain unimplemented. See `docs/API.md` and work log.

### Phase 4 - First vertical slice: atomic order creation and customer UI

Dependencies: phases 2-3.

- [x] Implement transaction A in injected NestJS order services: unique database key claim, atomic conditional stock decrement, server-derived totals/snapshots, and initial history in one transaction.
- [x] Check returned row counts to determine reservation success. Pass the transaction client to every claim/order/stock/history operation; do not read stock and later overwrite it from JavaScript.
- [x] Implement customer list/detail with ownership constraints and required pagination/filtering.
- [x] Create product browsing, quantity entry via React Hook Form/central Zod resolver, submit feedback, customer order list, and detail display using React Query for API state.
- [x] Generate a fresh frontend idempotency key for each new logical submission; retain the same key and input for uncertain network retries. Persist the customer-scoped canonical intent in sessionStorage before sending so reload/re-login can resume it; do not persist authentication secrets. Do not silently generate a new key after a timeout.
- [x] Show LKR by converting minor units for display only; e.g., Mechanical Keyboard is LKR 15,000.00.
- [x] Disable duplicate clicks for UI feedback only; PostgreSQL uniqueness and transactions provide idempotency correctness.
- [x] Add initial real-PostgreSQL tests for last-unit contention, same-key concurrent creation, changed input, ownership, and rollback after a reservation but before transaction completion.

Acceptance: Alice can log in, browse, reserve a product, and inspect her PENDING order with one history entry. Stock decreases once; a retry is 200 with the same order ID; changed input is 409. Bob cannot read Alice's order. Two concurrent independent buyers cannot both buy the last headphone unit.

Verified: 81 real-PostgreSQL/API tests (38 new order scenarios), 39 frontend tests, 13 backend unit tests, both builds and lints. Deterministic lock observation across two independent NestJS/Prisma instances proves last-unit exclusion, identical-key replay, changed-input conflict, and successful takeover after rollback. Frontend tests cover creation/history/filtering/pagination and uncertain-response recovery after reload with the same key/input. Live mobile/desktop checks and documentation evidence are recorded in docs/WORK_LOG.md. Customer list/detail use read-only REPEATABLE READ snapshots; mutations remain READ COMMITTED. Shared Pagination/StatusBadge complement the existing table/form/feedback primitives. No cancellation/payment/operations-order business logic is included in Phase 4.

### Phase 5 - Payment events, cancellation, valid terminal states

Dependencies: phase 4.

- [x] Implement transactions B and C in NestJS services: unique event claim, order-row `FOR UPDATE`, conditional PENDING update, atomic release increment, and history inside the same transaction.
- [x] Route webhook and cancellation transitions through one injected `OrderTransitionsService`; only a successful guarded state update may trigger stock restoration/history.
- [x] Guard webhook access using the configured `X-Webhook-Secret`; do not require a customer bearer token on that route.
- [x] Implement accepted event persistence, DUPLICATE/IGNORED outcomes, and EVENT_ID_CONFLICT.
- [x] Add cancellation to customer details only for PENDING orders; handle a stale displayed status with readable 409 feedback and refresh.
- [x] Add manual refresh for payment updates, stock display, and order history.
- [x] Test payment success/failure, cancellation, repeated events, terminal events, and cancellation/payment contention against PostgreSQL.

Acceptance: success retains consumed stock; failure/cancellation restore stock once; duplicate callbacks append no history; new terminal callbacks are IGNORED; changed event payloads return 409. Both race outcomes leave one terminal transition and correct stock. Restart the API and verify retries still behave correctly.

Verified: 109 real-PostgreSQL/API tests (28 new transition scenarios), 44 frontend tests (five new cancellation scenarios), 13 unit tests, both builds/lints, live cancellation/payment callbacks, and full API process restart with preserved key/event outcomes. Tests observe database locks for both cancellation/payment winners, duplicate/changed events, first-claim rollback, and two concurrent product increments. The payment event/order FK is deferred to commit to avoid KEY SHARE to FOR UPDATE upgrade deadlocks while retaining referential integrity. Details and measured time are in docs/WORK_LOG.md; operations order endpoints/UI remain Phase 6 work.

### Phase 6 - Complete customer and operations frontend

Dependencies: phases 4-5.

- [x] Implement operations list/detail endpoints with role restrictions and all-order visibility.
- [x] Add operations table/cards, uppercase status filtering, pagination, and order inspection with full history.
- [x] Finish customer list pagination/status filtering and order details, including timestamps, snapshots, quantity, total, and transition reasons.
- [x] Add distinct loading, empty, validation, failure, and success states; preserve user input on recoverable errors.
- [x] Reuse shared DataTable/loading/empty/feedback primitives for customer and operations lists; keep server pagination/filter state and actions in their feature components.
- [x] Use labeled controls, semantic links/buttons, visible focus, keyboard operability, and feedback announced to assistive technology.
- [x] Check small/mobile and desktop layouts; use text labels alongside status colors.
- [x] Reset pagination to page 1 when changing a status filter; refresh appropriate product/order data after successful changes.
- [x] Keep simulated payment triggering in Postman/API demonstrations; do not expose the webhook secret in the frontend bundle or add a payment administration feature.

Acceptance: complete customer creation/detail/cancellation and operations filtered list/detail flows work with keyboard input and on mobile width. Operations cannot use customer-only routes; customers cannot use operations routes. Empty pages and API errors remain usable.

Verified: operations endpoints enforce server-side roles and reuse snapshot-consistent order reads. Shared order list/detail/navigation preserve filter/page on inspection/back, expose customer IDs to operations, and keep actions customer-only. All 125 PostgreSQL/API tests, 48 frontend tests, and 13 unit tests passed, along with both builds/lints. Live keyboard creation/detail/cancellation and operations filtering/history/empty-state checks passed at mobile and desktop widths. No private API configuration appears in the built frontend. Detailed evidence is in docs/WORK_LOG.md.

### Phase 7 - Complete automated verification and repair

Dependencies: phases 3-6. Extend tests introduced earlier; do not postpone all correctness verification to this phase.

Use a real, dedicated PostgreSQL database. Exercise HTTP routes and query database state afterward. Use multiple connections and concurrent requests, with controlled overlap; do not replace locking assertions with mocked repositories or sequential Postman calls. Reset isolated fixtures between scenarios and keep tests sharing mutable stock from running in parallel.

Start **two independent NestJS application instances**, each with its own Prisma connection pool, pointing at the same test PostgreSQL database. Send one contending request to each instance for the last-unit, identical-key, and cancellation/payment races. This demonstrates that no shared JavaScript memory is needed. For deterministic contention, a separate test connection can hold a product/order row lock while both requests start, then release it after verifying they are waiting; avoid timing-only sleeps as the proof. Set bounded test timeouts and close both apps/pools afterward.

| Scenario | Required assertions |
| --- | --- |
| Last unit, different customers/keys | One 201 and one 409 INSUFFICIENT_STOCK; PostgreSQL stock 0; exactly one order and one initial transition |
| Identical sequential retry | First 201, retry 200; same ID; one reservation/order/initial history entry |
| Identical concurrent retry | One 201 and one 200; same ID; database contains one order/key/initial transition; stock deducted once |
| Changed input, same key | 409 IDEMPOTENCY_CONFLICT; no additional stock/order/history change; test changed quantity and changed product |
| Same text key, different customers | Independent orders when stock allows; no cross-customer replay |
| Independent NestJS processes share PostgreSQL | Last-unit, identical-key, and transition races obey the same invariants across distinct application instances |
| Reservation transaction fails before completion | Stock decrement, order/history, and key claim all roll back; retry can succeed; no incomplete claim remains |
| Transition transaction fails before completion | State, stock release, history, and event claim all roll back; retry applies exactly once |
| Payment succeeds | APPLIED/CONFIRMED; no stock restoration; initial + PAYMENT_SUCCEEDED history |
| Payment fails | APPLIED/FAILED; stock restored once; matching history |
| Cancellation | CANCELLED; stock restored once; repeated cancellation 409 INVALID_TRANSITION |
| Identical duplicate event | DUPLICATE; no repeated state/stock/history write |
| Changed accepted event payload | 409 EVENT_ID_CONFLICT for changed orderId and for changed type |
| New event for each terminal status | IGNORED; unchanged order/stock/history; accepted event persists; repeat becomes DUPLICATE |
| Concurrent duplicate callbacks | One accepted event; one applied transition; no double release |
| Different events racing for one order | Exactly one valid terminal transition; other event IGNORED; correct stock |
| Different failed orders share a product | Concurrent atomic increments restore both quantities without a lost update |
| Cancellation races payment success | CONFIRMED with consumed stock or CANCELLED with restored stock; loser follows contract |
| Cancellation races payment failure | FAILED or CANCELLED; stock restored once, never twice |
| Invalid/unknown-order event | Correct 400/404; event not persisted; corrected reuse of that eventId can be accepted |
| Invalid quantities | Zero, negative, fractional, string, boolean, missing, unsafe integer: 400 VALIDATION_ERROR; no writes |
| Missing key / unknown product / insufficient stock | Correct 400/404/409; no partial writes |
| Authentication and roles | Missing/invalid token and credentials 401; each disallowed role route 403 |
| Cross-customer access | Read/cancel 404; customer lists contain only the caller's orders; stock/history unchanged |
| Webhook secret | Missing/wrong secret 401; no event or order mutation |
| List contract | Defaults, positive integers, max size, uppercase status, filtered total, stable same-timestamp sorting, beyond-end empty array |
| Snapshot and amount correctness | Server values used; changing product data does not change existing order snapshots |
| Process restart | Existing stock/order/history retained; identical create/event retry remains idempotent |
| Frontend main flow | Login -> browse -> create -> detail -> cancel -> updated state/history |
| Frontend API failure | Show an insufficient-stock or simulated API error accessibly; preserve meaningful input; no false success |

Check required fields and timezone-bearing timestamps across every Order response path. For ordering, deliberately create equal timestamps in a test fixture rather than hoping a tie occurs.

Acceptance: meaningful automated checks pass; race tests assert persisted state, not just status codes, including across two independent NestJS instances. Verify no incomplete key/event claims survive. Record actual commands/results. A fresh build succeeds. Fix failures before describing a gate as complete.

Verified: 131 real-PostgreSQL/API tests in six suites, 48 frontend tests in seven suites, and 13 unit tests in two suites passed; both production builds/lints passed. Six additional scenarios prove creation replay waits for a committing terminal transition and returns consistent status/history, and exact public contracts hold across create/replay/customer/operations responses. Existing controlled independent-app stock/key/callback/cancellation races, rollback, ownership and restart scenarios all passed again. Test database finished seeded with no orders or incomplete key/event claims; development demo data remained intact. See docs/VERIFICATION.md for the requirement-to-test map and docs/WORK_LOG.md for measured evidence. No fresh-checkout installation or final Postman/submission claim is included.

### Phase 8 - Postman collection and environment submission

Dependencies: working API and phase 7 correctness gates.

- [x] Create and export our own Postman Collection v2.1 JSON and local environment JSON from the actual implemented API.
- [x] Parameterize `baseUrl`, the three demo account emails/passwords, and `webhookSecret`.
- [x] Capture Alice/Bob/operations tokens automatically; discover products by exact seeded names; capture created order IDs automatically.
- [x] Generate new idempotency keys and event IDs for each new scenario/run, deliberately reusing them only in retry/conflict requests.
- [x] Include assertions for exact status/code, required fields, history, ownership, pagination, totals, and visible stock effects.
- [x] Save representative success and error responses captured from the running implementation as request examples; do not invent sample outputs.
- [x] Sanitize exported variables and saved examples: remove bearer tokens/runtime IDs from variables, redact sensitive response tokens and authentication headers, replace secret/password values with placeholders. Keep nonsecret representative resource IDs in examples where needed to understand outputs.
- [x] Document the local placeholder values to enter before running. This initial environment setup is allowed; manual token/ID copying is not.
- [x] Validate JSON/schema and run the collection from fresh seed data using Postman or a compatible runner; confirm all assertions pass.

Collection run order:

1. Login all three accounts and discover seeded products.
2. Create Alice's order; identical retry; changed-input conflict; list/detail.
3. Demonstrate Bob cannot read/cancel Alice's order and customers cannot use operations routes.
4. Payment success; duplicate success; fresh terminal event ignored; conflicting event payload rejected; terminal cancel rejected.
5. Create a separate order and apply payment failure; verify stock restored.
6. Create a separate order and cancel; verify stock restored; later payment ignored.
7. Operations list/status filter/pagination/detail; operations blocked from customer-only actions.
8. Invalid quantities/key/query, unauthenticated calls, wrong webhook secret, unknown resources, and insufficient-stock examples.

Use products with 20 seeded units for repeated happy paths. Reserve the one-unit headphones for a deliberate isolated insufficient-stock scenario. The collection must not depend on the order of a prior test suite or consume stock accidentally across scenarios. Reset before a complete fresh demonstration.

Acceptance: every required route and specified flow has assertions; collection runs from fresh seed data without copied tokens/IDs; examples come from actual responses; exported files contain placeholders instead of secrets and no runtime access tokens.

Verified: our exported Collection v2.1 and placeholder environment contain 91 requests in nine ordered folders, with 182 assertions and one real sanitized response example per request. Newman capture and a subsequent unchanged-export run each passed from fresh isolated inventory_test seed. Tokens/products/orders are captured automatically; UUID keys/events are generated per logical scenario. Database outcomes match five orders/keys, ten history entries, five accepted events and correct stock, with no incomplete claims. Official collection schema, environment shape, scripts and secret/JWT checks passed. Development data was preserved. See postman/README.md and docs/WORK_LOG.md.

### Phase 9 - Documentation, reproducibility, submission, walkthrough

Dependencies: phases 1-8.

- [x] Finish README with exact prerequisites and versions, install/configure/migrate/reset/seed/start/build/test commands, ports, demo login details, and collection setup/run order.
- [x] Document local database and test database separation and the destructive nature of reset commands.
- [x] Finish API documentation for all routes, models, headers, pagination, transition rules, and error codes.
- [x] Write a short engineering note explaining NestJS module/provider boundaries, READ COMMITTED transactions, conditional SQL updates, lock order, unique database claims, durable idempotency/events, authentication/ownership, schema constraints, indexes/pagination, and chosen tradeoffs.
- [x] Explain how production reservation expiry would need persisted deadlines and coordinated transitions/releases; do not implement it.
- [x] Record actual time, known limitations, unfinished work, and AI usage: name tools, their contribution, and how outputs were verified. Include this planning assistance.
- [x] Verify setup against a clean database and clean install; do not claim a clean-checkout verification if it was not actually run.
- [x] Prepare the source repository or ZIP with frontend/backend, migrations, seed/reset, environment examples, docs, tests, lockfile, and Postman files; exclude dependencies, builds, real secrets, and tokens.

Walkthrough preparation for the required 45-minute discussion:

- Show login, product reservation, customer ownership, cancellation, and operations inspection.
- Demonstrate simulated payment success/failure, replay, conflict, and ignored terminal events in Postman.
- Explain last-unit concurrency and cancellation/payment contention using the transaction logic and actual test results.
- Explain why retry keys/events are persisted, why stock is restored once, and why history shares a transaction with state changes.
- Explain snapshot prices, integer LKR arithmetic, filtered pagination, and access controls.
- Explain limitations and production expiry tradeoffs; be able to navigate and explain the delivered code.

Acceptance: a reviewer can follow the written instructions locally without a paid account; all required artifacts are present; evidence and limitations are accurate; the developer understands the implementation.

Verified: a source ZIP was extracted without dependencies/builds/private configuration/database data. Fresh npm ci, generated configuration and a new PostgreSQL 16.1 cluster, both migrations, repeated seed/reset, both builds/lints, 13 unit + 48 frontend + 131 PostgreSQL/API tests, Postman validation and 91 requests/182 assertions passed. Production startup, preview asset/configuration, CORS, role/ownership/reservation/cancellation, and full API process restart passed. 100 app/schema/test files match the verified copy; original demo data remains intact. Final ZIP paths/checksums/private-value exclusions are validated. Engineering, expiry discussion, API, walkthrough, work-log, and submission notes are included. Hosted demo evidence is in Phase 10. Earlier planning time and dependency-audit findings remain disclosed limitations.

### Phase 10 - Optional deployment bonus within remaining time

Dependencies: every required acceptance gate above passes and actual remaining budget permits it. This phase is explicitly within the assignment's optional scope, not a reason to delay required artifacts.

- [x] Host frontend/backend so both customer and operations workflows work (up to 3 marks).
- [x] Use hosted PostgreSQL and demonstrate persistence after application restart/redeployment without reseeding (up to 1 mark).
- [x] Verify HTTPS, configured frontend/API URLs and CORS, authentication, webhook secret, and environment variables (up to 1 mark).
- [x] Use demo-only data and keep credentials/secrets out of the frontend bundle and repository.
- [x] Document demo URL, API base URL, demo access details, deployment steps, and restart/persistence evidence.

Verified on 9 October 2026. Frontend: https://app.prabhathmadhushan.cv on Vercel project chitta-lab-inventory, production deployment Ready, `VITE_API_BASE_URL=https://api.prabhathmadhushan.cv/api`, and no database, JWT, or webhook secret in the Vercel environment. API: https://api.prabhathmadhushan.cv/api through Caddy to the systemd service. Alice reserved and cancelled USB C Hub order `4756c545-3852-42dd-885d-30d53cfaff15`. Bob's list stayed empty. Operations filtered PENDING and opened that order with customer id `user-alice`. Keyboard order `a5bb58fc-c23e-44d4-b257-97702531451e` remained PENDING with its original history after an API restart without seed or reset; the same idempotency key returned HTTP 200 and did not reserve again; cancellation restored stock. A wrong webhook secret returned 401; the server secret then returned IGNORED and a replay returned DUPLICATE. Headphones remained at 1 and the other products at 20 after the checks. The hosted webhook secret was not copied into git. A guaranteed score is not claimed.

## 7. Final submission gate

- [x] All nine required API routes match paths, access, statuses, fields, and errors.
- [x] Both roles and both seeded customers work; ownership holds at the backend.
- [x] Required products, prices, currency, stock, and repeatable empty-order seed state are correct.
- [x] Last-unit, same-key, callback, and cancellation/payment races are verified against PostgreSQL.
- [x] Critical races pass across two independent NestJS instances; no application mutex or in-memory stock/key/event store provides correctness.
- [x] Idempotency/events/history/stock survive API restart.
- [x] UI covers customer and operations flows and required feedback/accessibility/responsiveness.
- [x] Required automated checks and clean build pass with recorded evidence.
- [x] Postman collection/environment are complete, runnable from fresh seed, asserted, captured from the API, and sanitized.
- [x] Migrations, reset/seed, `.env.example`, README, API docs, engineering note, time log, limitations, and AI note are included.
- [x] Source repository link or ZIP is ready without secrets or generated dependency folders.
- [x] Optional deployment is either verified and documented or clearly marked omitted/incomplete.
- [ ] Actual work does not exceed 12 hours; remaining gaps are explicitly listed.

## 8. Progress record

Update this table as phases are implemented. Planned items must not be reported as completed evidence.

| Phase | Status | Actual time | Verification / limitations |
| --- | --- | --- | --- |
| Planning | Revised / complete | Record measured time in work log | Checked all four PDF pages; revised to explicit NestJS structure and database conditional updates, locks, and unique constraints |
| 1. Foundation | Complete / verified | 36m 9s elapsed | CLI-generated apps/modules, clean install/build/lint, 10 unit + 4 PostgreSQL API tests, live frontend/API connection; see work log |
| 2. Database and frontend foundations | Complete / verified | 13m 4s original + revision in work log | Database/seed plus React Query, React Hook Form/Zod central schemas; 26 frontend tests; actual forms/auth and race-handling remain later phases |
| Before 3. Shared UI/styling | Complete / verified | 5m 32s elapsed | Tailwind/daisyUI, separated page/feature/layout/shared UI, 32 frontend tests, mobile/desktop layout and refresh verified |
| 3. Authentication and contract | Complete / verified | 18m 42s elapsed | JWT/login/role guards, strict validation, numeric products, shared login/product UI; 13 unit + 43 API + 36 frontend tests passed |
| 4. Reservation vertical slice | Complete / verified | 29m 7s elapsed | Atomic PostgreSQL reservation/key/history; customer form/list/detail; 81 API + 39 frontend + 13 unit tests; two independent-instance races and live mobile/desktop checks |
| 5. Payments and cancellation | Complete / verified | 19m 20s measured | Shared guarded transition service; durable payment events; cancellation UI; 109 API + 44 frontend + 13 unit checks; controlled races, rollback and full API process restart passed |
| 6. Complete frontend | Complete / verified | 15m 49s measured | Operations access/list/detail; shared customer/operations UI; 125 API + 48 frontend + 13 unit checks; live keyboard/mobile/desktop flows passed |
| 7. Automated verification | Complete / verified | 6m 37s measured | Requirement-to-test map; 131 API + 48 frontend + 13 unit checks; six new retry-race/public-contract cases; fresh builds/lints and isolated DB cleanup passed |
| 8. Postman submission | Complete / verified | 18m 23s measured | 91 requests / 182 assertions; all routes/scenarios; real sanitized examples; schema checks and repeat fresh Newman run passed; development preserved |
| 9. Documentation and submission | Complete / locally verified | 14m 55s measured | Fresh archive install/cluster/build/tests/production restart passed; docs/walkthrough/source ZIP and checksums prepared; known limits disclosed |
| 10. Optional deployment | Complete / verified | Not separately stopwatched; see work log | Hosted UI, restart persistence, HTTPS, and webhook checks passed on 9 October 2026; demo URLs are in the README |

Required local implementation and submission artifacts are complete. The source ZIP and checksum manifest are under .local/submission; docs/SUBMISSION.md records clean-archive evidence and the hosted demo. The measured implementation total through Phase 9 is below 12 hours; earlier planning duration was not measured, so the absolute total-time gate is not independently verified.

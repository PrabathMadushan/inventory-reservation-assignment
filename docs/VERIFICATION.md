# Phase 7 verification guide

This maps the assignment's correctness requirements to executable checks. Run from the workspace root with Node 22 and the configured local PostgreSQL cluster. The API integration runner migrates and resets **inventory_test**, then runs suites serially. It rejects development/test database name reuse. Keep development data separate.

Stop API development processes before generating/building Prisma on Windows, because a running API can lock its engine DLL. PostgreSQL must remain running.

```sh
npm run build
npm run lint
npm test
npm run test:web
npm run test:api:e2e
```

Each command must exit successfully. Integration fixtures restore the test seed afterward. Final Phase 7 result: 131 PostgreSQL/API tests across six suites, 48 frontend tests across seven suites, and 13 backend unit tests across two suites passed. Both builds and lint checks passed. The test database ended with three users, five products, zero orders, and zero incomplete key/event claims. Development demo data was preserved. Measured results and remaining submission gates are recorded in WORK_LOG.md and IMPLEMENTATION_PLAN.md.

## Assignment evidence map

| Requirement | Executable evidence | Persisted assertions |
| --- | --- | --- |
| Last unit with different customer/key | orders.e2e-spec.ts: independent-app last-unit race | 201/409; stock 0; one order/key/initial history |
| Sequential and concurrent identical key | orders: exact retry and same-key race | Same ID; 201/200; one reservation/history/key |
| Changed quantity/product; same key across customers | orders: changed canonical input and scoped keys | Conflict leaves original unchanged; independent customer claims |
| Reservation failure and claimant takeover | orders: later-write failure and winner-rolls-back race | No partial stock/order/history/claim; waiting retry succeeds |
| Payment success/failure | transitions.e2e-spec.ts: applies each type once | CONFIRMED consumes stock; FAILED releases once; matching history |
| Cancellation and repeated cancellation | transitions: cancellation and cancellation access | CANCELLED release once; repeat 409; initial plus terminal history |
| Duplicate/changed/terminal payment events | transitions: applies each type, terminal cancellation, event conflicts | APPLIED/IGNORED/DUPLICATE; immutable payload; no duplicate release/history |
| Callback contention and rollback | transitions: same-event, changed-event, different-events, rollback-first | One accepted claim and valid transition; losing behavior matches contract |
| Cancellation versus both payment types, either winner | transitions: cancel/payment controlled races | Exactly one terminal transition; correct stock regardless of winner |
| Different failed orders sharing a product | transitions: concurrent releases | Atomic increments restore both quantities; no lost update |
| Create retry during terminal commit | transitions: creation retry waits for each terminal status | Observed FOR SHARE wait; same ID and consistent latest history; no new reservation/key |
| Invalid quantity/body/key/product/stock | orders parameterized validation and rollback cases | 400/404/409; no partial claim/order/stock/history |
| Invalid/unknown-order callback and secret | transitions validation/secret/unknown-order cases | 400/401/404; no event consumed; corrected event ID remains usable |
| Login, tokens, role authority | auth.e2e-spec.ts | All seeded accounts; generic failed login; invalid token 401; database role overrides claims |
| Customer ownership and both role directions | orders/transitions/operations.e2e-spec.ts | Cross-customer read/cancel 404; cross-role routes 403; no data mutation |
| Pagination/filter contract | orders and operations list cases | Defaults, maximum size, strict uppercase status, filtered count, deterministic timestamp ties, empty large pages |
| Snapshots and integer LKR amounts | orders snapshot/overflow cases | Server snapshots survive product changes; safe integer totals; overflow rolls back |
| Every public Order response | transitions: public contract for each terminal status | Exact fields across create/replay/customer and operations list/detail/cancel; numeric amounts; UTC timestamps; full history |
| Database schema and seed | schema.e2e-spec.ts | Exactly 3 users/5 products; repeat seed/reset; direct SQL checks/FKs; unique sequence; deferred event FK checked at commit |
| Restart persistence | transitions: close/recreate both apps | Same durable key/event outcomes; unchanged stock; no repeated terminal history |
| Frontend customer flow and failure recovery | order-flow.test.tsx | Login, validation, canonical create, detail/history, cancel/refresh, insufficient-stock correction, uncertain response/reload using same key |
| Frontend operations and account isolation | operations-flow.test.tsx and auth-flow.test.tsx | Read-only list/detail; filter/page preservation; empty/error/refresh states; expired session/logout clears private cache |
| Shared UI/validation/API configuration | components.test.tsx, forms.test.ts, connection.test.ts, App.test.tsx; backend unit specs | Semantic controls, shared states, centralized schemas, startup validation, safe integer serialization |

## How contention is proven

Order and transition suites start two independent NestJS applications with separate Prisma pools against the same PostgreSQL database. Test-only barriers hold the first transaction after real SQL writes, or an independent transaction holds a product row. The contender must appear in pg_stat_activity with wait_event_type = Lock and the expected SQL before release. This is observed database contention, not a sleep used as proof.

The barriers and injected failures exist only in test files. Requests still execute real HTTP controllers, authentication/validation, services, PostgreSQL constraints, and transactions. Bounded waits fail if contention is not observed; finally blocks release barriers and await outstanding requests; teardown closes both apps/pools. Production contains no application mutex or in-memory key/event/stock authority.

The new retry race observes the creation replay's FOR SHARE lock while a terminal transition is uncommitted. After release, the response must contain the committed status and both history entries, with one durable key/order and no additional stock reservation. Public response checks also compare both roles' detail/list values with the same creation replay.

## Limits of this phase

The automated restart scenario recreates applications/pools in the Jest process. Phase 5 separately verified a full development API process restart without reseeding, recorded in WORK_LOG.md. Independent-app concurrency checks use separate pools in one test process; they do not claim separate operating-system worker processes.

Mobile/desktop and keyboard checks were performed live in Phases 4–6, including customer creation/cancellation and operations filtering/history. The frontend suite exercises DOM behavior with API mocks; PostgreSQL authority is verified by the API suites. Phase 7 did not itself claim clean installation or final packaging. Phase 9 now records a clean source-archive install and local submission verification in docs/SUBMISSION.md. No remote Git checkout or public deployment is claimed.

## Phase 8 collection verification

The Postman artifacts are now verified through Newman: 91 requests and 182 assertions passed from fresh inventory_test seed, then passed again without rewriting exports. The runner additionally checks five durable orders/keys, ten transitions, five accepted events, zero incomplete claims, and exact final stock. JSON-schema/script/export checks reject private configuration/JWT leakage and require a captured example for every request. These sequential demonstrations complement the controlled Phase 7 PostgreSQL races; they do not replace them. See postman/README.md.

## Phase 9 reproducibility

Fresh source-archive extraction, lockfile installation, new native PostgreSQL cluster, migration/repeat seed/reset, both builds/lints, all 131 API/48 frontend/13 unit tests, 91-request Postman run, production startup/preview, and full API process restart passed. Original development data was preserved. Final archive paths/content checksums/private configuration exclusions are verified by package:verify; see docs/SUBMISSION.md and WORK_LOG.md.

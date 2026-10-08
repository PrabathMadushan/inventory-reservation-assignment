# Database foundation and Phase 4 reservations

Source of truth: `apps/api/prisma/schema.prisma` plus the checked-in SQL migration. Prisma CLI generated the tables, enums, keys, and indexes; additional PostgreSQL CHECK constraints are maintained in migration SQL. Use migrations, not `prisma db push`, so those checks are present in every installation.

## Persisted entities

| Table | Purpose and database guarantees |
| --- | --- |
| users | Unique email, password hash, CUSTOMER/OPERATIONS enum |
| products | Exact integer minor-unit price and available stock; nonnegative checks; LKR enum |
| orders | Customer/product foreign keys, product name/price snapshots, positive quantity, exact checked total, status, timezone-aware timestamps |
| order_transitions | Order FK; unique `(order_id, sequence)`; sequence 0 is null→PENDING/ORDER_CREATED; sequence 1 is PENDING→terminal with its matching reason |
| order_idempotency | Primary key `(customer_id, key)`, canonical product ID/quantity, unique resulting order link |
| payment_events | Primary key event ID, order FK, accepted event type/payload and APPLIED/IGNORED result |

All foreign keys restrict deletion. Numeric fields use PostgreSQL BIGINT with CHECK bounds up to `9007199254740991` (JavaScript's maximum safe integer). Quantities are positive; money and stock are nonnegative. The order total check uses PostgreSQL NUMERIC during multiplication to avoid intermediate BIGINT overflow. LKR is the only allowed currency. Product/order serializers convert validated Prisma `bigint` fields to safe JSON numbers; raw Prisma records cannot be JSON-serialized directly.

Timestamps use `TIMESTAMPTZ(3)`. Creation/event timestamps default to database time. Raw terminal SQL explicitly sets updated_at using clock_timestamp and reuses its returned timestamp for history. Order list indexes support customer scope, optional status filtering, and stable `(created_at DESC, id DESC)` ordering; operations have equivalent unscoped indexes. Product/order and payment-event/order indexes support relations. The history primary key supports sequence ordering.

## Transaction and race-handling boundary

NestJS `PrismaService` and the seed use an explicit READ COMMITTED transaction default. Phase 2 verifies the actual PostgreSQL transaction isolation through that service.

Phase 4 implements a READ COMMITTED reservation transaction: unique `INSERT ... ON CONFLICT (customer_id, key) DO NOTHING RETURNING key`; conditional `UPDATE products SET available_quantity = available_quantity - quantity WHERE id = productId AND available_quantity >= quantity RETURNING ...`; immutable order snapshots/server-derived exact total; sequence-0 creation history; and final retry/order link. Every operation uses the same injected transaction client. Unknown products, insufficient stock, overflow, and subsequent failures roll back every write, including the claim. No application-level mutex is used.

The losing unique-key insert waits for the winning transaction to finish. A separate subsequent statement reads the committed claim. Identical input loads the existing order/history without touching stock; changed input returns IDEMPOTENCY_CONFLICT. Replay holds `FOR SHARE` on the order row while loading status/history, so terminal transitions using `FOR UPDATE` cannot interleave those reads. Conditional stock UPDATE waits and rechecks its predicate after a competing commit, preventing two buyers from consuming the last unit. See [PostgreSQL 16 isolation](https://www.postgresql.org/docs/16/transaction-iso.html) and [INSERT conflict behavior](https://www.postgresql.org/docs/16/sql-insert.html).

Customer list/detail use read-only REPEATABLE READ snapshots, an explicit exception to the mutation default, to keep counts/items and status/history consistent. These reads do not supply reservation correctness. They constrain ownership in SQL; pagination sorts by created_at and id descending and handles large beyond-end pages without unsafe offset arithmetic.

Retry `order_id` and event `outcome` can be NULL while a transaction claims the key. Reservation finalizes the retry link and payment finalizes APPLIED/IGNORED before committing; failures roll back rejected requests. The canonical retry product ID intentionally has no product FK: claims precede product validation and roll back for unknown products. Accepted events have an order FK; rejected unknown-order events are not persisted. DUPLICATE is derived from an accepted event, not a new stored outcome.

CHECK constraints restrict transition shapes and unique sequence prevents extra initial/terminal entries. Reservation atomically creates initial history and immutable snapshots. Phase 5 transitions atomically maintain terminal history/status and immutable accepted event payloads.

The order integration suite starts two independent NestJS instances with separate Prisma pools. A test-only transition-service barrier pauses after the first transaction has written stock/order/history; the contender must visibly wait on a PostgreSQL lock in `pg_stat_activity` before release. Tests prove last-unit exclusion, identical-key replay, changed-input conflict, and a waiting claimant succeeding after the first transaction rolls back. Another injected failure after history verifies all four writes roll back. Production has no barrier or fault switch. Fixtures only reset the separate test database.

## Phase 5 terminal transitions and event locks

Payment checks already accepted event IDs before changed-order lookup, verifies new order existence, and claims the event with INSERT ON CONFLICT before locking the order FOR UPDATE. Cancellation locks an owning customer's order FOR UPDATE. Both call one injected OrderTransitionsService. Its conditional UPDATE requires PENDING and returns a timestamp; only a successful update permits atomic stock increment for FAILED/CANCELLED and sequence-1 history. CONFIRMED consumes the reserved stock. History and updated_at share the returned database timestamp. Any later failure rolls back status, stock, history, and event claim/outcome.

Accepted events preserve their original order/type. Identical retries return DUPLICATE with the current locked order status. New events on terminal orders persist IGNORED without stock/history changes. Changed accepted payloads conflict, including changed unknown order IDs. Cancellation of any terminal order returns INVALID_TRANSITION. Creation retries load the latest terminal status/history and never reserve again.

Migration `20261008101652_defer_payment_event_order_fk` makes only the payment event/order FK DEFERRABLE INITIALLY DEFERRED. Its referential integrity is still enforced at commit. An immediate FK check takes FOR KEY SHARE during event INSERT; two callbacks claiming different IDs could each retain that lock before upgrading to FOR UPDATE. Deferral preserves the planned event-claim/order-lock order and avoids that upgrade deadlock. Existing orders are prechecked and then locked; no order deletion endpoint exists. Invalid references still cannot commit. PostgreSQL [row-lock compatibility](https://www.postgresql.org/docs/16/explicit-locking.html) explains the conflicting locks. The schema suite forces this deferred check before its deliberate fixture rollback; another test verifies rejection at actual commit.

Controlled tests observe the PostgreSQL order or unique-event lock across independent NestJS pools for both cancellation/payment winner orders, both payment types, repeated cancellation, duplicate/changed callbacks, distinct events on one order, and a rolled-back first claimant. Concurrent releases of two different orders are held at a shared product row until two waiting increments are observed, then both quantities are restored with no lost update. Production uses no barriers, application mutexes, advisory locks, or fault toggles.

Application-instance restart tests and a separate live API process restart verify durable creation keys, APPLIED/IGNORED events, current status/history, and unchanged stock on replay. Never seed/reset as part of API startup.

## Seed and reset

Demo IDs are stable opaque strings (`user-alice`, `user-bob`, `user-ops`, and named `product-*` IDs). Passwords are independently bcrypt-hashed at cost 12. A reset restores exact assignment values and empties all four workflow tables. Hash salts change on reset; identities and business values are deterministic.

`db:seed` is non-destructive: upserts create missing accounts/products with an empty update clause, so it never replenishes already-reserved stock. Use `db:reset` to restore the specified initial state. Reset explicitly truncates the six assignment tables and seeds within one transaction, without CASCADE. Hashing occurs before opening that transaction.

Root commands load `.env`. Migrate/seed/reset target local `inventory_development`; `db:test:prepare` targets local `inventory_test`. The destructive seed entry point independently refuses remote or differently named databases. Root helpers reject equal development/test database names. Test preparation migrates and resets only the test target; integration fixtures verify preservation and two successive resets using populated test data.

Do not reset while requests are in flight. Stop running API/test processes before regenerating Prisma on Windows to release the query engine DLL.

## Phase 6 operations reads

Operations reuses the same Order serializer and read-only REPEATABLE READ count/items/history snapshots as customer lists/details, without the customer predicate. Customer entry points always supply their authenticated customer ID. The controller enforces OPERATIONS before lookup. Existing unscoped indexes support status filtering and stable created_at/id ordering; no schema or stock/transition write changes were needed. Operations integration tests verify both customers, filtered totals, tied timestamps, huge offsets, and unchanged stock/history/events after reads.

# Engineering decisions

The application implements the assignment's single-product reservation workflow. PostgreSQL is the authority for stock, order states, retry keys, accepted payment events, and transition history. React state controls presentation; it cannot authorize an action or prevent competing reservations.

## NestJS boundaries and frontend composition

AppModule loads validated root configuration and the auth, products, orders, operations, webhook, and Prisma modules. PrismaService owns the connection lifecycle. Controllers enforce authentication/roles, validate DTOs, and return public contracts. OrdersService owns reservation and read transactions. OrderTransitionsService is shared by customer cancellation and WebhooksService so both use the same guarded terminal transition and stock-release rules. OperationsController reuses the exported order read service; it has no separate mutation service. Modules importing JwtAuthGuard also import its Prisma dependency.

The Vite React app separates pages, features, shared layout/UI, API hooks, and centralized Zod schemas. React Query owns server state, React Hook Form owns forms, and AuthProvider holds the session in React state plus the same-tab `inventory.session` entry. Redux is unnecessary for the current state needs. Tailwind/daisyUI provide shared styling. Customer and operations workspaces reuse list/detail/table/pagination/history components; role-specific actions stay in features. Server checks remain authoritative even if someone bypasses navigation.

## Reservation and durable idempotency

POST /orders runs at READ COMMITTED in one bounded transaction. It first claims the database-unique (customerId, key) using INSERT ON CONFLICT. Canonical input is productId plus quantity; prices and identity never come from the browser. The claim stores that input and is finalized with the created order ID in the same transaction.

A competing identical key waits on PostgreSQL uniqueness. A separate statement then sees the committed winner, compares its canonical input, and returns 200 for the same order or 409 IDEMPOTENCY_CONFLICT for changed input. The replay holds FOR SHARE on the order while loading status/history, so a committing terminal transition cannot produce a mixed response. A failed claimant rolls back, allowing a waiting/new attempt to claim the key.

Stock reservation is one conditional SQL UPDATE: decrement available_quantity only where available_quantity >= requested quantity, returning the server product name/price/currency. PostgreSQL serializes competing row updates and rechecks the predicate after waiting. For the last unit, exactly one request creates an order; the other gets INSUFFICIENT_STOCK. No read-then-write stock check, JavaScript mutex, or process-local retry map provides correctness.

The transaction creates immutable product/price/currency snapshots, calculates quantity times price using BigInt, checks the JSON safe-integer bound, appends ORDER_CREATED history, and finalizes the key. Any failure rolls all writes back. New success is 201; identical retry is 200 and returns the current status/history without another reservation.

## Terminal transitions and callback deduplication

Cancellation takes an owning customer's order FOR UPDATE. Payment claims its unique eventId, then takes the same order lock. Only a guarded UPDATE from PENDING can transition to CONFIRMED, FAILED, or CANCELLED. CONFIRMED keeps reserved stock consumed. FAILED/CANCELLED atomically increment live product stock by the reserved quantity once. The terminal history entry uses the returned database update timestamp. Status, release, history, and accepted event outcome commit together.

Callbacks compare an already accepted event's orderId/type before looking up a changed order. Identical accepted or ignored payloads return DUPLICATE with current order status; changed payloads return EVENT_ID_CONFLICT. A new callback for a terminal order persists IGNORED without another transition/release/history. Invalid, unauthorized, unknown-order, or rolled-back requests do not consume the event ID. A lost response can be retried with the identical event ID/payload.

The payment-event/order foreign key is DEFERRABLE INITIALLY DEFERRED. An immediate FK check during event INSERT would retain KEY SHARE before two callbacks upgrade to FOR UPDATE, risking a lock-upgrade deadlock. Commit-time checking preserves referential integrity without that premature lock. The order is prechecked, then locked, and no deletion route exists. Tests force invalid references through actual commit to prove the FK still applies.

Lock order is creation claim then product reservation; replay claim lookup then shared order lock; new callback event claim then exclusive order lock then product release; cancellation exclusive order lock then product release. A losing terminal action cannot release stock. Simultaneous releases for different orders use atomic product increments, avoiding lost updates.

## Contracts, access, constraints, and reads

Seeded passwords are bcrypt hashes. JWTs use HS256 with a private signing secret, fixed issuer/audience, and one-hour expiry. Guards reload identity/current role from PostgreSQL; client role claims cannot elevate access. Customer list/read/cancel queries include authenticated customer ID, returning 404 for another customer's order. Operations routes require OPERATIONS and can inspect all customers; operations cannot use customer-only routes. Webhooks use a configured secret compared through fixed-length SHA-256 digests and timingSafeEqual, independently of bearer authentication.

NestJS DTO validation rejects unknown fields and invalid quantities/queries. Database checks protect stock, positive/safe quantities and amounts, price/total consistency, supported enums, transition shape, foreign keys, unique customer/key/event claims, and unique history sequence. Public serializers convert BigInt only within safe JSON integer bounds and expose UTC timestamps and ordered history without internal keys/events/sequences. One LKR equals 100 minor units.

Lists/details use read-only REPEATABLE READ snapshots so count/items/status/history are consistent during transitions. Mutation transactions remain READ COMMITTED. Customer/status and unscoped operations/status indexes support created_at DESC, id DESC ordering. Deliberate equal-timestamp fixtures verify the tie-breaker. Pagination defaults to page 1/size 10, caps size at 100, computes large offsets using BigInt, and returns empty beyond-end pages with the matching total. Offset pagination is sufficient for this assignment; large-production keyset pagination is not implemented.

## Browser recovery and tradeoffs

The session lives in React state and in the same-tab `sessionStorage` key `inventory.session`, so returning from checkout stays signed in. Sign-out clears that entry and the private caches. The token is not stored in `localStorage`, cookies, or the payment URL. Before creating an order, sessionStorage also persists the account-scoped retry key and canonical input, without the bearer token or password. An uncertain response preserves these for explicit retry, including after reload; a definitive rejection permits a corrected logical request with a fresh key. Mutation retries are manual. Closing the tab loses both entries, so inspect My orders before making another purchase. Cancellation conflicts/uncertain responses trigger current-state discovery; delayed responses after logout cannot restore cleared private data.

A pending customer order can open the optional presentation gateway with **Pay**. The app refetches the order after the redirect and trusts that status. The graded callback remains `POST /webhooks/payments` with the API-only secret, including through Postman when the gateway is not running. No registration, real payment processor, cart, product administration, reservation-expiry job, server-side logout/revocation, refresh tokens, or WebSocket was added. The callback secret never appears in the frontend bundle. The local app/preview and seeded credentials are assignment demonstrations, not a production deployment.

## Production reservation expiry: discussion only

An expiry design would persist an expiresAt deadline and coordinate a worker with the same order-row lock and guarded PENDING transition used by cancellation/payment. Expiry state, one-time stock release, and history would commit atomically. Workers would claim eligible rows through database coordination, tolerate restart/retries, and define exactly which callback wins when payment and expiry contend. Clock policy, batch indexes, retry/error handling, and observability would need explicit decisions. No expiry schema/job/status is implemented because the assignment excludes it.

## Evidence and limits

docs/VERIFICATION.md maps requirements to executable checks. Tests use real PostgreSQL and two independent NestJS apps/pools, observing waiting database locks before releasing controlled barriers. They check persisted stock/order/history/key/event outcomes, rollback, and restarts. Postman is a sequential asserted demonstration, not race proof. docs/WORK_LOG.md records actual results, timing, repairs, AI assistance, and dependency findings. docs/SUBMISSION.md records the clean setup and artifact verification; optional deployment is omitted unless separately completed.

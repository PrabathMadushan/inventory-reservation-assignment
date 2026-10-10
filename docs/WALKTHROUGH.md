# 45-minute assignment walkthrough

Prepare the local application and fresh demo data before the discussion. A full Postman run consumes two keyboard units, so reset before a fresh complete run. Use the isolated Postman runner when preserving existing development orders matters. Never display the private root .env, live tokens, or unredacted filled Postman environment during screen sharing.

| Time | Demonstration and explanation | Code/evidence to open |
| --- | --- | --- |
| 0–5 minutes | Explain assignment scope, install/start commands, three accounts, product prices/stock, and database separation | README; docs/SUBMISSION.md |
| 5–12 | Alice login, product reservation, order snapshots/history, status filter, pending cancellation, returned stock; keyboard/mobile and shared components | CustomerWorkspace, OrderCreateForm, OrderDetail, OrderCancelAction, DataTable |
| 12–17 | Bob's own orders exclude Alice; backend cross-customer read/cancel 404; operations inspect both customers and full history without mutation actions | OrdersController, OperationsController, role/identity guards; Postman ownership/operations folders |
| 17–25 | Postman success/failure, identical retry, changed input conflict, duplicate/ignored/conflicting event, terminal cancel conflict, invalid input, last-unit rejection | Imported collection; automatically captured variables; sanitized examples |
| 25–34 | Explain conditional stock UPDATE, unique durable claims, shared order-row lock, guarded terminal update, atomic release/history, deferred FK; show controlled contention tests | OrdersService, OrderTransitionsService, WebhooksService; orders/transitions test suites |
| 34–39 | Explain safe integer LKR arithmetic, snapshots, strict DTOs, current DB role, REPEATABLE READ list consistency, filtered totals/tie-break ordering | order.serializer, DTOs, schema/migrations; operations tests |
| 39–45 | Present clean-archive setup evidence, measured time/AI use, known limits, production expiry discussion, and questions | docs/SUBMISSION.md, WORK_LOG.md, ENGINEERING.md |

Be ready to answer these using code and observed results:

- Two users buy the last unit: the database update predicate is rechecked after the row wait; one transaction creates one order, and the other returns 409.
- A network response disappears: resend the same customer-scoped key and exact input. Never invent a new key for an unresolved logical attempt.
- Payment and cancellation race: both need the order FOR UPDATE; only PENDING may transition. One terminal history/release outcome commits, and the loser follows the contract.
- Duplicate failed payment: persisted event uniqueness plus terminal state prevents another release. A changed accepted payload conflicts instead of changing the accepted event.
- Two failed orders release the same product: atomic increments preserve both quantities.
- The API restarts: database orders/keys/events/history survive; browser storage is not correctness authority. The same tab restores `inventory.session` after checkout and can recover an unresolved creation intent from sessionStorage. Sign-out removes the session entry. The creation intent does not contain the bearer token.
- Current product prices change: existing orders retain immutable server snapshots.
- Operations tries customer cancellation: the backend role guard rejects it, even if the UI is bypassed.
- Why no background expiry: it is excluded from implementation; the engineering note discusses a persisted deadline and coordinated database transition design.

The developer should read and explain the code independently. The notes prepare the discussion; they do not claim the developer's understanding has been externally assessed or guarantee marks.

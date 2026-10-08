# API contracts

Local base URL: `http://localhost:4000/api`. Requests/responses are JSON. All nine assigned routes are implemented: login, products, customer order creation/list/detail/cancellation, operations list/detail, and the simulated payment webhook.

| Method | Path | Access | Success |
| --- | --- | --- | --- |
| POST | /auth/login | Public, seeded credentials | 200 token/user |
| GET | /products | CUSTOMER or OPERATIONS bearer token | 200 Product items |
| POST | /orders | CUSTOMER, Idempotency-Key | 201 new Order / 200 replay |
| GET | /orders | CUSTOMER, own orders | 200 Page<Order> |
| GET | /orders/:id | Owning CUSTOMER | 200 Order |
| POST | /orders/:id/cancel | Owning CUSTOMER, PENDING | 200 CANCELLED Order |
| GET | /operations/orders | OPERATIONS | 200 Page<Order> across customers |
| GET | /operations/orders/:id | OPERATIONS | 200 Order |
| POST | /webhooks/payments | X-Webhook-Secret | 200 eventId/orderId/outcome/orderStatus |

All amounts and quantities are safe JSON integers. Money is in LKR minor units. Order has exactly id, customerId, productId, productName, quantity, unitPriceMinor, totalMinor, currency, status, createdAt, updatedAt, and history. History entries have exactly fromStatus, toStatus, reason, and occurredAt. Page<Order> has exactly items, page, pageSize, and total. Timestamps are UTC ISO strings. Internal key/event records and sequence numbers are not exposed.

## POST /auth/login

Public. Body must contain exactly `email` and `password`, both strings; email must be valid, password nonempty. Unknown body fields are rejected.

```json
{"email":"alice@example.test","password":"DemoPass123!"}
```

Success: **200** (not 201), exactly:

```json
{"accessToken":"<signed bearer token>","user":{"id":"user-alice","email":"alice@example.test","role":"CUSTOMER"}}
```

The other seeded accounts are `bob@example.test` (CUSTOMER) and `ops@example.test` (OPERATIONS), with the same demo password. Passwords and hashes never appear in responses. Known-user incorrect passwords and unknown-user credentials both return **401** with identical generic feedback:

```json
{"code":"UNAUTHORIZED","message":"Invalid email or password."}
```

Tokens use HS256, issuer `inventory-assignment`, audience `inventory-web`, and one-hour expiry. They carry the user ID as `sub`; protected requests reload the current role/user from PostgreSQL. Missing/invalid/expired tokens or unknown users return 401 UNAUTHORIZED. Changing the configured signing secret invalidates existing tokens. No registration, refresh-token, or server logout endpoint is part of this phase.

## GET /products

Available to either authenticated role. Send `Authorization: Bearer <accessToken>`.

Success **200**: `{items: Product[]}`. Each item has exactly `id`, `name`, `unitPriceMinor`, `currency`, and `availableQuantity`. Numeric values are safe JSON integers; one LKR equals 100 minor units. Items are ordered by name, then ID. Fresh reset includes:

```json
{"id":"product-headphones","name":"Limited Edition Headphones","unitPriceMinor":2500000,"currency":"LKR","availableQuantity":1}
```

The endpoint reads live stock without changing it. Product query parameters/pagination are not defined by the assignment contract.

## Errors and access controls

Errors consistently contain `{code, message}`. Invalid request fields return **400 VALIDATION_ERROR**, absent/invalid identity returns **401 UNAUTHORIZED**, and a valid identity with a disallowed role returns **403 FORBIDDEN** on role-restricted routes. Customer order routes apply authentication and CUSTOMER role guards. Ownership is constrained in the database query. Test-only authorization probes are not part of the running application.

CORS allows only the configured frontend origin, GET/POST/OPTIONS, and Content-Type/Authorization/Idempotency-Key headers. Payment callbacks are demonstrated through an API client such as Postman; the webhook secret is never included in the frontend. Internal failures return generic **500 INTERNAL_ERROR** without database/secret details.

GET `/api` remains the Phase 1 database connection diagnostic and is public. Unknown routes return **404 NOT_FOUND**. It does not replace the assignment's business APIs.

## POST /orders

CUSTOMER only. Send the bearer token and a nonempty `Idempotency-Key` header. Body contains exactly:

```json
{"productId":"product-keyboard","quantity":2}
```

Product ID is an opaque string containing a non-whitespace character. Quantity must be a positive JSON safe integer. Strings, booleans, fractions, missing fields, and extra price/status/customer fields are rejected. Identity comes from the verified token. Prices/name/currency come from PostgreSQL and total is calculated exactly on the server. A total above 9007199254740991 returns 400 and rolls back.

Success: **201 Order** for a new reservation, **200 Order** for an identical retry using the same customer's key. Response format (illustrative ID/timestamps):

```json
{
  "id":"<order ID>", "customerId":"user-alice",
  "productId":"product-keyboard", "productName":"Mechanical Keyboard",
  "quantity":2, "unitPriceMinor":1500000, "totalMinor":3000000,
  "currency":"LKR", "status":"PENDING",
  "createdAt":"2026-10-08T10:00:00.000Z", "updatedAt":"2026-10-08T10:00:00.000Z",
  "history":[{"fromStatus":null,"toStatus":"PENDING","reason":"ORDER_CREATED","occurredAt":"2026-10-08T10:00:00.000Z"}]
}
```

History is ordered by its internal sequence, which is not exposed. Money/quantity fields are JSON numbers; timestamps are UTC ISO strings. Name/price/currency are immutable snapshots. Retries return the current existing order/history without reserving again.

| Failure | Status/code | Retry-key effect |
| --- | --- | --- |
| Missing/empty key, malformed body or total overflow | 400 VALIDATION_ERROR | No committed claim |
| Unknown product | 404 NOT_FOUND | Claim rolled back |
| Insufficient stock | 409 INSUFFICIENT_STOCK | Claim rolled back |
| Same customer/key, changed product or quantity | 409 IDEMPOTENCY_CONFLICT | Original order preserved |

Keys are scoped to customers; Alice and Bob may independently use the same text. Stock decrement, key claim/finalization, order, and initial history commit together. PostgreSQL locks/uniqueness coordinate competing requests. After an uncertain response or 500, explicitly resend the same key/input to discover whether the first request committed. Frontend mutation retries are manual.

## GET /orders

CUSTOMER only, own orders only. Optional `page` (default 1), `pageSize` (default 10, maximum 100), and `status` (`PENDING`, `CONFIRMED`, `FAILED`, `CANCELLED`). Page/size accept decimal digit strings representing positive safe integers. Fractions, negatives, repeated parameters, unknown fields, and lowercase/unknown statuses return 400.

Success **200**: `{items: Order[], page, pageSize, total}`, including each order's history. Ordering is `createdAt DESC, id DESC`; total uses the same customer/status filter. Beyond-end pages return an empty items array with the filtered total. Read-only PostgreSQL snapshots keep count, rows, status, and history consistent within a request.

## GET /orders/:id

Owning CUSTOMER only. Success **200 Order**, including snapshots/history. Unknown IDs and another customer's IDs both return **404 NOT_FOUND**. OPERATIONS receives 403 on all customer order routes.

## POST /orders/:id/cancel

Owning CUSTOMER only; bearer authentication required. Send an empty body or `{}`. Extra fields and arrays return 400 VALIDATION_ERROR. The order is locked and its current state checked in PostgreSQL.

- PENDING: **200 Order**, now CANCELLED, with full initial/terminal history. Reserved quantity returns to live stock exactly once. Terminal history reason is CUSTOMER_CANCELLED.
- Already CONFIRMED, FAILED, or CANCELLED: **409 INVALID_TRANSITION**; no writes. A repeated cancellation is a conflict, not a second successful transition.
- Unknown/another customer's order: **404 NOT_FOUND**. Missing/invalid token: 401. OPERATIONS: 403.

The stock increment, state/timestamp update, and terminal history commit together. On an uncertain response, refresh the order; another cancellation cannot release stock again. The frontend shows this action only for PENDING and refreshes after conflicts or uncertain failures.

## GET /operations/orders

OPERATIONS only; bearer authentication required. Returns **200 Page<Order>** across all customers. Uses the same strict query validation and public Order/history contract as GET /orders: page defaults to 1, pageSize to 10 (maximum 100), and optional status must be uppercase PENDING, CONFIRMED, FAILED, or CANCELLED. Unknown fields (including customerId), repeated parameters, and invalid integers return 400 VALIDATION_ERROR.

The total counts all orders matching the status filter; items sort by createdAt descending then ID descending. Beyond-end pages return an empty items array with the matching total. Count, items, and history use one read-only REPEATABLE READ snapshot. Missing/invalid token returns 401; either CUSTOMER account receives 403 before order lookup. Reading orders does not mutate stock, events, or history.

## GET /operations/orders/:id

OPERATIONS only. Returns **200 Order** for any customer's order, including customerId, product snapshots, amount, timestamps, and full ordered transition history. Unknown IDs return 404 NOT_FOUND. Missing/invalid token returns 401; CUSTOMER receives 403. Operations have no order mutation route and remain blocked from customer-only creation/list/detail/cancellation routes.

The frontend reuses the customer list/detail components with separate role/account query keys and operations API paths. Operations details have no cancellation action. Filter and page survive inspection/back navigation; changing status resets page to 1. Payments remain API/Postman demonstrations.

## POST /webhooks/payments

Send `X-Webhook-Secret` equal to the API's configured WEBHOOK_SECRET. No bearer token is required. Missing/wrong secrets return **401 UNAUTHORIZED** before accepting an event. Exact JSON body:

```json
{"eventId":"demo-payment-1","orderId":"<existing order ID>","type":"PAYMENT_FAILED"}
```

Event/order IDs are nonempty opaque strings with a non-whitespace character. Type is exactly PAYMENT_SUCCEEDED or PAYMENT_FAILED. Missing/invalid/extra fields return 400 without consuming the event ID. A new event referencing an unknown order returns 404 without persistence.

Success is always **200**, exactly `{eventId, orderId, outcome, orderStatus}`:

| Case | Outcome | Effect |
| --- | --- | --- |
| New event on PENDING, PAYMENT_SUCCEEDED | APPLIED | CONFIRMED; reserved stock stays consumed; one PAYMENT_SUCCEEDED terminal history |
| New event on PENDING, PAYMENT_FAILED | APPLIED | FAILED; stock restored once; one PAYMENT_FAILED terminal history |
| New event on a terminal order | IGNORED | Event persisted; order/stock/history unchanged |
| Same accepted event ID and identical orderId/type | DUPLICATE | Current order status returned; no additional history or stock change |
| Same accepted event ID with changed orderId/type | 409 EVENT_ID_CONFLICT | Accepted payload preserved; no writes |

An accepted event reused with a changed unknown orderId returns EVENT_ID_CONFLICT before resolving the changed order. IGNORED events are durable too: replay becomes DUPLICATE and payload changes conflict. Rejected requests and rolled-back failures do not consume event IDs.

New event claim, locked guarded transition, stock release if needed, history, and APPLIED/IGNORED outcome commit atomically. Cancellation and callbacks serialize on the same database order-row lock. Retry the same event ID and payload after an uncertain result; persistence survives API restart. Simulated payment triggering belongs in Postman/API demonstrations, not the customer frontend.

## Runnable request examples

The Postman Collection v2.1 export in postman/inventory.postman_collection.json covers all nine assigned routes, access restrictions, retries/conflicts, payment/cancellation outcomes, filtering/pagination, stock effects, and validation failures. Every request includes one actual captured response example; login tokens are redacted. The placeholder environment and automatic token/product/order capture avoid manual copying. See postman/README.md for local setup and isolated Newman verification.

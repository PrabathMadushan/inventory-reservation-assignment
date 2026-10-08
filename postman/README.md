# Assignment Postman walkthrough

Import **inventory.postman_collection.json** and **local.postman_environment.json** into Postman. The collection is our own Collection v2.1 export, with nine ordered folders, 91 requests, and 182 assertions. Every request includes a captured response example from the implemented API. Login tokens in examples are redacted; request authentication and credentials remain variable placeholders. Example order IDs/timestamps are real nonsecret captured values, not identifiers to copy into requests.

## Configure and run in Postman

1. Start the application using the root README. Use a fresh seed for a complete run: stop API processes on Windows if client generation is needed, then run `npm run db:reset` and `npm run dev`. **db:reset deletes development assignment data.** Use the isolated runner below when you want to preserve existing demo orders.
2. Select the imported local environment. Set baseUrl to `http://localhost:4000/api` (it includes `/api`). The three email variables already contain seeded addresses.
3. Replace alicePassword, bobPassword, and opsPassword with the seeded demo password `DemoPass123!`. Replace webhookSecret with WEBHOOK_SECRET from your ignored root `.env`. Keep these values local; do not share/export the filled environment. Secret variable types are marked in the export.
4. Use Collection Runner to run **all folders once, in order**. No manual bearer token, product ID, order ID, key, or event ID copying is required. Running isolated requests out of order will lack prerequisite variables.
5. Check all assertions. The collection checks fresh seed stock/empty orders at the start and stops being a reproducible demonstration if rerun against its previous mutated data. Reset before each complete run; fresh keys alone do not restore consumed stock.

Tokens, IDs, seed snapshots, keys, and events use run-local `pm.variables`, not exported environment or collection variables. Each new logical order/event gets a UUID. Retry/duplicate/conflict requests deliberately reuse its variable. A subsequent complete run generates fresh keys/events and logs in again.

## Folder order and effects

| Folder | What it proves |
| --- | --- |
| 01 Login and seed | All three accounts; exact five products/prices/stocks; empty Alice orders |
| 02 Reservation/ownership | Keyboard quantity 2; identical 200 retry; changed quantity/product conflict; one stock reservation; Alice/Bob isolation and customer role restrictions |
| 03 Payment success | APPLIED then DUPLICATE; new terminal event IGNORED and replayed; changed type/order conflicts; terminal cancellation rejected; creation replay returns current history |
| 04 Failure | Hub reservation and PAYMENT_FAILED; stock released once after repeated callback |
| 05 Cancellation | Stand cancelled once; repeat conflict; later callback ignored; Bob creates his own mouse order |
| 06 Operations | Both customers visible; each uppercase status filter; stable two-page ordering/counts; empty beyond-end page; full detail/history; operations blocked from every customer route; Bob cancels his mouse order |
| 07 Errors | Invalid quantities/body/key/query, unauthenticated/bad-token/bad-login, unknown resources, wrong webhook secret, malformed callback, unknown-order event and corrected reuse |
| 08 Last unit | Reserve one-unit headphones; Bob gets INSUFFICIENT_STOCK; owning cancellation restores the unit |
| 09 Final state | Five orders: one CONFIRMED, one FAILED, three CANCELLED; original keyboard snapshots/history; stock reflects terminal outcomes |

Final fresh-run database state: five orders and creation keys, ten history entries, five accepted payment events, no incomplete keys/events. Keyboard stock is 18; hub/stand/mouse are 20; headphones are 1. This is a sequential API walkthrough. Controlled multi-connection concurrency is proved by the PostgreSQL test suites in docs/VERIFICATION.md.

## Isolated compatible-runner verification

The checked-in Node runner uses pinned Newman and the same exported collection. It reads local configuration in memory, validates the collection against the included official Postman v2.1 schema, resets only the named localhost **inventory_test**, starts a temporary built NestJS API on an available port, supplies credentials/secret in memory, runs assertions, checks actual database invariants, and stops the temporary API. It never resets inventory_development. Do not run it simultaneously with API integration tests, since both own test fixtures.

From the workspace root, with PostgreSQL running:

```sh
npm run build
npm run postman:validate
npm run postman:test
```

Stop API processes before the build on Windows to avoid Prisma DLL locks. `postman:test` does not modify exported artifacts; it leaves its five demonstration orders in the isolated test database for inspection. The next run resets that test database automatically. It needs no paid account or Postman desktop installation and makes no external API requests.

To regenerate scenarios or refresh captured examples after an API change:

```sh
npm run postman:generate
npm run postman:capture
npm run postman:validate
```

Generation preserves existing examples by request name and regenerates the placeholder environment. Capture runs from fresh isolated seed and replaces examples only after every assertion and database check passes. Responses come directly from Newman executions. Only the captured Content-Type response header is retained; original requests use the sanitized template, and accessToken is replaced with `<redacted access token>`. No filled environment, Newman runtime report, bearer header, private URL, or secret is written to the exports. Validation rejects JWTs/private configuration and checks every request has one example.

The JSON schema is copied from Postman's official `https://schema.getpostman.com/json/collection/v2.1.0/collection.json` endpoint under tools/schemas, so validation remains offline. Newman/JSON-schema packages are development tooling. No payment button, payment administration feature, or new application endpoint was added.

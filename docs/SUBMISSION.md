# Local submission

Submit `.local/submission/inventory-assignment-source.zip`. It extracts into `inventory-assignment/`; start with README.md. The private source repository is [PrabathMadushan/inventory-reservation-assignment](https://github.com/PrabathMadushan/inventory-reservation-assignment), on branch main. Use the ZIP when the reviewer does not have repository access. The ZIP includes both apps, migrations/schema/seed/reset, tests, setup tools, environment examples, lockfile, engineering/API/verification/walkthrough notes, work log, implementation plan, sanitized Postman collection/environment, and the optional presentation gateway source (`gateway/Cargo.toml`, `gateway/src`, `gateway/README.md`).

Dependencies, builds, `gateway/target`, database files, private .env files, runtime tokens, logs, and temporary evidence are excluded. `npm run package:source` rebuilds the ZIP and a SHA-256 per-file manifest; `npm run package:verify` checks archive paths, counts, contents against that manifest, and private-configuration/JWT exclusion. These packaging commands require PowerShell 7 on Windows; running the delivered application uses the normal Node/PostgreSQL prerequisites. The archive and external manifest are generated outputs, not source files to include recursively.

## Clean setup verification

The source archive was extracted into a separate folder without node_modules, builds, .env, or database data. Verification uses a newly initialized PostgreSQL 16.1 cluster, separate from the retained developer cluster. To avoid port conflicts, the extracted copy's generated private .env uses database 5434, API 4002, and frontend origin/API preview 5174. Database names remain inventory_development and inventory_test, matching the setup/test safety guards. The default submission ports remain 5433/4000/5173.

Final measured results are recorded in WORK_LOG.md. The extracted copy passed:

| Check | Result |
| --- | --- |
| npm ci --include=optional | Fresh installation passed; Prisma client generated |
| setup:env / db:init | Fresh private configuration and separate native cluster created |
| db:migrate / db:seed twice / db:reset | Both migrations applied; repeat seed preserved data; reset produced 3 users/5 products/no orders |
| build / lint | Both production builds and both lints passed |
| Unit / frontend / PostgreSQL API | 13 / 48 / 131 tests passed |
| Postman validate / test | Schema/export checks passed; 91 requests/182 assertions passed; persisted stock/history/event invariants held |
| Production API / frontend preview | Seeded logins, empty-order start, reservation/cancellation/returned stock, ownership, operations detail, CORS, and built asset/configuration checked |
| Full API process restart | Same creation key returned the retained CANCELLED order/history without reserving again |
| Final source identity | 100 application/schema/test files matched the tested extracted copy; repaired web lint script also matched |
| Original environment | Original 3 orders/keys, 6 history entries, 2 payment events and seed stocks preserved |

The clean exercise verifies the installed application source; final documentation/progress entries and packaging tooling were refreshed afterward without changing that tested application source. Web lint was made explicit (`oxlint --no-ignore src vite.config.ts`) so extraction under an ignored parent directory still checks the intended source files.

On 10 October 2026 the current workspace passed 14 API unit tests and 53 frontend tests. The PostgreSQL API suite (131) and Postman run (91 requests / 182 assertions) were not repeated; those remain the last measured results from the clean-copy exercise above.

This is an extracted source-archive verification, not a remote-clone verification claim. Original developer data is preserved. The temporary clean cluster is stopped after verification; its generated private configuration and files remain ignored under .local for recovery of evidence.

## Known limits and disclosure

- Hosted demo: https://app.prabhathmadhushan.cv with API base https://api.prabhathmadhushan.cv/api. Sign in with alice@example.test, bob@example.test, or ops@example.test and password DemoPass123!. The local webhook secret is local-demo-webhook-secret. The hosted webhook secret stays in the API server environment and is not published. On 9 October 2026, Alice reserved and cancelled a USB C Hub in the hosted UI; Bob's list did not show it; operations filtered PENDING and opened it with customer id user-alice. Order a5bb58fc-c23e-44d4-b257-97702531451e survived an API restart without reseed, an idempotency retry returned the same order, and cancellation restored stock. A wrong webhook secret returned 401; the configured secret then returned IGNORED and a replay returned DUPLICATE. Deploy steps are in the README. Local production-mode startup is separate from this hosted demo. A guaranteed score is not claimed.
- Authentication is the assignment's seeded bearer-token flow. The same browser tab also keeps the session in `sessionStorage` (`inventory.session`) so a return from checkout stays signed in. Sign-out removes it. The token is not stored in `localStorage`, cookies, or the payment URL. Server-side revocation, refresh tokens, registration, and password recovery are outside scope.
- A pending customer order has **Pay**. It calls the optional presentation gateway, then the app refetches the order and shows success only when the status is `CONFIRMED`. The graded payment path remains `POST /webhooks/payments`. Postman can complete payment when the gateway is not running. The archive includes the gateway source; `gateway/target` is excluded. No real payment processing or reservation expiry is implemented.
- sessionStorage also preserves an unresolved creation intent, without the bearer token, only within its browser tab. Closing the tab loses it; inspect My orders before another logical purchase.
- Concurrency tests use independent NestJS apps and pools in one Jest process. Full API process restart was separately demonstrated. No production mutex or in-memory deduplication store is used.
- The dependency audit still has known findings, including development tooling. Phase 8 removed the critical Handlebars finding introduced by Newman through a patched override; it did not perform unrelated framework/tool upgrades. The work log records counts. No clean-audit or production-security claim is made.
- No paid service is needed. Windows/Node 22/PostgreSQL 16 are the verified environment; other operating systems were not exercised. Native PostgreSQL helpers need installed binaries and an ordinary user; Linux initdb cannot run as root.
- Earlier planning time was not measured. The work log records measured implementation time and excludes idle gaps. Do not claim an independently verified total covering unmeasured planning time.
- OpenAI Codex helped with requirements/planning, scaffolding/tools, implementation, tests, documentation, Postman capture, and packaging. WORK_LOG.md identifies contributions, repairs, and verification. The developer must review and understand the code; a guaranteed score or an externally assessed walkthrough is not claimed.

## Reviewer route through the artifacts

1. README: exact setup/configuration, commands, account/product details, and Postman entry points.
2. docs/API.md: all nine assigned routes, public models, headers, access, pagination, transitions, and errors.
3. docs/ENGINEERING.md and docs/DATABASE.md: transaction/lock/constraint decisions and expiry discussion.
4. docs/VERIFICATION.md and executable tests: requirements mapped to real PostgreSQL and frontend evidence.
5. postman/README.md and exports: automated variable capture, 91 asserted requests, real redacted examples, repeatable isolated run.
6. docs/WORK_LOG.md and IMPLEMENTATION_PLAN.md: actual effort, AI use, completed gates, repairs, and limitations.
7. docs/WALKTHROUGH.md: the 45-minute discussion preparation.

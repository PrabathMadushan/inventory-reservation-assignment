# Work log and verification

Times use Asia/Colombo (UTC+05:30). The assignment's total budget is 12 working hours including planning and documentation.

## Planning before Phase 1

Read all four assignment pages, created the phased plan, and revised it to show standard NestJS conventions and database-level concurrency control. Precise earlier active working time was not recorded; include it in the final actual total when established from available session records. Do not report it as zero.

## Phase 1 - Foundation and runnable setup

- Started: 2026-10-08 10:28:33.
- Ended: 2026-10-08 11:04:42.
- Measured session duration: 36m 9s elapsed; includes generator/download waits, network/install repairs, verification, and documentation.
- Generated the NestJS app using Nest CLI 11.0.16 and the React TypeScript app using create-vite 9.2.1.
- Generated NestJS feature modules and Prisma service through CLI commands.
- Initialized the Prisma configuration/schema through its CLI; kept the schema free of domain models for Phase 1.
- The initial Nest CLI 12 attempt reported transitive generator Node engine incompatibilities; stopped it before any application was scaffolded, then used the compatible CLI 11 generator.
- Added npm workspace scripts, root configuration examples/private local environment generation, isolated native PostgreSQL development/test setup, NestJS configuration/validation/CORS/error foundation, Prisma lifecycle integration, and a minimal React connection-status page.
- Docker was installed but its daemon was unavailable. Native PostgreSQL 16 was available, so no machine-wide database service or Docker configuration was changed.
- Workspace instructions refer to `RTK.md`; it remained absent from the workspace and parent directories inspected.

### Verification

| Check | Actual result |
| --- | --- |
| Clean install of final dependency set | `npm ci --include=optional --no-audit --no-fund` passed; client generated in postinstall |
| Lockfile integrity metadata | Zero incomplete dependency entries after reconstruction and final install |
| Production builds | `npm run build` passed for NestJS and React/Vite |
| Lint | `npm run lint` passed for both workspaces |
| Configuration unit checks | `npm test`: 10 passed |
| Real PostgreSQL API integration | `npm run test:api:e2e`: 4 passed; asserted actual test database name, JSON/prefix, errors, CORS |
| Database setup/repeat/restart | `db:init` repeated without resetting data; `db:stop`, `db:start`, `db:check` passed for both databases |
| Environment setup repeat | Existing .env hash unchanged after `setup:env` |
| Live API | GET http://localhost:4000/api returned 200 with status ok and database connected |
| Browser preview and development startup | Production preview and final `npm run dev` page displayed Application connected after reload |
| Browser secret separation | Database URLs, JWT secret, and webhook secret absent from the built frontend JavaScript |

Install/debugging evidence: interrupted downloads left incomplete dependency files and lock metadata; the first build failed and an initial reinstall encountered ECONNRESET. Reconstructed the lockfile from clean copies of the workspace manifests, then completed clean installs. Pinned `@nestjs/config` to 4.0.2 because the ESM-only 12.x release could not load through Jest on Node 22. Used explicit Jest environment parsing before AppModule import; allowed 30 seconds for real application/database fixture initialization after a cold-start hook exceeded Jest's default 5 seconds. Final integration assertions passed without removing or weakening them.

Development servers remain running on 5173/4000, and the isolated PostgreSQL cluster remains running on 5433. The generated source is ready for Phase 2.

### Scope and limitations

No domain tables, migrations, demo seed, customer/operations authentication, products/orders, payment processing, concurrency proof, final frontend flows, or Postman submission yet. These remain in their planned phases. No cloud deployment or paid service was used.

Automatic approval review rejected recursive cleanup of the temporary lockfile workspace with reason "blocked by policy". That folder remains under ignored `.local/lockfile-workspace`; exclude `.local` (including local database files) from any source ZIP. This does not prevent the application or verification commands from running.

## Phase 2 - Schema, migrations, deterministic reset and seed

- Started: 2026-10-08 11:06:59 Asia/Colombo.
- Ended: 2026-10-08 11:20:03 Asia/Colombo.
- Measured session duration: 13m 4s elapsed, including implementation, repairs, verification, and documentation. Measured Phases 1–2 total: 49m 13s; earlier planning duration remains to be established.
- Added six Prisma models, assignment enums, foreign keys, unique customer/key and payment event ID constraints, unique history sequence, and indexes for customer/operations filtering and stable pagination.
- Generated the initial migration through Prisma CLI using `--create-only`, added authoritative PostgreSQL CHECK constraints, then applied it to both initially empty databases using `migrate deploy`.
- Persisted exact BIGINT money/quantities with safe JSON integer bounds, checked server-total arithmetic, and timezone-aware timestamps. Documented conversion requirements for the later API DTOs.
- Set PrismaService and seed transaction defaults explicitly to READ COMMITTED. Added independently bcrypt-hashed demo passwords at cost 12 and stable opaque seed IDs.
- Added migrate, non-destructive seed, destructive local demo reset, and separate test-preparation commands. Reset truncates only the six assignment tables without CASCADE and restores data in one transaction. Repeated seed preserves stock and existing workflow data.
- Added 19 real-PostgreSQL schema/seed tests. Existing four API foundation integration tests and ten configuration unit tests remain intact.
- Updated README, database notes, and phased plan; authentication, order reservation, payment/cancellation, and final frontend remain unimplemented.

### Verification

| Check | Actual result |
| --- | --- |
| Initial migrations | Applied successfully to empty development and test databases; repeat deploy reported no pending migrations |
| Production builds | NestJS and React/Vite builds passed |
| Lint | Both workspaces passed; seed TypeScript included in API lint scope |
| Unit tests | 10 passed |
| Real PostgreSQL integration | 23 passed: 19 schema/seed + 4 foundation API |
| Exact demo dataset | Three accounts with expected roles, five products with exact prices/LKR/stock, bcrypt password matches, zero workflow rows |
| Reset repeatability | Development reset completed twice; automated test resets twice after populated workflow fixtures and asserts exact initial data |
| Non-destructive seed | Two test seed runs preserved zero remaining headphones stock and an existing order; development seed also passed |
| Direct SQL enforcement | Negative/unsafe stock, zero/negative/unsafe quantity, negative price, inconsistent total, duplicate keys/events/history, invalid history, and unknown foreign keys rejected |
| Isolation | Actual transaction through NestJS PrismaService reported read committed |
| Destructive target guards | Remote reset, equal development/test names, and direct remote seed/reset rejected before database operations |
| Index inspection | Expected customer/operations pagination and retry/event/history indexes present in PostgreSQL |
| Final development state | SQL counts: users 3, products 5, orders/transitions/retry records/events 0 |
| Dependency lock metadata | Zero incomplete dependency entries after adding pinned bcrypt/types |
| Restart smoke check | API returned status ok / database connected; frontend returned HTTP 200 on 5173; both development servers remain running |

Repair evidence: Windows initially refused replacing the loaded Prisma engine DLL while the dev API was running, and a build overlapping integration tests hit the same lock. Stopped development processes and completed client generation/build before database tests, then restarted the apps. Three first-run duplicate-key assertions expected constraint names that Prisma omits; corrected them to assert PostgreSQL SQLSTATE 23505 and the exact reported key fields. CHECK/FK assertions still verify SQLSTATE and named constraints. Lint caught an unused destructured hash variable, which was removed. Final checks passed without disabling checks.

Database uniqueness and checks are complete for Phase 2. Correct concurrent reservation, immutable snapshot/event handling, finalized retry/event claims, terminal state transitions, and stock release remain responsibilities of the later transactional handlers and concurrency tests. No application mutex or new feature outside the assignment was introduced.

## Phase 2 revision - Frontend state and centralized validation

User clarified that only the completed Phase 2 should be revised; Phase 3 is not authorized by this request. Updated the plan before implementation, then recorded completion afterward.

- Measured revision interval: 2026-10-08 14:35:48–14:41:26 Asia/Colombo, 5m 38s elapsed.
- Measured implementation total including Phases 1–2 and this revision: 54m 51s; earlier planning time remains to be established. The idle interval between requests is not counted as working time.

- Installed pinned React Query 5.104.1, React Hook Form 7.89.0, Zod 4.6.5, and resolver integration 5.9.1. Added Vitest 5.0.3 for frontend verification.
- Replaced the connection-check useEffect/local request state with one QueryClient/provider and a typed, cancellable query hook. Added manual refresh with accessible feedback and visible keyboard focus.
- Added centralized login/order Zod schemas, inferred input types, and React Hook Form options/resolvers. Forms themselves remain in Phases 3–4. Quantity validation rejects strings, booleans, fractions, zero, negatives, and unsafe integers; strict objects reject caller-supplied prices/roles. Password characters are preserved.
- Added centralized connection/API-error response schemas and typed API errors, including safe fallback handling for non-JSON failures. Fetch and body-reading cancellation are preserved.
- Configured at most one retry for transient reads, no client-error retry, no automatic mutation retry, and no window-focus refresh. Documented later authentication-cache cleanup and mutation invalidation obligations.
- Redux/RTK Query was not added because current state needs are covered by React Query and React-local state. No database migration/reset or backend endpoint change was made in this revision.

### Verification

| Check | Actual result |
| --- | --- |
| Frontend production build | Passed with TypeScript and Vite |
| Lint | Both workspace lints passed; frontend lint rerun after final changes passed |
| Frontend tests | 26 passed across schemas/resolvers, API/query behavior, and offline initial UI |
| Existing backend unit tests | 10 passed |
| Browser | Application connected; manual refresh returned to the connected state |
| Database/API smoke | Both database connections passed; existing API returned status ok/database connected |
| Dependency lock | Zero incomplete dependency entries |

Code review caught two edge cases before completion: a paused initial query must not render connected, and an abort while reading JSON must not become an invalid-response error. Added focused regression checks for both and verified the final build/tests/lint. Login/order forms, authentication, and race-safe reservation handlers remain in their scheduled phases.

## Before Phase 3 - Shared components and Tailwind/daisyUI

- Measured interval: 2026-10-08 14:45:37–14:51:09 Asia/Colombo, 5m 32s elapsed.
- Measured implementation total: 1h 00m 23s; earlier planning time remains to be established. Idle intervals between requests are excluded.
- Updated the plan before implementation and recorded completion afterward. Phase 3 remains unstarted.
- Installed pinned Tailwind CSS/Vite integration 4.3.3 and daisyUI 5.7.47. Migrated styles to Tailwind utilities/daisyUI components with one emerald theme; removed the former App.css.
- App composes AppShell and FoundationPage. FoundationPage composes PageHeader and the ConnectionCard feature; ConnectionCard owns React Query state and refresh actions. Shared UI has Button, Loading, Feedback, EmptyState, FormField, and typed DataTable.
- Added linked labels/hints/errors, preserved input registration, disabled busy buttons, announced loading/status/error feedback, reduced-motion spinner classes, visible focus, a skip link, and semantic table captions/headers with keyboard-accessible horizontal scrolling. Increased muted text contrast during visual review.
- Kept generic visual components independent of API/form/domain state. Tables are prepared for scheduled list screens; no component showcase, login/order screen, or backend feature was introduced.

### Verification

| Check | Actual result |
| --- | --- |
| Frontend production build | Passed with Tailwind Vite plugin and daisyUI CSS output |
| Frontend lint | Passed, including final component changes |
| Frontend tests | 32 passed; six added shared-component checks supplement the existing 26 |
| Browser refresh | Application connected after manual refresh |
| Mobile layout | 375px viewport and document width both 375px; readable stacked layout, no horizontal overflow |
| Desktop layout | 1280px viewport and document width both 1280px; two-column layout, no horizontal overflow |
| API smoke | Existing API returned status ok/database connected |
| Dependency lock | Zero incomplete dependency entries |

Temporary browser viewport overrides were reset. Preview capture is ignored under `.local/ui-foundation-preview.png`; the source deliverable does not need it. Backend/database files were unchanged, so database resets and concurrency tests were not rerun for this styling/component revision. Required race-handling tests remain in their planned phases.

## Phase 3 - Authentication, product API, and shared login UI

- Started: 2026-10-08 14:52:58 Asia/Colombo.
- Ended: 2026-10-08 15:11:40, 18m 42s measured elapsed including implementation, repairs, final verification, and documentation.
- Measured implementation total: 1h 19m 5s; earlier planning duration remains to be established. Idle intervals are excluded.
- Generated NestJS auth/products controllers and services with Nest CLI, then implemented the injected services, DTO, guards, decorators, and module wiring.
- Added POST /api/auth/login (200, exact public contract), bcrypt credential verification with a dummy comparison for unknown accounts, and generic invalid-credential responses. Configured private-secret HS256 JWT signing/verification with issuer/audience and one-hour expiry.
- Added bearer authentication that reloads the current identity/role from PostgreSQL. Added exported role guards/decorators and current-user access for later order routes. Client role/customer identity fields are rejected by login DTO validation, and token role claims are not trusted.
- Added authenticated GET /api/products for both roles, explicit field selection, stable name/ID ordering, and checked bigint-to-safe-JSON-number conversion.
- Extended the shared frontend API client with schema-validated responses, bearer headers, JSON submissions, and readable errors. Added centralized login/user/product response schemas.
- Composed login using React Hook Form and the central Zod resolver with shared fields/buttons/feedback/layout. Added customer/operations workspace navigation and shared product table with LKR display, loading/error/empty states, and manual refresh. Order tabs explicitly remain placeholders.
- AuthProvider uses React memory only. Reload requires re-login; sign-in/logout clears query/mutation data, cancels active queries, and separates product caches by user. Login mutation retries are disabled and inactive credential variables are not retained. Unauthorized product sessions return to login.
- Added partial implemented API documentation and updated README/plan. No order, cancellation, webhook, reservation, or extra authentication feature was implemented.

### Verification

| Check | Actual result |
| --- | --- |
| Production builds | NestJS and React/Vite passed |
| Lint | Both workspaces passed |
| Backend unit tests | 13 passed (10 configuration + 3 exact-integer checks) |
| Real PostgreSQL/API integration | 43 passed (20 auth/product/role + 19 schema/seed + 4 foundation) |
| Frontend tests | 36 passed, including four DOM login/account/session scenarios |
| Seeded logins | Alice, Bob, and operations each returned 200 and exact public fields; no password/hash leakage |
| Invalid requests/access | Incorrect/unknown credentials, strict DTO validation, malformed/missing tokens, expiry, signature, algorithm, audience, and unknown identity checked |
| Role enforcement | Both directions checked through real guards on test-only routes; forged role claim denied; current DB role honored and fixture restored |
| Products | Both roles received all exact seed fields as safe JSON numbers |
| Browser | Empty-form validation, Alice login and product prices/stock, logout, operations login/navigation, placeholder navigation, and product return verified |
| Mobile | Login and authenticated product views fit 375px; page content width did not exceed viewport; table scrolling remains local to its focusable region |
| Secret separation | Database URLs, JWT secret, and webhook secret absent from built frontend JavaScript |
| Live API boundaries | Test authorization probe routes returned 404 in the live application |
| Development database | Still exactly 3 users/5 products, no orders/retry/history/event rows |
| Dependency lock | Zero incomplete dependency entries |

Repair evidence: the newest @nestjs/jwt release was ESM-only and failed in the existing CommonJS Jest/Node 22 setup. Pinned the NestJS-compatible 11.0.2 release and reran integration checks successfully. Lint caught unsafe test response access, replaced with typed public response assertions. Split AuthProvider from its context/hook to keep React Fast Refresh exports clean; all final lints passed. Existing backend/frontend regression tests remain enabled.

Final frontend review simplified the shared fetch options and increased inactive navigation label contrast; frontend build, all 36 tests, and lint passed afterward. Development hot reload returned the in-memory session to login as expected; the final preview shows the login form.

Scope limitations: order routes and transactional race handling remain Phase 4–5 work. Role guards are tested independently of frontend navigation, but later business controllers must apply them. Logout clears the browser session only; tokens remain valid until expiry, and no refresh/revocation infrastructure was added. Both development servers remain running on 4000/5173 and PostgreSQL on 5433. Viewport overrides were reset; preview is ignored under `.local/phase3-preview.png`.

## Phase 4 - Atomic reservation and customer workflow

- Started: 2026-10-08 15:13:20 Asia/Colombo.
- Ended: 2026-10-08 15:42:27 Asia/Colombo; 29m 7s measured elapsed, including implementation, repairs, automated verification, live checks, and documentation.
- Measured implementation total: 1h 48m 12s; earlier planning duration remains unknown. Idle time between user requests is excluded.
- Used the NestJS CLI to generate OrdersController, OrdersService, and OrderTransitionsService; adapted those files rather than hand-writing their scaffolds. No new packages or migration were needed.
- Added strict order/pagination DTOs, CUSTOMER guards, owning-customer queries, exact public serializers with ordered history and numeric money, immutable product snapshots, and server-derived BigInt totals.
- One READ COMMITTED PostgreSQL transaction claims the customer/key using INSERT ON CONFLICT, conditionally decrements live stock, writes the PENDING order/initial history, and finalizes the claim. Missing products, stock errors, overflow, and later failures roll back all writes. Replay compares canonical input and holds FOR SHARE while loading its current order/history. No in-memory lock or stock/key map provides correctness.
- Customer list/detail use read-only REPEATABLE READ snapshots to keep count/items/status/history coherent. Pagination defaults/caps, uppercase filtering, stable timestamp/ID ordering, and huge beyond-end pages are verified.
- Added React Query order hooks, central Zod request/response schemas, React Hook Form quantity entry, and separated customer workspace/create/list/detail features. Reused shared tables, fields, loading, feedback, and buttons; added shared Pagination and StatusBadge.
- Before sending, a customer-scoped UUID and canonical product/quantity are stored in sessionStorage. Uncertain responses retain locked input for explicit same-key retry after navigation/reload/re-login. Definitive 400/404/409 errors allow correction with a fresh key; success clears intent. Tokens/passwords remain absent from browser storage. Product names on resumed forms observe the table cache without causing a redundant fetch.
- Updated the implementation plan, README, API documentation, and database transaction notes. Cancellation, payment processing, and operations order endpoints/UI remain scheduled work.

### Verification

| Check | Actual result |
| --- | --- |
| Production builds and lint | Both workspaces passed; final frontend refinement was rebuilt, linted, and retested |
| Backend unit tests | 13 passed |
| PostgreSQL/API integration | 81 passed across four suites; 38 new order scenarios supplement the previous 43 |
| Frontend tests | 39 passed; three new customer workflow scenarios supplement the previous 36 |
| Last-unit race across independent apps | Winner 201; contender visibly waits on PostgreSQL UPDATE lock, then 409 INSUFFICIENT_STOCK; stock 0, one order/key/history |
| Identical-key race across independent apps | Unique INSERT lock observed; 201/200 with identical order; stock decremented once |
| Concurrent changed input | Unique INSERT lock observed, then 409 IDEMPOTENCY_CONFLICT; original order unchanged |
| First claimant rollback while another waits | First returns 500; waiting claimant returns 201; one committed reservation/key/history |
| Later write failure | Test-only failure after stock/order/history writes returns 500 and rolls back stock, order, history, and claim; same key then succeeds |
| Contract/access checks | Strict quantities/body/query/key validation, snapshots, safe totals, ownership, roles, filtering/counts, timestamp ties, and huge empty pages passed |
| Frontend failure behavior | Lost response followed by reload/re-login reuses the identical key/body without automatic retry; definitive stock rejection permits correction and a new key |
| Live API | Alice list/detail 200; Bob list 200 but Alice detail 404; operations customer routes 403 |
| Live browser | Alice reserves two keyboard units; PENDING detail shows LKR 30,000.00 and exactly one ORDER_CREATED entry; list/filter/empty-state checks passed |
| Responsive layout | Form/detail/table fit a 375px viewport; order table page width 375px; desktop width 1280px with no page overflow |
| Browser errors | No browser console errors in final checked flow |
| Private configuration separation | JWT/webhook secrets and database URLs absent from built frontend JavaScript |
| Development database | Retained one demo order/key/history for inspection; keyboard stock 18; zero payment events; other products remain seeded |

Race tests run two independent NestJS instances and separate Prisma pools against inventory_test. The first transaction is held by a test-only transition-service barrier after stock/order/history writes. The second request must be observed waiting in pg_stat_activity before release; timing-only sleeps are not used as race proof. The barrier/failure injection never appears in production services. Integration fixtures restore the test seed; development data was not reset.

Repair evidence: a test initially constructed two Supertest requests before awaiting either; the second retained a server address closed by the first. Constructing each sequential conflict request inside its loop fixed the harness. The frontend initially mounted two active product observers, causing an extra request on 401; its parent now observes the cache with fetching disabled. A final TypeScript null-narrowing error in that cache lookup was fixed with a stable intent reference. All final relevant checks passed after these repairs.

Limitations: payment/cancellation transitions and operations order endpoints remain Phase 5/6; no extra feature was added. SessionStorage survives reload but is scoped to a browser tab; closing it loses unresolved retry details, so inspect My orders before another logical purchase. Auth remains in memory and reload requires login. Full restart acceptance and final Postman artifacts remain scheduled gates.

Both development servers are running on 4000/5173, PostgreSQL on 5433. The browser is left on Alice's retained order detail. Temporary viewport overrides were reset; screenshot is ignored under .local/phase4-preview.png.

## Phase 5 - Payment callbacks, cancellation, and terminal states

- First measured timestamp: 2026-10-08 15:44:45 Asia/Colombo.
- Ended: 2026-10-08 16:04:05 Asia/Colombo; 19m 20s measured elapsed including implementation, repairs, verification, restart checks, consolidated scenario-to-test verification, Postman scenario/export/runner tooling, sanitized real-response capture, clean-archive/database verification, source packaging, engineering/walkthrough notes, and documentation.
- Measured implementation total: 2h 7m 32s; earlier planning duration remains unknown. Idle gaps between user requests are excluded.
- Used NestJS CLI controller/service/guard generators, then placed webhook providers in their feature module. No dependencies were added.
- Implemented POST /webhooks/payments with a configured-secret guard, fixed-length timing-safe hash comparison, exact DTO validation, and 200 APPLIED/IGNORED/DUPLICATE results. Existing payload conflicts are checked before changed-order lookup. Invalid/unauthorized/unknown-order requests do not accept events.
- Implemented owning-customer POST /orders/:id/cancel with strict empty-body validation, 200 full Order on PENDING, and 409 INVALID_TRANSITION on terminal states.
- Extended one injected OrderTransitionsService for both actions: order FOR UPDATE, guarded PENDING UPDATE, atomic quantity increment for FAILED/CANCELLED only, and sequence-1 history with the returned database update timestamp. Status/stock/history/event outcomes commit together; thrown failures roll back everything.
- Prisma CLI generated an empty migration named defer_payment_event_order_fk, then its SQL makes the payment event/order FK DEFERRABLE INITIALLY DEFERRED. This preserves commit-time integrity while avoiding premature KEY SHARE locks during event claims and callback lock-upgrade deadlocks. Applied to development without resetting the retained order, and to the isolated test database.
- Added a separated OrderCancelAction using React Query with manual mutation retries, current-state discovery after stale 409/uncertain responses, session-expiry handling, and product/order cache updates. Pending orders show the action; terminal orders hide it. Detail refresh preserves the mounted feedback/action component. Creation success feedback no longer presents a stale status after cancellation/payment changes.
- Updated the plan, API/database documentation, README, and this evidence log. Operations order endpoints/UI remain Phase 6 work.

### Verification

| Check | Actual result |
| --- | --- |
| Builds and lint | Both workspaces passed |
| Backend unit tests | 13 passed |
| PostgreSQL/API integration | 109 passed in five suites; 28 new Phase 5 scenarios |
| Frontend tests | 44 passed; five new cancellation scenarios, including a delayed cancellation response after logout |
| Webhook contract/access | Secret missing/empty/wrong, invalid/extra DTO fields, unknown order, exact public result, changed accepted payload including unknown order ID all verified |
| Terminal behavior | Success consumes reserved stock; failure/cancel restore once; repeated cancellation conflicts; new terminal callbacks are IGNORED; identical accepted/ignored event retries are DUPLICATE |
| Controlled races across independent apps | Both winners for cancellation versus success/failure, duplicate cancellation, identical/changed events, distinct events on one order, and first-claim rollback passed with observed database locks |
| Different-order release contention | Two independent callbacks held at the same product row; two waiting increments observed before release; both quantities restored without lost updates |
| Rollback | Failure injected after terminal state/stock/history writes leaves original PENDING/reserved stock/initial history and no accepted event; same request succeeds afterward |
| FK integrity | Deferred flags verified; unknown event/order reference rejected at commit; schema fixture explicitly forces check before its deliberate rollback |
| Application restart test | Both NestJS instances closed/recreated; existing creation key and accepted payment event replay correctly with current FAILED status, one terminal history and unchanged stock |
| Live browser | Alice cancelled the retained two-unit keyboard order; CANCELLED status, CUSTOMER_CANCELLED history and removal of cancel action verified |
| Live callbacks | New one-unit hub reservation received PAYMENT_FAILED/APPLIED; later PAYMENT_SUCCEEDED event was IGNORED |
| Full API process restart | Process 21684 stopped and new process 8816 started without reset/seed; creation retry returned same FAILED order/history; APPLIED and IGNORED events both replayed as DUPLICATE |
| Retained development state | Two orders/keys, four history entries, two accepted events; keyboard and hub stock both 20; other products remain seeded |
| Responsive UI | Cancellation/detail fit 375px with no horizontal page overflow; desktop detail fit 1280px; temporary viewport overrides reset |
| Secret/browser checks | Private API configuration absent from built frontend JavaScript; no errors in final checked browser flow |

Integration tests use the dedicated inventory_test database and restore fixtures afterward. Test-only barriers/failures exist only in test files, not production switches. All production concurrency authority is PostgreSQL; no shared JavaScript lock/key/event store is used.

Repair evidence: the old schema FK test deliberately rolled back before the newly deferred constraint could run; it now forces the check inside that test, and a new test verifies actual commit rejection. Lint caught an unused validated-body parameter, fixed explicitly. Frontend test fixtures initially inferred fromStatus as null-only; typing them with the centralized Order contract fixed the production typecheck. All final builds/lints/tests passed after these repairs.

Live verification preserved demo data rather than resetting it. The existing Phase 4 keyboard order is now CANCELLED with quantity returned. A second hub order is FAILED, also with quantity returned, and its accepted APPLIED/IGNORED events remain inspectable. The ignored .local/phase5-smoke.json stores only public IDs/input/key for the process-restart demonstration, with no bearer token or webhook secret.

Scope limitations: operations order workflows, final Postman exports, and the final submission gate remain unfinished as planned. The browser is left on Alice's cancelled order/history. Development servers are running on 4000/5173 and PostgreSQL on 5433; final preview is ignored under .local/phase5-preview.png.

Final account-switch check: cancellation completion checks that its private detail query still exists before updating cache. Logout clears that query, so a delayed result cannot recreate the signed-out account data. The DOM scenario waits for the delayed mutation to settle and verifies the private cache stays empty. Final frontend build/lint and all 44 tests passed after this refinement; the final bundle still excludes private API configuration.

## Phase 6 - Operations orders and complete role workflows

- First measured timestamp: 2026-10-08 16:06:36 Asia/Colombo.
- Ended: 2026-10-08 16:22:24 Asia/Colombo; 15m 49s measured elapsed including implementation, repairs, verification, and documentation.
- Measured implementation total: 2h 23m 21s. Earlier planning duration remains unknown; idle gaps between requests are excluded.
- Used the NestJS CLI to generate the operations controller. OperationsModule imports authentication, orders, and Prisma providers; no dependencies or migrations were added.
- Implemented OPERATIONS-only GET /operations/orders and GET /operations/orders/:id. Both reuse OrdersService serialization and read-only REPEATABLE READ transactions. Customer reads retain their mandatory customer scope; operations list/detail see all customers. Strict shared query DTOs preserve uppercase status, filtered totals, stable timestamp/ID sorting, bounded page sizes, and safe beyond-end offsets.
- Added OperationsWorkspace and shared WorkspaceNav/OrderBrowser. Customer and operations lists/details reuse DataTable, loading/error/empty states, Pagination, StatusBadge, and centralized validated API contracts. API hooks use separate role/account query keys and bearer tokens. Operations have no reserve/cancel action. Customer IDs appear in operations lists/details; product IDs appear in shared details.
- Filter/page state survives inspection/back; changing status resets to page 1. List headings/detail regions receive focus after navigation, view buttons identify the order, and the detail action row wraps on narrow screens. Shared session-expiry handling signs out and clears private caches.
- Updated implementation plan, README, API/database documentation, and this log; only assignment scope was implemented.

### Verification

| Check | Actual result |
| --- | --- |
| Production build / lint | Both workspaces passed |
| Backend unit checks | 13 passed in two suites |
| PostgreSQL/API integration | 125 passed in six suites; 16 new operations scenarios |
| Frontend checks | 48 passed in seven suites; four new operations DOM scenarios |
| Operations API | Both customer fixtures visible; exact Order/Page fields, complete history, status totals, pagination, equal-timestamp sorting, huge empty pages, invalid/unknown/repeated query rejection, 401/403/404, and read-only database invariants passed |
| Cross-role/customer isolation | Customers denied both operations routes; operations denied customer routes; customer lists/details retain ownership; both Alice/Bob fixtures verified in integration |
| Frontend operations behavior | Read-only detail, filter/page persistence, filter reset, refresh after recoverable error, empty state, full history, 401 logout, and operations-to-customer cache isolation passed |
| Live mobile keyboard flow | Alice reserved one Wireless Mouse unit using Enter/Tab; detail showed PENDING with ORDER_CREATED; Enter cancellation produced CANCELLED/CUSTOMER_CANCELLED and restored stock to 20 |
| Live operations | All retained orders visible with customer IDs; FAILED filtering, history inspection/back with filter preserved, PENDING empty state and return to all statuses passed |
| Live API | Operations list/detail 200 across retained orders; Alice/Bob denied operations routes; operations customer list 403; Alice owns three orders and Bob owns none; filtered pagination passed |
| Responsive / focus | 375px form/detail/table had no page overflow; table scrolling stays local. 1280px desktop main width 1152px and no page overflow; navigation focuses list heading/detail region; visible focus ring verified |
| Browser / secrets | No console errors in final flow; JWT/webhook secrets and both database URLs absent from built frontend JavaScript |
| Preserved development data | Three orders/keys, six history entries, two accepted events; keyboard/hub/mouse/stand stock 20 and headphones stock 1 |

Integration tests use isolated inventory_test and restore fixtures; no development reset was performed. The additional live mouse order is CANCELLED and remains inspectable. Existing Phase 4/5 keyboard/hub orders and callback evidence are preserved.

Repair evidence: the first integration run found that the new OperationsModule lacked PrismaModule for JwtAuthGuard injection. Adding that import fixed application initialization; all 125 API tests then passed. A temporary live smoke script initially used incorrect SQL table/column names; it was corrected to the checked-in schema and passed. Browser selectors were adjusted to the controls' actual accessible names. No production database mutation/concurrency logic was changed.

Remaining work: Phase 7 consolidated verification, Phase 8 Postman artifacts, and Phase 9 final reproducibility/submission documentation. No overall submission-readiness claim is made. Development servers are running on 4000/5173 and PostgreSQL on 5433. Browser is left on the operations list; viewport overrides reset. Final screenshot is ignored under .local/phase6-preview.png.

## Phase 7 - Consolidated verification and repair

- First measured timestamp: 2026-10-08 16:23:18 Asia/Colombo.
- Ended: 2026-10-08 16:29:54 Asia/Colombo; 6m 37s measured elapsed including coverage review, new tests, assertion repair, full reruns, and documentation.
- Measured implementation total: 2h 29m 58s. Earlier planning duration remains unknown; idle gaps between requests are excluded.
- Reviewed the Phase 7 scenario matrix against existing API/frontend suites and concrete transaction/authentication/serialization paths. Existing coverage already exercised required races, failures, access controls, snapshots, list contracts, and persistence.
- Added three deterministic creation-retry/terminal-transition races for CANCELLED, CONFIRMED, and FAILED. A test-only barrier holds the transition after real state/stock/history writes; a second independent NestJS app retries the persisted creation key. The test must observe its PostgreSQL FOR SHARE lock wait before release, then assert one order/key, correct stock, current terminal status, and matching full history. No production lock or test switch was added.
- Added three public-contract scenarios covering create, terminal create replay, customer/operations lists/details, and successful cancellation. They assert exact fields (without internal sequence/keys/events), safe numeric LKR amounts, valid UTC timestamps, consistent history/status, terminal history/update timestamp equality, and identical values across response paths.
- Added docs/VERIFICATION.md with requirement-to-test mapping, exact verification commands, contention proof, database isolation, teardown, and evidence limits. Updated README, implementation progress/final verified gates, and this log.
- No dependency, schema, business feature, or production service change was needed.

### Final verification

| Check | Actual result |
| --- | --- |
| npm run build | Fresh NestJS/React production builds passed; Prisma generated with dev API stopped |
| npm run lint | Both workspaces passed; backend lint passed again after assertion repair |
| npm test | 13 unit tests passed in two suites |
| npm run test:web | 48 frontend tests passed in seven suites |
| npm run test:api:e2e | 131 PostgreSQL/API tests passed in six suites; six new Phase 7 cases |
| Required concurrency scenarios | Last-unit, same-key, claimant rollback, callback duplicates/conflicts, both cancellation/payment winners, transition rollback, concurrent release increments, and new retry-during-commit cases passed across independent apps/pools |
| Restart and contracts | Existing application restart test passed again; every Order response path covered with full history and timestamp/money checks |
| Final isolated test state | 3 users, 5 products, no orders; no incomplete creation keys or payment events |
| Retained development state | Live smoke passed after app restart: 3 orders/keys, 6 history entries, 2 accepted events; demo stocks unchanged at 20 except headphones 1 |
| Private configuration | Live smoke verified JWT/webhook secrets and both database URLs absent from built frontend JavaScript |

Repair evidence: the first new contract run had three assertion failures because it incorrectly required initial history time to equal order updatedAt. Creation and history are separate writes within the transaction and may differ by milliseconds; the assignment requires valid timestamp fields, not that initial equality. The helper now checks valid UTC timestamps and exact timestamp equality for terminal transitions, where the service explicitly reuses the returned update time. All 131 integration cases passed after this test correction; no production code was altered to satisfy the test.

The API/frontend development servers were stopped for the build and restored afterward on 4000/5173. PostgreSQL remains on 5433. The final live smoke was read-only and preserved the three demo orders. Existing Phase 4–6 live UI/mobile/keyboard evidence remains applicable because this phase changed only tests/documentation.

Limits: independent NestJS instances use distinct Prisma pools in the Jest process, not distinct operating-system processes. Automated restart recreates apps/pools; a full API process restart was separately verified in Phase 5. No fresh-checkout install, Postman export/runner, optional deployment, or final submission readiness is claimed here. Phase 8 is next.

## Phase 8 - Runnable Postman collection and sanitized examples

- First measured timestamp: 2026-10-08 16:44:20 Asia/Colombo.
- Ended: 2026-10-08 17:02:42 Asia/Colombo; 18m 23s measured elapsed including scenario creation, runner/schema tooling, live capture, repairs, dependency checks, repeat verification, and documentation.
- Measured implementation total: 2h 48m 21s. Earlier planning duration remains unknown; idle gaps between requests are excluded.
- Created our own Collection v2.1 export and local placeholder environment under postman. Nine ordered folders contain 91 requests and 182 assertions covering all nine routes and the planned success/retry/conflict/ownership/payment/cancellation/operations/error/last-unit scenarios.
- Three accounts log in automatically, products are discovered by exact seeded names/prices, and runtime order IDs/snapshots are captured. UUID keys/events are generated per new logical scenario and deliberately reused for replay/conflict. Runtime values live in pm.variables rather than exported environment/collection variables.
- Added a maintainable scenario generator, schema/script/export validator, and isolated Newman runner. The runner restricts its destructive seed reset to localhost inventory_test, starts a temporary compiled NestJS API on an available port, supplies credentials in memory, runs HTTP assertions, verifies actual PostgreSQL counts/stock, and stops that API in finally. Development data is not reset. Existing capture examples are preserved by generation; ordinary test runs do not rewrite exports.
- Added pinned development tooling newman 6.2.2 and ajv-draft-04 1.0.0. Included the official Postman v2.1 JSON schema for offline validation. Existing application features/endpoints/schema were unchanged.
- Captured all 91 response examples from actual executions. Only actual Content-Type response headers are retained; original requests use variable templates; accessToken is redacted. Password/secret environment values remain placeholders, with no runtime tokens/IDs exported as variables. Nonsecret example resource IDs/timestamps remain inspectable.
- Added postman/README.md with import/configuration/run order, seed effects, isolated verification and capture instructions; updated README, API/verification documentation, implementation plan, and this log.

### Final verification

| Check | Actual result |
| --- | --- |
| Collection/schema/script/export validation | Official Collection v2.1 and environment schema passed; every script parses; all 91 requests have one captured example; actual private secrets/database URLs and runtime JWTs absent |
| Final capture | 91 requests, 182 assertions, zero failures; actual sanitized examples saved |
| Repeat unchanged-export run | 91 requests, 182 assertions, zero failures from fresh isolated seed; artifacts unchanged; new database order IDs differ from saved examples |
| Persisted test outcomes | Five orders/keys, ten history entries, five accepted events; no incomplete keys/events |
| Exact final stock | Keyboard 18, hub/stand/mouse 20, headphones 1 |
| Roles/ownership/contracts | Both seeded customers and operations; all route paths, exact statuses/error codes, snapshots, UTC/history fields, scoped lists, totals/pages/filtering, repeat/conflict/ignored outcomes checked |
| Failure validation | Invalid quantities/body/key/query, unknown resources, incorrect bearer/login/secret, unknown event/order and corrected event reuse checked |
| Build/lint | Both production builds and both workspace lints passed |
| Existing unit/frontend regression | 13 unit and 48 frontend tests passed after tooling installation |
| Development preservation | Read-only live smoke passed: original 3 orders/keys, 6 history entries, 2 accepted events retained; demo stocks unchanged |
| Tool dependency repair | Newman runtime now resolves patched Handlebars 4.7.10, deduplicated with the existing test dependency; repeat runner passed |

Repair evidence: the first live collection execution exposed collisions with legacy Postman sandbox globals named data/responseBody. The generated helper now uses assignmentResponse; all scripts pass in Newman. A validator object-brace syntax error was fixed before live execution. Examples were not saved from failed runs. The final capture reads the actual response Content-Type rather than providing a fixed example header.

Dependency evidence/limit: installation initially introduced a critical Handlebars advisory through pinned postman-runtime. A patch override to 4.7.10 and reinstall of the runner dependency removed that introduced critical finding. The latest install still reports 50 npm audit findings (34 moderate, 14 high, 2 critical), including existing development-tool findings; this phase does not claim a clean dependency audit or apply unrelated framework upgrades. Postman tooling is a development dependency, and only our local collection/API is executed.

The test database retains the five walkthrough orders for inspection and is automatically reset before the next isolated runner or API integration run. Development servers are restored on 4000/5173; PostgreSQL stays on 5433. The browser frontend was unchanged. Phase 7's 131 API integration checks were not rerun because no production API logic changed; the collection adds 91 real HTTP demonstrations and database verification, while existing concurrency evidence remains separately recorded.

Remaining gates: Phase 9 clean reproducibility, final engineering/submission documentation and source packaging, followed by optional deployment only if time permits. No final submission or deployment readiness claim is made.

## Phase 9 - Clean reproducibility, documentation and source submission

- First measured timestamp: 2026-10-08 17:29:21 Asia/Colombo.
- Ended: 2026-10-08 17:44:16 Asia/Colombo; 14m 55s measured elapsed including documentation, packaging, fresh dependency install/cluster creation, repairs, tests, production/restart checks, and cleanup.
- Measured implementation total: 3h 3m 16s. Earlier planning duration remains unknown; idle gaps between requests are excluded. The measured total is below 12 hours, but an absolute total including unmeasured planning cannot be independently certified.
- Finished README with verified tool/runtime versions, exact setup/build/test/seed/reset/configuration/production/Postman instructions; updated both app READMEs and the API route/model index. Added engineering decisions, expiry discussion without implementation, 45-minute walkthrough, and submission evidence/limitations.
- Added source packaging and ZIP verification commands using PowerShell 7. An allowlisted root/source tree excludes dependencies/builds/private environment files/database data/logs/temporary artifacts and symlinks. SHA-256 manifest verification checks every archive path/content; scans exclude actual private JWT/database URL/password and configured nonpublic webhook values, plus runtime bearer JWTs. Public demo credentials/configuration examples remain documented intentionally.
- Extracted the source ZIP into .local/phase9-clean/inventory-assignment with no node_modules/dist/.env/database data. npm ci installed 1109 packages from the lockfile and generated Prisma. setup:env generated independent private configuration. Only ignored clean-copy ports were changed to database 5434, API 4002, and frontend 5174 to preserve the running developer environment.
- Created a genuinely new PostgreSQL 16.1 cluster and separate named development/test databases. Applied both migrations, ran non-destructive seed twice, and reset the clean development fixtures successfully.
- Verified the extracted application through all automated suites, its Postman runner, production-mode API/preview, and a full API process restart. Compared 100 application/schema/test files with the final source and the repaired web lint command; final docs/packaging updates do not change the tested application code.
- Stopped the temporary clean API/preview and PostgreSQL cluster after verification. Its ignored files retain evidence; the original API/frontend/PostgreSQL and original demo data remain available.

### Final clean-copy results

| Check | Actual result |
| --- | --- |
| Fresh install/configuration | npm ci --include=optional and setup:env passed |
| New database setup | db:init, db:migrate, two db:seed runs, db:reset passed; fresh 3 users/5 products/no orders |
| Production builds/lint | Both builds and lints passed; explicit frontend targets also passed in original workspace |
| Backend unit / frontend | 13 unit + 48 frontend checks passed |
| Real PostgreSQL/API | 131 tests passed across six suites on the new cluster, including independent-app lock contention and rollback/restart contracts |
| Postman schema/runner | 91 requests / 182 assertions passed; no export changes; 5 orders/keys, 10 history, 5 accepted events, correct stocks and zero incomplete claims |
| Production mode | All three accounts logged in; empty-order seed, create/cancel/stock restoration, ownership and operations detail passed |
| Browser configuration/CORS | Preview served built HTML/JS; isolated API URL embedded; private configuration excluded; correct origin allowed |
| Full process restart | Production API PID 22072 stopped; new PID 6180 started; identical creation retry returned same CANCELLED ID/two history entries |
| Source identity | 100 application/schema/test files plus repaired frontend lint script match the tested extracted source |
| Original data | Read-only live smoke retained 3 orders/keys, 6 history, 2 events; standard stocks preserved |
| Source ZIP | Final artifact and per-file manifest/checksum verification prepared under .local/submission; all required source/docs/Postman/migration/seed/test files included |

Repair evidence: an early migration attempt started while npm ci was still extracting Prisma files, producing a missing WASM error. After installation completed, migration/seed/reset passed. Frontend lint initially found no files because the extracted directory was beneath the original ignored .local parent. It now explicitly targets src and vite.config.ts with --no-ignore, passing in both extracted and original workspaces. No business logic was changed.

Known limits at the end of Phase 9: dependency audit remains 50 findings (34 moderate/14 high/2 critical), including development tools; no clean-audit or production-security claim. Hosted demo evidence is recorded in the later section. Linux/macOS were not tested. Earlier planning time was not measured. The walkthrough notes and AI disclosure prepare the discussion, but developer understanding and assessment marks cannot be guaranteed. All required local feature/artifact checks above are verified; these limits are preserved in docs/SUBMISSION.md.

## Hosted demo evidence

Recorded 9 October 2026. This pass was not given its own stopwatch, so it is not added to the measured 3h 3m Phase 1–9 total. Earlier planning time is still unmeasured.

- Startup now accepts the assignment webhook secret `local-demo-webhook-secret`. `JWT_SECRET` still requires 32 characters. API unit tests: 14 passed. The local `.env` was not rewritten.
- Vercel project `chitta-lab-inventory` production deployment was Ready. Its only environment variable is `VITE_API_BASE_URL=https://api.prabhathmadhushan.cv/api`.
- The compiled API `dist` was copied to the existing Linux deployment and `inventory-api` was restarted. Windows `node_modules` were not uploaded. No database reset or seed was run.
- Order `a5bb58fc-c23e-44d4-b257-97702531451e` stayed PENDING across that restart. The same idempotency key returned HTTP 200 and the same id while keyboard stock stayed at 19. Cancellation restored it to 20.
- Webhook checks against that cancelled order: wrong secret 401 `UNAUTHORIZED`; configured secret 200 `IGNORED`; identical event 200 `DUPLICATE`. The hosted secret was not printed or committed.
- Hosted UI: Alice created and cancelled USB C Hub order `4756c545-3852-42dd-885d-30d53cfaff15` with `ORDER_CREATED` then `CUSTOMER_CANCELLED`. Bob's list showed 0 orders. Operations filtered PENDING and opened the order with customer id `user-alice`. Final hosted stock was 20 for every product except Limited Edition Headphones, which stayed at 1.

## AI usage

OpenAI Codex assisted with requirement extraction, plan creation/revision, running official project generators, workspace integration, local setup helpers, configuration, schema/migration/seed implementation, authentication, atomic reservation/payment/cancellation services, customer/operations UI, shared component/accessibility refinements, database/frontend tests, restart checks, and documentation. Cursor assisted with the webhook-secret startup change, the Vercel project check, the VPS publish, the hosted browser walkthrough, and this evidence note. The PDF was read and visually checked during planning. Generated/adapted code is verified using local builds, lint, automated checks against PostgreSQL, and live frontend/API checks; final actual outcomes are recorded above. The developer must review and understand these changes for the assignment walkthrough.

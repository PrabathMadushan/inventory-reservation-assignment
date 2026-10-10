# Security report

Reviewed 9 October 2026. Scope is the inventory assignment in this repository and the production deployment that serves it: the NestJS API on the GCP VM, HTTPS at `api.prabhathmadhushan.cv`, and the Vite frontend on Vercel.

The review covered authentication, authorization, order and webhook handlers, validation, error responses, browser token handling, deployment workflow, the VM service, TLS, and production dependencies. It did not include a penetration test or a full review of third-party build tools.

## Result

The application already enforces the assignment's access rules. Customer orders stay scoped to the signed-in user, roles are loaded from PostgreSQL, passwords are bcrypt hashes, and SQL is parameterized. Two production exposures needed a change: the API was reachable as cleartext on port 4000, and the HTTPS response was missing browser security headers. Those are fixed on the live API. Additional checks are in the repository and take effect on the next API deploy.

Login still succeeds for the seeded demo accounts over HTTPS.

## Controls that already hold

| Area | What the code does |
| --- | --- |
| Passwords | bcrypt cost 12. Login compares a dummy hash when the email is unknown, and unknown users and wrong passwords return the same 401 message. Passwords longer than bcrypt's 72-byte input are rejected. |
| Tokens | HS256 only, with a fixed issuer, audience, and one-hour expiry. The guard reloads the user and role from the database. Client role fields are rejected. |
| Customer access | List, detail, cancel, and idempotent replay include the authenticated customer id. Another customer's order returns 404. |
| Operations access | Operations routes require the OPERATIONS role. Operations cannot call customer create or cancel routes. |
| Webhooks | `X-Webhook-Secret` is compared as equal-length SHA-256 digests with `timingSafeEqual`. Event ids are unique, and a changed replay returns a conflict. |
| Input | Validation rejects unknown fields. Quantities are bounded. Prices and identity come from the database row, not the request body. |
| Stock | Reservation is one conditional `UPDATE` that decrements only when enough stock remains. |
| Errors | The global filter returns a code and message. Unexpected failures stay a generic 500. |
| Browser | The access token lives in React state and in the same-tab `sessionStorage` entry `inventory.session`, which sign-out removes. It is not stored in `localStorage`, cookies, or the payment URL. The reservation intent stores only the account-scoped retry key and order input. The webhook secret is not in the frontend bundle. |
| CORS | One configured origin, `https://app.prabhathmadhushan.cv` in production. Methods are GET, POST, and OPTIONS. |
| Secrets in git | `.env` is gitignored. The deploy workflow reads the SSH key, host, and user from GitHub secrets. |
| Remote reset | `npm run db:seed` and `npm run db:reset` refuse any database that is not local `inventory_development` or `inventory_test`. |

## Findings

| Severity | Status | Finding |
| --- | --- | --- |
| High | Fixed on the VM | Port 4000 accepted HTTP from the internet, so the API could be used without TLS and without the Caddy headers. The `allow-inventory-api` firewall rule is deleted. A connection to `http://136.80.174.107:4000/api` now times out. HTTPS health returns 200. |
| Medium | Fixed on the VM | HTTPS responses had no `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, or `Referrer-Policy`, and they advertised `X-Powered-By: Express`. Caddy now sets those headers and removes `Server` and `X-Powered-By`. |
| Medium | Fixed in git, live after the next API deploy | The Node process listened on every interface. `main.ts` now binds `127.0.0.1` when `NODE_ENV=production`, so a later firewall mistake does not publish the cleartext port. The running process is still the previous build until that deploy. |
| Medium | Fixed in git, live after the next API deploy | GitHub Actions trusted whatever SSH host key the VM presented during the deploy. The workflow now has `contents: read` and pins the VM host key. |
| Info | Accepted for the assignment | `WEBHOOK_SECRET` has no 32-character minimum. The local demo value is `local-demo-webhook-secret`. A blank value still fails startup. The hosted secret stays on the server and can be longer. |
| Low | Fixed in git, live after the next API deploy | Product ids, payment event ids, order ids, and `Idempotency-Key` values had no length cap, so an authenticated caller could store very large strings. They are now limited to 256 characters. |
| Low | Fixed in git, live after the next API deploy | `@nestjs/config` installed `lodash@4.17.21`, which has prototype-pollution and `_.template` advisories. The app does not pass request data into those lodash functions. The lockfile now resolves `lodash@4.18.1`. |
| Low | In git, live after the next frontend deploy | The Vercel HTML response has HSTS from Vercel and does not set `X-Frame-Options` or `X-Content-Type-Options`. `vercel.json` adds those headers. Tokens are not cookies, so a framed page cannot be read by another origin. |
| Info | Accepted for this demo | Production contains the three documented demo accounts. Their password is published in `postman/README.md`. Anyone who can reach the API can sign in as those users. That matches the assignment demo and is not a boundary for real customer data. |
| Info | Left as designed | There is no login rate limit, refresh token, or server-side logout. A stolen token works until it expires one hour later, or until the signing secret changes. The assignment documents this limit. |
| Info | Left as designed | The payment callback trusts a static shared secret rather than a signature over the body. TLS protects the header on the public URL. Anyone who obtains the secret can submit payment events. |
| Info | No request path | `prisma`, `@prisma/config`, and `deepmerge-ts` still have a high `npm audit` finding for stack exhaustion while merging recursive config objects. That code loads Prisma config. API requests do not reach it. Prisma stays on the project's pinned 6.19.3 release. |
| Info | Unchanged | GCP still allows SSH from the internet, which this VM needs, and RDP on every instance in the project. This VM is Linux and does not use RDP. Port 80 still serves the existing status page, so Caddy does not take port 80 or redirect HTTP to HTTPS. |

## Changes

Repository:

- `apps/api/src/main.ts` binds production to localhost.
- `apps/api/src/configure-app.ts` disables `X-Powered-By`.
- `apps/api/src/common/config/environment.ts` requires a non-empty webhook secret and accepts `local-demo-webhook-secret`. `JWT_SECRET` still requires 32 characters.
- Order and webhook DTOs, and the idempotency key, reject values longer than 256 characters.
- `package.json` overrides `lodash` to 4.18.1.
- `deploy/inventory-api.service` adds a read-only home, a private temp directory, and kernel/module protections.
- `deploy/Caddyfile` is the TLS proxy config with the security headers.
- `.github/workflows/deploy-api.yml` pins the SSH host key and limits the workflow token.
- `vercel.json` sets frontend response headers for the next Vercel deployment.

Already applied on the VM:

- Firewall rule `allow-inventory-api` deleted.
- `/etc/caddy/Caddyfile` reloaded with the header block.
- `inventory-api.service` restarted with the sandbox settings. Local `http://127.0.0.1:4000/api` returns `{"status":"ok","database":"connected"}`.

`apps/api` unit tests for startup configuration: 11 passed.

## Publish status

On 9 October 2026 the compiled API `dist` from this workspace was copied onto the VM and `inventory-api` was restarted. That running build binds production to localhost, accepts a non-empty webhook secret including `local-demo-webhook-secret`, and keeps the 256-character input limits. The existing Linux `node_modules` were left in place. Caddy already strips `X-Powered-By` on the public URL, and the firewall already blocks port 4000. The Vercel HTML response already includes the headers from `vercel.json`.

Pushing `main` still runs the GitHub Actions API workflow. A Windows checkout must not replace the VM `node_modules` with a Windows install.

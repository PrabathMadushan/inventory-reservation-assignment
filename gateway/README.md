# Presentation payment gateway

This is outside the assignment. NestJS routes and the Postman collection stay unchanged.

The gateway is a small Rust program on the same machine as the API. It listens on `127.0.0.1:4001`. Caddy publishes it at `https://api.prabhathmadhushan.cv/gateway`.

A signed-in customer presses **Pay** on a pending order. The app posts the bearer token and order id to `/start`. The gateway calls `GET /api/orders/:id` once with that token, then discards it. The token is not logged, stored, or placed in a URL. The API already returns 404 for another customer's order. The gateway continues only when the status is `PENDING`.

It then returns a one-time ticket bound to that order and an allowlisted return origin (`https://app.prabhathmadhushan.cv` or `http://localhost:5173`). The browser opens checkout for that ticket. **Pay** sends `PAYMENT_SUCCEEDED`. **Fail** sends `PAYMENT_FAILED`. The webhook secret stays in the server environment. A wrong or reused ticket never calls the webhook.

Checkout redirects to `/?payment=success` or `/?payment=failure` plus the order id. Responses send `Referrer-Policy: no-referrer`. The app restores the session from `sessionStorage`, refetches the order, and trusts that status.

`WEBHOOK_SECRET` comes from the API environment file. Do not commit it.

Build the Linux binary on a machine with enough memory, then copy only that file to the VPS. Do not compile on the 1 GB server.

```sh
cargo build --release --target x86_64-unknown-linux-musl --config "target.x86_64-unknown-linux-musl.linker=\"rust-lld\""
```

Install the uploaded binary as `/usr/local/bin/payment-gateway` and enable `deploy/payment-gateway.service`. The unit caps the process at 64 MB.

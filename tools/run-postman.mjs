import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import newman from "newman";
import pg from "pg";
import {
  validatePostman,
  checkSanitized,
  collectionPath,
} from "./validate-postman.mjs";

// This runner only touches the explicitly named isolated local TEST database.
const root = fileURLToPath(new URL("../", import.meta.url));
const local = parseEnv(
  readFileSync(new URL("../.env", import.meta.url), "utf8"),
);
const env = { ...local, ...process.env };
const target = new URL(env.TEST_DATABASE_URL);
const development = new URL(env.DATABASE_URL);
assert(
  ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname),
  "Postman verification requires localhost",
);
assert.equal(decodeURIComponent(target.pathname), "/inventory_test");
assert.notEqual(
  target.pathname,
  development.pathname,
  "Test and development database names must differ",
);
const { collection, environment, items } = validatePostman();
checkSanitized(collection, environment, env);
const prepare = spawnSync(
  process.execPath,
  ["tools/database.mjs", "test:prepare"],
  { cwd: root, env, stdio: "inherit", windowsHide: true },
);
if (prepare.error) throw prepare.error;
assert.equal(prepare.status, 0, "Test database preparation failed");
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    server.close((error) => (error ? reject(error) : resolve(port)));
  });
});
const baseUrl = `http://127.0.0.1:${port}/api`;
const child = spawn(process.execPath, ["apps/api/dist/main.js"], {
  cwd: root,
  env: { ...env, DATABASE_URL: env.TEST_DATABASE_URL, PORT: String(port) },
  stdio: "ignore",
  windowsHide: true,
});
let startupError;
child.on("error", (error) => {
  startupError = error;
});
const stopped = new Promise((resolve) => child.once("exit", resolve));
try {
  const deadline = Date.now() + 20000;
  while (true) {
    if (startupError) throw startupError;
    assert.equal(
      child.exitCode,
      null,
      "Temporary API exited before becoming ready",
    );
    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) break;
    } catch {
      /* bounded startup polling */
    }
    assert(
      Date.now() < deadline,
      "Temporary API did not become ready; run npm run build",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const variables = structuredClone(environment);
  variables.values.forEach((v) => {
    if (v.key === "baseUrl") v.value = baseUrl;
    if (v.key.endsWith("Password")) v.value = "DemoPass123!";
    if (v.key === "webhookSecret") v.value = env.WEBHOOK_SECRET;
  });
  const summary = await new Promise((resolve, reject) =>
    newman.run(
      {
        collection,
        environment: variables,
        reporters: [],
        timeoutRequest: 5000,
        timeoutScript: 5000,
        timeout: 120000,
        bail: true,
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    ),
  );
  if (summary.run.failures.length) {
    for (const failure of summary.run.failures)
      console.error(
        `${failure.source?.name ?? "Collection"}: ${failure.at ?? "assertion"} (${failure.error?.name ?? "failure"})`,
      );
    for (const failure of summary.run.failures) {
      if (failure.error?.name === "SyntaxError")
        console.error(failure.error.message);
    }
    throw new Error(
      `${summary.run.failures.length} collection failure(s); no examples exported`,
    );
  }
  assert.equal(
    summary.run.executions.length,
    items.length,
    "Every request must execute",
  );
  const acceptedEvents = new Set();
  const captures = new Map();
  for (const execution of summary.run.executions) {
    const body = JSON.parse(execution.response.stream.toString());
    if (["APPLIED", "IGNORED"].includes(body.outcome))
      acceptedEvents.add(body.eventId);
    if ("accessToken" in body) body.accessToken = "<redacted access token>";
    captures.set(execution.item.name, { body, response: execution.response });
  }
  const db = new pg.Client({ connectionString: env.TEST_DATABASE_URL });
  await db.connect();
  let state;
  try {
    state = (
      await db.query(
        "SELECT (SELECT count(*) FROM orders)::int AS orders,(SELECT count(*) FROM order_idempotency)::int AS keys,(SELECT count(*) FROM order_transitions)::int AS history,(SELECT count(*) FROM payment_events)::int AS events,(SELECT count(*) FROM order_idempotency WHERE order_id IS NULL)::int AS incomplete_keys,(SELECT count(*) FROM payment_events WHERE outcome IS NULL)::int AS incomplete_events",
      )
    ).rows[0];
    assert.deepEqual(state, {
      orders: 5,
      keys: 5,
      history: 10,
      events: acceptedEvents.size,
      incomplete_keys: 0,
      incomplete_events: 0,
    });
    const stocks = (
      await db.query(
        "SELECT id,available_quantity::text AS quantity FROM products ORDER BY id",
      )
    ).rows;
    assert.deepEqual(stocks, [
      { id: "product-headphones", quantity: "1" },
      { id: "product-hub", quantity: "20" },
      { id: "product-keyboard", quantity: "18" },
      { id: "product-mouse", quantity: "20" },
      { id: "product-stand", quantity: "20" },
    ]);
  } finally {
    await db.end();
  }
  if (process.argv.includes("--capture-examples")) {
    for (const item of items) {
      const capture = captures.get(item.name);
      item.response = [
        {
          name: `Captured ${capture.response.code} - ${item.name}`,
          originalRequest: structuredClone(item.request),
          status: capture.response.status,
          code: capture.response.code,
          header: [
            {
              key: "Content-Type",
              value: capture.response.headers.get("Content-Type"),
            },
          ],
          body: JSON.stringify(capture.body, null, 2),
          cookie: [],
          _postman_previewlanguage: "json",
        },
      ];
    }
    checkSanitized(collection, environment, env);
    writeFileSync(collectionPath, JSON.stringify(collection, null, 2) + "\n");
    // Validate the final saved artifacts, including the captured example schema.
    const saved = validatePostman();
    checkSanitized(saved.collection, saved.environment, env);
  }
  console.log(
    JSON.stringify({
      requests: summary.run.stats.requests.total,
      assertions: summary.run.stats.assertions.total,
      failures: 0,
      database: state,
      examples: process.argv.includes("--capture-examples")
        ? "captured and sanitized"
        : "existing exports unchanged",
    }),
  );
} finally {
  if (child.exitCode === null) child.kill();
  await stopped;
}

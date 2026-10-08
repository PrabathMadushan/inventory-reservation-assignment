import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { parseEnv } from "node:util";
import Ajv from "ajv-draft-04";

export const collectionPath = fileURLToPath(
  new URL("../postman/inventory.postman_collection.json", import.meta.url),
);
export const environmentPath = fileURLToPath(
  new URL("../postman/local.postman_environment.json", import.meta.url),
);
export function validatePostman() {
  const collection = JSON.parse(readFileSync(collectionPath, "utf8"));
  const environment = JSON.parse(readFileSync(environmentPath, "utf8"));
  const schema = JSON.parse(
    readFileSync(
      new URL("./schemas/postman-collection-v2.1.json", import.meta.url),
      "utf8",
    ),
  );
  const ajv = new Ajv({
    strict: false,
    allErrors: true,
    validateFormats: false,
  });
  const validate = ajv.compile(schema);
  assert.equal(validate(collection), true, JSON.stringify(validate.errors));
  const environmentSchema = {
    type: "object",
    required: ["name", "values", "_postman_variable_scope"],
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      _postman_variable_scope: { enum: ["environment"] },
      values: {
        type: "array",
        items: {
          type: "object",
          required: ["key", "value", "type", "enabled"],
          additionalProperties: false,
          properties: {
            key: { type: "string" },
            value: { type: "string" },
            type: { enum: ["default", "secret"] },
            enabled: { type: "boolean" },
          },
        },
      },
    },
  };
  assert.equal(
    ajv.validate(environmentSchema, environment),
    true,
    JSON.stringify(ajv.errors),
  );
  const names = new Set();
  const items = collection.item.flatMap((f) => f.item);
  for (const item of items) {
    assert(!names.has(item.name), "Request names must be unique");
    names.add(item.name);
    assert(
      item.event.some((e) => e.listen === "test"),
      "Every request needs assertions",
    );
    for (const event of item.event) new Function(event.script.exec.join("\n"));
  }
  return { collection, environment, items };
}

export function checkSanitized(collection, environment, privateEnvironment) {
  const text = JSON.stringify({ collection, environment });
  for (const key of [
    "JWT_SECRET",
    "WEBHOOK_SECRET",
    "DATABASE_URL",
    "TEST_DATABASE_URL",
  ]) {
    if (privateEnvironment?.[key])
      assert(
        !text.includes(privateEnvironment[key]),
        `${key} must not be exported`,
      );
  }
  assert(
    !/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text),
    "Runtime JWT must not be exported",
  );
  const values = Object.fromEntries(
    environment.values.map((v) => [v.key, v.value]),
  );
  for (const role of ["alice", "bob", "ops"])
    assert.equal(values[role + "Password"], "REPLACE_DEMO_PASSWORD");
  assert.equal(values.webhookSecret, "REPLACE_WEBHOOK_SECRET");
  assert.equal(environment.values.length, 8);
  assert.equal(
    collection.variable,
    undefined,
    "Runtime variables must remain run-local",
  );
  for (const item of collection.item.flatMap((f) => f.item)) {
    for (const response of item.response) {
      assert.deepEqual(response.originalRequest, item.request);
      if (item.name.startsWith("Login "))
        assert.equal(
          JSON.parse(response.body).accessToken,
          "<redacted access token>",
        );
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { collection, environment, items } = validatePostman();
  const localFile = new URL("../.env", import.meta.url);
  let privateEnvironment;
  try {
    privateEnvironment = parseEnv(readFileSync(localFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  checkSanitized(collection, environment, privateEnvironment);
  for (const item of items)
    assert.equal(
      item.response.length,
      1,
      `Missing captured example: ${item.name}`,
    );
  console.log(
    `Postman v2.1 schema, environment schema, ${items.length} scripts/requests, and sanitized exports verified.`,
  );
}

import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const environment = parseEnv(
  readFileSync(resolve(__dirname, '../../../.env'), 'utf8'),
);
for (const [key, value] of Object.entries(environment)) {
  process.env[key] ??= value;
}
const development = new URL(process.env.DATABASE_URL!);
const test = new URL(process.env.TEST_DATABASE_URL!);
if (development.pathname === test.pathname) {
  throw new Error('E2E tests require a separate test database.');
}
// Run before AppModule imports/evaluates ConfigModule.forRoot.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

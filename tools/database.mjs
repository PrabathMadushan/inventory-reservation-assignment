import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const apiDirectory = fileURLToPath(new URL('../apps/api/', import.meta.url));
const prismaCli = join(dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
const command = process.argv[2];
if (!['migrate', 'seed', 'reset', 'test:prepare'].includes(command)) throw new Error('Unknown database command.');
const development = new URL(process.env.DATABASE_URL);
const testing = new URL(process.env.TEST_DATABASE_URL);
if (decodeURIComponent(development.pathname) === decodeURIComponent(testing.pathname)) {
  throw new Error('Development and test database names must differ.');
}
const target = command === 'test:prepare' ? testing : development;
const expected = command === 'test:prepare' ? 'inventory_test' : 'inventory_development';
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || decodeURIComponent(target.pathname.slice(1)) !== expected) {
  throw new Error(`Local database commands require ${expected} on localhost.`);
}
const env = { ...process.env, DATABASE_URL: target.toString() };
function run(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], { cwd: apiDirectory, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (command !== 'seed') run(['migrate', 'deploy']);
if (command !== 'migrate') run(['db', 'seed', ...(command === 'seed' ? [] : ['--', '--reset'])]);

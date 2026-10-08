import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const example = fileURLToPath(new URL('../.env.example', import.meta.url));
const destination = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(destination)) {
  console.log('.env already exists; kept existing configuration.');
} else {
  const password = randomBytes(24).toString('hex');
  const content = readFileSync(example, 'utf8')
    .replaceAll('replace-with-local-password', password)
    .replace('replace-with-a-random-secret-at-least-32-characters', randomBytes(32).toString('hex'));
  writeFileSync(destination, content, { mode: 0o600, flag: 'wx' });
  console.log('Created ignored .env with private local database and JWT secrets.');
}

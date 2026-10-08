import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = fileURLToPath(new URL('../', import.meta.url));
const local = join(root, '.local');
const data = join(local, 'postgres');
const executableSuffix = process.platform === 'win32' ? '.exe' : '';
const candidateDirectories = [
  process.env.PG_BIN_PATH,
  ...(process.env.PATH ?? '').split(delimiter),
  ...(process.platform === 'win32' ? ['C:/Program Files/PostgreSQL/16/bin'] : []),
].filter(Boolean);

function run(binary, args) {
  const directory = candidateDirectories.find((entry) => existsSync(join(entry, binary + executableSuffix)));
  if (!directory) throw new Error(`${binary} was not found. Install PostgreSQL and set PG_BIN_PATH in .env.`);
  const result = spawnSync(join(directory, binary + executableSuffix), args, {
    stdio: 'inherit', windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${binary} failed (exit ${result.status}).`);
}

function localConfiguration() {
  const development = new URL(process.env.DATABASE_URL ?? '');
  const test = new URL(process.env.TEST_DATABASE_URL ?? '');
  const allowedHosts = ['127.0.0.1', 'localhost'];
  if (!allowedHosts.includes(development.hostname) || !allowedHosts.includes(test.hostname)) {
    throw new Error('Cluster commands require local database URLs; use db:check for an external server.');
  }
  if (development.port !== test.port || development.username !== test.username || development.password !== test.password) {
    throw new Error('The isolated local databases must use the same port and credentials.');
  }
  if (development.pathname === test.pathname) throw new Error('Development and test databases must be different.');
  if (!development.port || !development.username || !development.password) throw new Error('Local database port/user/password are required.');
  return { development, test };
}

async function connect(connectionString, action) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
  try { await client.connect(); return await action(client); }
  finally { await client.end(); }
}

async function check() {
  const urls = [process.env.DATABASE_URL, process.env.TEST_DATABASE_URL];
  if (!urls[0] || !urls[1] || new URL(urls[0]).pathname === new URL(urls[1]).pathname) {
    throw new Error('Configure separate development and test database URLs.');
  }
  for (const [index, url] of urls.entries()) {
    const result = await connect(url, (client) => client.query('SELECT current_database() AS database'));
    console.log(`${index === 0 ? 'Development' : 'Test'} database connected: ${result.rows[0].database}`);
  }
}

try {
  const command = process.argv[2];
  if (command === 'check') {
    await check();
  } else if (command === 'init') {
    const { development, test } = localConfiguration();
    mkdirSync(local, { recursive: true });
    if (!existsSync(join(data, 'PG_VERSION'))) {
      const passwordFile = join(local, 'initdb-password');
      writeFileSync(passwordFile, decodeURIComponent(development.password), { mode: 0o600 });
      try {
        run('initdb', ['-D', data, '-U', decodeURIComponent(development.username), '--encoding=UTF8', '--locale=C', '--auth-local=scram-sha-256', '--auth-host=scram-sha-256', `--pwfile=${passwordFile}`]);
      } finally { unlinkSync(passwordFile); }
    }
    if (!existsSync(join(data, 'postmaster.pid'))) {
      run('pg_ctl', ['-D', data, '-l', join(local, 'postgres.log'), '-o', `-p ${Number(development.port)} -h 127.0.0.1`, '-w', 'start']);
    }
    const admin = new URL(development); admin.pathname = '/postgres';
    await connect(admin.toString(), async (client) => {
      for (const url of [development, test]) {
        const name = decodeURIComponent(url.pathname.slice(1));
        const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
        if (!found.rowCount) await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
      }
    });
    await check();
  } else if (command === 'start' || command === 'stop') {
    const { development } = localConfiguration();
    if (!existsSync(join(data, 'PG_VERSION'))) throw new Error('Run npm run db:init first.');
    if (command === 'start') {
      if (existsSync(join(data, 'postmaster.pid'))) console.log('Isolated PostgreSQL cluster is already started.');
      else run('pg_ctl', ['-D', data, '-l', join(local, 'postgres.log'), '-o', `-p ${Number(development.port)} -h 127.0.0.1`, '-w', 'start']);
    } else {
      if (!existsSync(join(data, 'postmaster.pid'))) console.log('Isolated PostgreSQL cluster is already stopped.');
      else run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    }
  } else throw new Error('Usage: db.mjs init|start|stop|check');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

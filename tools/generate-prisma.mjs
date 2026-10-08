import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const schema = fileURLToPath(new URL('../apps/api/prisma/schema.prisma', import.meta.url));
const cli = join(dirname(require.resolve('prisma/package.json')), 'build/index.js');
// Generation needs no database connection or private local configuration.
const result = spawnSync(process.execPath, [cli, 'generate', '--schema', schema], {
  stdio: 'inherit',
  windowsHide: true,
  cwd: fileURLToPath(new URL('../apps/api/', import.meta.url)),
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'postgresql://unused:unused@localhost:5433/unused' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;


import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

const environmentPath = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(environmentPath)) loadEnvFile(environmentPath);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node -r ts-node/register prisma/seed.ts",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});

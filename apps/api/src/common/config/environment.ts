export function validateEnvironment(input: Record<string, unknown>) {
  const required = (key: string): string => {
    const value = input[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${key} is required. Run npm run setup:env.`);
    }
    return value;
  };
  const databaseUrl = required('DATABASE_URL');
  const testDatabaseUrl = required('TEST_DATABASE_URL');
  for (const [key, value] of [
    ['DATABASE_URL', databaseUrl],
    ['TEST_DATABASE_URL', testDatabaseUrl],
  ]) {
    const url = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2
    ) {
      throw new Error(`${key} must name a PostgreSQL database.`);
    }
  }
  const port = Number(input.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const jwtSecret = required('JWT_SECRET');
  if (jwtSecret.length < 32)
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  const webhookSecret = required('WEBHOOK_SECRET');
  const origin = new URL(required('FRONTEND_ORIGIN'));
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  ) {
    throw new Error('FRONTEND_ORIGIN must be one HTTP(S) origin.');
  }
  return {
    ...input,
    PORT: port,
    DATABASE_URL: databaseUrl,
    TEST_DATABASE_URL: testDatabaseUrl,
    JWT_SECRET: jwtSecret,
    WEBHOOK_SECRET: webhookSecret,
    FRONTEND_ORIGIN: origin.origin,
  };
}

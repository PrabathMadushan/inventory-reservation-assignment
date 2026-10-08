import { validateEnvironment } from './environment';

const valid = {
  DATABASE_URL: 'postgresql://test:password@localhost:5433/development',
  TEST_DATABASE_URL: 'postgresql://test:password@localhost:5433/test',
  JWT_SECRET: 'a-private-test-secret-with-at-least-32-characters',
  WEBHOOK_SECRET: 'test-webhook-secret-with-32-characters',
  FRONTEND_ORIGIN: 'http://localhost:5173',
};

describe('startup configuration', () => {
  it('defaults to the contracted port', () => {
    expect(validateEnvironment(valid).PORT).toBe(4000);
  });
  it.each(['0', '65536', '4000.5', 'not-a-port'])(
    'rejects invalid port %s',
    (PORT) => {
      expect(() => validateEnvironment({ ...valid, PORT })).toThrow('PORT');
    },
  );
  it.each(['DATABASE_URL', 'JWT_SECRET', 'WEBHOOK_SECRET'])(
    'fails fast without %s',
    (key) => {
      expect(() => validateEnvironment({ ...valid, [key]: '' })).toThrow(key);
    },
  );
  it('rejects a short webhook secret', () => {
    expect(() =>
      validateEnvironment({ ...valid, WEBHOOK_SECRET: 'too-short' }),
    ).toThrow('WEBHOOK_SECRET');
  });
  it('rejects wildcard CORS origins', () => {
    expect(() =>
      validateEnvironment({ ...valid, FRONTEND_ORIGIN: '*' }),
    ).toThrow();
  });
  it('rejects a non-PostgreSQL database URL', () => {
    expect(() =>
      validateEnvironment({
        ...valid,
        DATABASE_URL: 'https://example.test/db',
      }),
    ).toThrow('DATABASE_URL');
  });
});

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const test = new URL(process.env.TEST_DATABASE_URL!);

describe('Foundation API (real PostgreSQL)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  it('uses the separate test database', async () => {
    const result = await app.get(PrismaService).$queryRaw<
      Array<{ database: string }>
    >`SELECT current_database() AS database`;
    expect(result[0].database).toBe(decodeURIComponent(test.pathname.slice(1)));
  });

  it('serves JSON at the configured /api prefix with a real database connection', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect({ status: 'ok', database: 'connected' });
  });

  it('returns the contracted error shape for an unknown route', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/missing')
      .expect(404);
    expect(response.body).toEqual({
      code: 'NOT_FOUND',
      message: expect.any(String) as unknown,
    });
  });

  it('allows the configured frontend origin and idempotency header', () => {
    return request(app.getHttpServer())
      .options('/api')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Authorization,Idempotency-Key')
      .expect(204)
      .expect('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN!)
      .expect(
        'Access-Control-Allow-Headers',
        'Content-Type,Authorization,Idempotency-Key',
      );
  });
});

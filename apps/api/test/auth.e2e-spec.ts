import { Controller, Get, UseGuards } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/configure-app';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { CurrentUser } from '../src/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../src/auth/current-user';
import { demoProducts, demoUsers } from '../prisma/seed-data';

// Test-only endpoints exercise the real guards before order routes exist.
@Controller('phase3-test')
@UseGuards(JwtAuthGuard, RolesGuard)
class RoleProbeController {
  @Get('customer')
  @Roles('CUSTOMER')
  customer(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Get('operations')
  @Roles('OPERATIONS')
  operations(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}

describe('Authentication/products (real PostgreSQL and JWT)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule, AuthModule, PrismaModule],
      controllers: [RoleProbeController],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    jwt = app.get(JwtService);
    prisma = app.get(PrismaService);
  }, 30000);
  afterAll(async () => {
    await app?.close();
  });

  it.each(demoUsers)(
    'logs in $email and returns exactly the public user fields',
    async (user) => {
      const result = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password: 'DemoPass123!' })
        .expect(200);
      const login = result.body as {
        accessToken: string;
        user: AuthenticatedUser;
      };
      expect(Object.keys(login).sort()).toEqual(['accessToken', 'user']);
      expect(login.user).toEqual(user);
      expect(typeof login.accessToken).toBe('string');
      const claims = await jwt.verifyAsync<{
        sub: string;
        exp: number;
        iat: number;
      }>(login.accessToken);
      expect(claims.sub).toBe(user.id);
      expect(claims.exp - claims.iat).toBe(3600);
      expect(JSON.stringify(result.body)).not.toMatch(
        /password|hash|DemoPass123/,
      );
    },
  );

  it.each([
    { email: 'alice@example.test', password: 'incorrect' },
    { email: 'unknown@example.test', password: 'DemoPass123!' },
  ])('returns generic 401 for incorrect credentials', async (credentials) => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(credentials)
      .expect(401)
      .expect({ code: 'UNAUTHORIZED', message: 'Invalid email or password.' });
  });

  it.each([
    {},
    { email: 'invalid', password: 'DemoPass123!' },
    { email: 'alice@example.test', password: 123 },
    { email: 'alice@example.test', password: '' },
    {
      email: 'alice@example.test',
      password: 'DemoPass123!',
      role: 'OPERATIONS',
    },
    {
      email: 'alice@example.test',
      password: 'DemoPass123!',
      customerId: 'user-ops',
    },
  ])('rejects malformed/unsupported login fields', async (body) => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(body)
      .expect(400);
    expect(response.body).toEqual({
      code: 'VALIDATION_ERROR',
      message: expect.any(String) as unknown,
    });
  });

  it.each([undefined, 'Basic abc', 'Bearer invalid', 'Bearer a b'])(
    'rejects missing/malformed bearer authorization %s',
    async (authorization) => {
      const req = request(app.getHttpServer()).get('/api/products');
      if (authorization) req.set('Authorization', authorization);
      await req
        .expect(401)
        .expect({ code: 'UNAUTHORIZED', message: 'Unauthorized.' });
    },
  );

  it.each(['CUSTOMER', 'OPERATIONS'] as const)(
    'serves exact numeric product fields to %s',
    async (role) => {
      const user = demoUsers.find((account) => account.role === role)!;
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password: 'DemoPass123!' })
        .expect(200);
      const products = await request(app.getHttpServer())
        .get('/api/products')
        .set(
          'Authorization',
          `Bearer ${(login.body as { accessToken: string }).accessToken}`,
        )
        .expect(200);
      expect(products.body).toEqual({
        items: demoProducts
          .map((product) => ({
            ...product,
            unitPriceMinor: Number(product.unitPriceMinor),
            availableQuantity: Number(product.availableQuantity),
            currency: 'LKR',
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      });
    },
  );

  it('rejects expired, wrong-signature, wrong-algorithm, and unknown-user tokens', async () => {
    const invalid = [
      await jwt.signAsync({ sub: 'user-alice' }, { expiresIn: -1 }),
      await jwt.signAsync(
        { sub: 'user-alice' },
        { secret: 'wrong-signing-secret' },
      ),
      await jwt.signAsync({ sub: 'user-alice' }, { algorithm: 'HS512' }),
      await jwt.signAsync({ sub: 'missing-user' }),
      await jwt.signAsync(
        { sub: 'user-alice' },
        { audience: 'wrong-audience' },
      ),
    ];
    for (const token of invalid) {
      await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    }
  });

  it('enforces both role directions independently of UI navigation', async () => {
    const customer = await jwt.signAsync({ sub: 'user-alice' });
    const operations = await jwt.signAsync({ sub: 'user-ops' });
    await request(app.getHttpServer())
      .get('/api/phase3-test/customer')
      .set('Authorization', `Bearer ${customer}`)
      .expect(200)
      .expect(demoUsers[0]);
    await request(app.getHttpServer())
      .get('/api/phase3-test/operations')
      .set('Authorization', `Bearer ${customer}`)
      .expect(403)
      .expect({
        code: 'FORBIDDEN',
        message: 'This action is not allowed for your role.',
      });
    await request(app.getHttpServer())
      .get('/api/phase3-test/customer')
      .set('Authorization', `Bearer ${operations}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/phase3-test/operations')
      .set('Authorization', `Bearer ${operations}`)
      .expect(200)
      .expect(demoUsers[2]);
  });

  it('ignores elevated client role claims and reads the current database role', async () => {
    const token = await jwt.signAsync({
      sub: 'user-alice',
      role: 'OPERATIONS',
    });
    await request(app.getHttpServer())
      .get('/api/phase3-test/operations')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    try {
      await prisma.user.update({
        where: { id: 'user-alice' },
        data: { role: 'OPERATIONS' },
      });
      await request(app.getHttpServer())
        .get('/api/phase3-test/operations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    } finally {
      await prisma.user.update({
        where: { id: 'user-alice' },
        data: { role: 'CUSTOMER' },
      });
    }
  });
});

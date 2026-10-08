import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  // Production is published only through the local TLS proxy.
  if (process.env.NODE_ENV === 'production') {
    await app.listen(port, '127.0.0.1');
  } else {
    await app.listen(port);
  }
}
void bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'API startup failed.');
  process.exitCode = 1;
});

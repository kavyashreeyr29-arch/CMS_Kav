import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // rawBody exposes req.rawBody (the exact bytes) so GitHub webhook HMAC
  // signatures can be verified against the payload as GitHub signed it —
  // JSON.stringify(req.body) would not byte-match. See GithubWebhookGuard.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix(config.get<string>('apiPrefix')!);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  const corsOrigins = (config.get<string>('corsOrigin') ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });

  const port = config.get<number>('port')!;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`ElevatoHub API listening on http://localhost:${port}/${config.get('apiPrefix')}`);
}
bootstrap();

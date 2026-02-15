import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.WS_CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  const requestSizeLimit = process.env.REQUEST_SIZE_LIMIT ?? '256kb';
  app.use(json({ limit: requestSizeLimit }));
  app.use(urlencoded({ limit: requestSizeLimit, extended: true }));

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  console.log(`Mindscape API running on http://localhost:${port}`);
}

bootstrap();

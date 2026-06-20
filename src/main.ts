import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.use(helmet());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const correlationId = request.header('x-correlation-id') || randomUUID();
    response.setHeader('x-correlation-id', correlationId);
    next();
  });
  app.enableCors({
    origin: config.get<string>('FRONTEND_ORIGIN', 'http://localhost:3000').split(','),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key']
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  }));
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TerraXpert Pricing API')
    .setDescription('Versioned API for avocado observations, references and pricing calculations')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  await app.listen(Number(config.get('PORT', 4173)));
}

void bootstrap();

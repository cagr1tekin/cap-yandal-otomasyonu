import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { loadConfig } from './config';
import { configureApp } from './setup';

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app, config);
  app.enableShutdownHooks();

  // API belgesi yalnızca geliştirmede yayımlanır.
  if (config.NODE_ENV !== 'production') {
    const doc = new DocumentBuilder()
      .setTitle('Bilgisayar Mühendisliği ÇAP / YDP Takip API')
      .setDescription(
        'Selçuk Üniversitesi Teknoloji Fakültesi Bilgisayar Mühendisliği çift ana dal ve yan dal öğrenci takip sistemi',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
  }

  await app.listen(config.PORT, '127.0.0.1');
}
void bootstrap();

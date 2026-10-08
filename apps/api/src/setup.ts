import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { ProblemFilter } from './common/http';
import type { AppConfig } from './config';

/** Uygulama ve testlerin ortak ayarı: güvenlik başlıkları, CORS, önek, hata biçimi. */
export function configureApp(app: INestApplication, config: Pick<AppConfig, 'WEB_ORIGIN'>) {
  app.use(helmet());
  // Yalnızca web uygulamasının kökeni; API tarayıcıdan doğrudan değil, web sunucusundan çağrılır.
  app.enableCors({ origin: config.WEB_ORIGIN, credentials: false, methods: ['GET', 'POST', 'PUT', 'PATCH'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ProblemFilter());
  return app;
}

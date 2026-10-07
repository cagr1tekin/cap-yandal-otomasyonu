import { BullModule } from '@nestjs/bullmq';
import { Global, Module, type Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserThrottlerGuard } from './common/throttle';
import { LoggerModule } from 'nestjs-pino';
import { AdminController, TasksService } from './admin/admin';
import { ApplicationsController } from './applications/applications.controller';
import { ApplicationsService } from './applications/applications.service';
import { AuditModule } from './audit/audit.service';
import { AccessModule } from './auth/access.service';
import { AuthModule } from './auth/auth';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { APP_CONFIG, loadConfig, type AppConfig } from './config';
import { EnrollmentsController } from './enrollments/enrollments.controller';
import { EnrollmentsService } from './enrollments/enrollments.service';
import { FormsService } from './forms/forms.service';
import { IntegrationsModule } from './integrations/integrations.module';
import { HealthController, MeController, ReportsController } from './misc/misc';
import { MonitoringController, MonitoringService, SCAN_QUEUE, ScanProcessor } from './monitoring/monitoring';
import { MAIL_QUEUE, MailProcessor, NotificationsController, NotificationsService } from './notifications/notifications';
import { PrismaModule } from './prisma/prisma.service';
import { ReviewController } from './review/review.controller';
import { ReviewService } from './review/review.service';
import { ContextService } from './rules/context.service';
import { RulesController } from './rules/rules.controller';
import { RulesService } from './rules/rules.service';

const config = loadConfig();

@Global()
@Module({ providers: [{ provide: APP_CONFIG, useValue: config }], exports: [APP_CONFIG] })
class ConfigModule {}

function redisConnection(c: AppConfig) {
  const u = new URL(c.REDIS_URL);
  // redis://host:port/1 → 1 numaralı veritabanı (testler ayrı veritabanı kullanır)
  return { host: u.hostname, port: Number(u.port || 6379), db: Number(u.pathname.slice(1) || 0) };
}

const workers: Provider[] = config.WORKER_ENABLED ? [MailProcessor, ScanProcessor] : [];

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: config.NODE_ENV === 'test' ? 'silent' : 'info',
        transport: config.LOG_PRETTY ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        genReqId: (req, res) => {
          const id = (req.headers['x-request-id'] as string) ?? crypto.randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    BullModule.forRoot({ connection: redisConnection(config) }),
    BullModule.registerQueue({ name: MAIL_QUEUE }, { name: SCAN_QUEUE }),
    TerminusModule,
    PrismaModule,
    AuthModule,
    AccessModule,
    AuditModule,
    IntegrationsModule,
  ],
  controllers: [
    MeController,
    HealthController,
    ReportsController,
    CatalogController,
    RulesController,
    ApplicationsController,
    ReviewController,
    EnrollmentsController,
    MonitoringController,
    NotificationsController,
    AdminController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    NotificationsService,
    RulesService,
    ContextService,
    CatalogService,
    ApplicationsService,
    ReviewService,
    EnrollmentsService,
    FormsService,
    TasksService,
    MonitoringService,
    ...workers,
  ],
})
export class AppModule {}

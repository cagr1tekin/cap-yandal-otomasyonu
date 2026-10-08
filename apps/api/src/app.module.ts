import { BullModule } from '@nestjs/bullmq';
import { Global, Module, type Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuditModule } from './audit/audit.service';
import { AccessModule } from './auth/access.service';
import { AuthModule } from './auth/auth';
import { CatalogController, CatalogService } from './catalog/catalog';
import { UserThrottlerGuard } from './common/throttle';
import { APP_CONFIG, loadConfig, type AppConfig } from './config';
import { CourseRequestsService, CurriculumController, TemplatesService } from './curriculum/curriculum.controller';
import { CurriculumService } from './curriculum/curriculum.service';
import { DocumentsController, DocumentsService } from './documents/documents';
import { IdentityModule } from './identity/identity';
import { ImportsController, ImportsService } from './imports/imports';
import { IntegrationsModule } from './integrations/integrations.module';
import { MessagesController, MessagesService } from './messages/messages';
import { HealthController, MeController } from './misc/misc';
import { MAIL_QUEUE, MailProcessor, NotificationsController, NotificationsService } from './notifications/notifications';
import { PrismaModule } from './prisma/prisma.service';
import { ReviewsController, ReviewsService } from './reviews/reviews';
import { ChecksService } from './rules/checks.service';
import { RulesController } from './rules/rules.controller';
import { RulesService } from './rules/rules.service';
import { StudentRecordsController, StudentsController, StudentsService } from './students/students';
import { UsersController, UsersService } from './users/users';

const config = loadConfig();

@Global()
@Module({ providers: [{ provide: APP_CONFIG, useValue: config }], exports: [APP_CONFIG] })
class ConfigModule {}

function redisConnection(c: AppConfig) {
  const u = new URL(c.REDIS_URL);
  // redis://host:port/1 → 1 numaralı veritabanı (testler ayrı veritabanı kullanır)
  return { host: u.hostname, port: Number(u.port || 6379), db: Number(u.pathname.slice(1) || 0) };
}

const workers: Provider[] = config.WORKER_ENABLED ? [MailProcessor] : [];

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
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: config.NODE_ENV === 'test' ? 5000 : 300 }]),
    BullModule.forRoot({ connection: redisConnection(config) }),
    BullModule.registerQueue({ name: MAIL_QUEUE }),
    TerminusModule,
    PrismaModule,
    AuthModule,
    AccessModule,
    AuditModule,
    IdentityModule,
    IntegrationsModule,
  ],
  controllers: [
    MeController,
    HealthController,
    CatalogController,
    StudentsController,
    StudentRecordsController,
    UsersController,
    CurriculumController,
    DocumentsController,
    MessagesController,
    ReviewsController,
    RulesController,
    ImportsController,
    NotificationsController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    NotificationsService,
    CatalogService,
    RulesService,
    ChecksService,
    CurriculumService,
    CourseRequestsService,
    TemplatesService,
    DocumentsService,
    MessagesService,
    StudentsService,
    UsersService,
    ReviewsService,
    ImportsService,
    ...workers,
  ],
})
export class AppModule {}

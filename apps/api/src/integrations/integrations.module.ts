import { Global, Inject, Injectable, Module } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { APP_CONFIG, type AppConfig } from '../config';
import { CacheService } from './cache.service';
import { HttpObisAdapter, HttpOsymAdapter } from './obis.http';
import { ObisPort, OsymPort } from './obis.port';

export abstract class MailPort {
  abstract send(to: string, subject: string, text: string): Promise<void>;
}

@Injectable()
export class SmtpMailAdapter extends MailPort {
  private readonly transport: Transporter;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
    this.transport = nodemailer.createTransport({ host: config.SMTP_HOST, port: config.SMTP_PORT, secure: false });
  }

  async send(to: string, subject: string, text: string) {
    await this.transport.sendMail({ from: this.config.MAIL_FROM, to, subject, text });
  }
}

export interface ExternalLink {
  key: string;
  label: string;
  system: string;
  url: string;
  description: string;
}

/** Dış sistemlere yönlendirme bağlantıları (FR-17), tek yerden yapılandırılır. */
@Injectable()
export class LinkRegistry {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  all(): ExternalLink[] {
    return [
      {
        key: 'obis-kayit',
        label: 'Kesin kayıt',
        system: 'OBİS',
        url: this.config.OBIS_PORTAL_URL,
        description: 'Kabul edildiğiniz programa kesin kayıt OBİS\'te yapılır.',
      },
      {
        key: 'obis-ders',
        label: 'Ders kaydı',
        system: 'OBİS',
        url: this.config.OBIS_PORTAL_URL,
        description: 'Ders kaydı, ekle-bırak ve danışman onayı OBİS\'te yapılır.',
      },
      {
        key: 'obis-harc',
        label: 'Katkı payı / öğrenim ücreti',
        system: 'OBİS',
        url: this.config.OBIS_PORTAL_URL,
        description: 'Katkı payı ve ikinci öğretim ücreti OBİS üzerinden ödenir.',
      },
      {
        key: 'osym-dogrulama',
        label: 'YKS sonuç belgesi doğrulama',
        system: 'ÖSYM',
        url: 'https://sonuc.osym.gov.tr',
        description: 'Sonuç belgesinin aslı ÖSYM sonuç sisteminden alınır.',
      },
      {
        key: 'edevlet-belge',
        label: 'Öğrenci belgesi / transkript',
        system: 'e-Devlet',
        url: 'https://www.turkiye.gov.tr',
        description: 'Bu sistem belge istemez; resmî belge gerekiyorsa e-Devlet\'ten alınır.',
      },
      {
        key: 'birim-muafiyet',
        label: 'Ders saydırma (muafiyet)',
        system: 'Birim öğrenci işleri',
        url: 'https://www.selcuk.edu.tr',
        description: 'Programdan ayrılınca derslerin ana dala sayılması için dilekçeyle birime başvurulur.',
      },
    ];
  }
}

@Global()
@Module({
  providers: [
    CacheService,
    HttpObisAdapter,
    { provide: ObisPort, useExisting: HttpObisAdapter },
    { provide: OsymPort, useClass: HttpOsymAdapter },
    { provide: MailPort, useClass: SmtpMailAdapter },
    LinkRegistry,
  ],
  exports: [CacheService, ObisPort, OsymPort, MailPort, LinkRegistry],
})
export class IntegrationsModule {}

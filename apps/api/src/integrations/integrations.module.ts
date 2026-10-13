import { Global, Inject, Injectable, Module } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { APP_CONFIG, type AppConfig } from '../config';
import { CacheService } from './cache.service';

export abstract class MailPort {
  abstract send(to: string, subject: string, text: string): Promise<void>;
}

@Injectable()
export class SmtpMailAdapter extends MailPort {
  private readonly transport: Transporter;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
    this.transport = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    });
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

const DEPT = 'https://webadmin.selcuk.edu.tr/uploads//Contents/teknoloji-bilgisayar_muhendisligi/icerik-serbest/73886';

/**
 * Bölümün "Çift Anadal" sayfasındaki belgeler ve sistemin kapsamı dışındaki işlemler için yönlendirmeler.
 * Kaynak: https://selcuk.edu.tr/birim/sayfa/6465/cift-anadal-2525 (8/10/2026).
 */
@Injectable()
export class LinkRegistry {
  all(): ExternalLink[] {
    return [
      {
        key: 'bolum-cap',
        label: 'Bölüm Çift Anadal sayfası',
        system: 'Bilgisayar Mühendisliği',
        url: 'https://selcuk.edu.tr/birim/sayfa/6465/cift-anadal-2525',
        description: 'Komisyon üyeleri, duyurular ve aşağıdaki belgelerin asılları.',
      },
      {
        key: 'yonetmelik',
        label: 'YÖK Geçiş, Çift Anadal ve Yan Dal Yönetmeliği',
        system: 'Belge',
        url: `${DEPT}/01%20-%20Yo%CC%88netmelik_04062026120421.pdf`,
        description: 'Yükseköğretim Kurumlarında … Çift Anadal, Yan Dal … Esaslarına İlişkin Yönetmelik.',
      },
      {
        key: 'yonerge',
        label: 'Selçuk Üniversitesi Çift Anadal Programı Yönergesi',
        system: 'Belge',
        url: `${DEPT}/02%20-%20Yo%CC%88nerge_04062026120421.pdf`,
        description: 'Başvuru şartları, kayıt silme ve mezuniyet hükümleri.',
      },
      {
        key: 'rehber',
        label: 'Çift Anadal Rehberi (Şubat 2025)',
        system: 'Belge',
        url: `${DEPT}/03%20-%20Rehber_04062026120421.pdf`,
        description: 'Başvuru, kayıt, ders kaydı ve özel şartlı derslerin muafiyeti adımları.',
      },
      {
        key: 'form01',
        label: 'FORM01 - Ders Kayıt Formu',
        system: 'Belge',
        url: `${DEPT}/FORM01%20-%20Ders%20Kay%C4%B1t%20Formu_04062026120421.docx`,
        description: 'Bu sistemde çevrim içi doldurulur ve imzalanır; boş form bölüm sitesindedir.',
      },
      {
        key: 'protokol-eem',
        label: 'Protokol: Elektrik-Elektronikten Bilgisayara',
        system: 'Belge',
        url: `${DEPT}/Protokol%20-%20Elektrik-Elektronikten%20Bilgisayara_04062026120421.pdf`,
        description: '135 AKTS, 8 özel şart.',
      },
      {
        key: 'protokol-makine',
        label: 'Protokol: Makineden Bilgisayara',
        system: 'Belge',
        url: `${DEPT}/Protokol%20-%20%20Makineden%20Bilgisayara_04062026120421.pdf`,
        description: '171 AKTS, 2 özel şart.',
      },
      {
        key: 'obis',
        label: 'Ders kaydı ve notlar',
        system: 'OBİS',
        url: 'https://obis.selcuk.edu.tr',
        description: 'Derslerin resmî kaydı ve notlar OBİS’te tutulur. Bu sistemin OBİS bağlantısı yoktur; formlar ve takip buradadır.',
      },
      {
        key: 'edevlet',
        label: 'Transkript ve öğrenci belgesi',
        system: 'e-Devlet',
        url: 'https://www.turkiye.gov.tr',
        description: 'Başvuruda yüklenen transkript ve YKS belgeleri e-Devlet ya da öğrenci işlerinden alınır.',
      },
    ];
  }
}

@Global()
@Module({
  providers: [CacheService, { provide: MailPort, useClass: SmtpMailAdapter }, LinkRegistry],
  exports: [CacheService, MailPort, LinkRegistry],
})
export class IntegrationsModule {}

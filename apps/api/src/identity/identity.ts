import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { newResetToken } from '../auth/password';
import { APP_CONFIG, type AppConfig } from '../config';
import { notFound } from '../common/http';
import { MailPort } from '../integrations/integrations.module';
import { PrismaService } from '../prisma/prisma.service';

export interface IdentityAccount {
  username: string;
  email: string;
  displayName: string;
}

/** Şifre belirleme bağlantısının geçerlilik süresi. */
export const INVITE_HOURS = 72;

/**
 * Kimlik servisi arayüzü. Hesapları koordinatör açar; şifreyi kullanıcı e-postasına gelen tek kullanımlık
 * bağlantıyla kendisi belirler (sistem şifreyi yalnızca özet olarak saklar). Testlerde sahtesiyle değiştirilir.
 */
export abstract class IdentityPort {
  /** Hesabı açar ya da varsa günceller. */
  abstract ensure(account: IdentityAccount): Promise<void>;
  /** Şifre belirleme bağlantısı gönderir. */
  abstract invite(username: string): Promise<void>;
  abstract setEnabled(username: string, enabled: boolean): Promise<void>;
}

/**
 * Yerel kimlik: hesap ve etkinlik bilgisi zaten User tablosunda olduğu için ensure ve setEnabled ek iş yapmaz;
 * davet, tek kullanımlık anahtarı (özetini) kaydedip bağlantıyı e-postayla gönderir.
 */
@Injectable()
export class LocalIdentity extends IdentityPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailPort,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    super();
  }

  async ensure() {}

  async setEnabled() {}

  async invite(username: string) {
    const u = await this.prisma.user.findUnique({ where: { username } });
    if (!u) throw notFound('Hesap');
    const { token, hash } = newResetToken();
    await this.prisma.user.update({ where: { id: u.id }, data: { resetTokenHash: hash, resetExpiresAt: new Date(Date.now() + INVITE_HOURS * 3600_000) } });
    const link = `${this.config.WEB_ORIGIN}/sifre-belirle?anahtar=${token}`;
    await this.mail.send(
      u.email,
      'ÇAP / YDP Takip Sistemi: şifrenizi belirleyin',
      [
        `Merhaba ${u.displayName},`,
        '',
        `Bilgisayar Mühendisliği ÇAP / YDP Takip Sistemi hesabınızın kullanıcı adı: ${u.username}`,
        `Şifrenizi aşağıdaki bağlantıdan belirleyin (${INVITE_HOURS} saat geçerli, tek kullanımlık):`,
        link,
        '',
        'Bu e-postayı siz istemediyseniz dikkate almayın.',
      ].join('\n'),
    );
  }
}

@Global()
@Module({ providers: [{ provide: IdentityPort, useClass: LocalIdentity }], exports: [IdentityPort] })
export class IdentityModule {}

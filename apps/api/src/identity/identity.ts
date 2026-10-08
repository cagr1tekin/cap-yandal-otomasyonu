import { Global, Inject, Injectable, Logger, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config';
import { Problem } from '../common/http';

export interface IdentityAccount {
  username: string;
  email: string;
  displayName: string;
}

/**
 * Kimlik servisi arayüzü. Hesapları koordinatör açar; şifreyi kullanıcı e-postasına gelen tek kullanımlık
 * bağlantıyla kendisi belirler (sistem şifre görmez ve saklamaz). Testlerde sahtesiyle değiştirilir.
 */
export abstract class IdentityPort {
  /** Hesabı açar ya da varsa günceller. */
  abstract ensure(account: IdentityAccount): Promise<void>;
  /** Şifre belirleme bağlantısı gönderir. */
  abstract invite(username: string): Promise<void>;
  abstract setEnabled(username: string, enabled: boolean): Promise<void>;
}

/** Keycloak yönetim API'si; yalnızca kullanıcı yönetimi yetkisi olan servis hesabıyla. */
@Injectable()
export class KeycloakIdentity extends IdentityPort {
  private readonly logger = new Logger('Identity');
  private token: { value: string; until: number } | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
  }

  private get base() {
    return `${this.config.KEYCLOAK_URL}/admin/realms/${this.config.KEYCLOAK_REALM}`;
  }

  private async accessToken() {
    if (this.token && this.token.until > Date.now()) return this.token.value;
    const res = await fetch(`${this.config.KEYCLOAK_URL}/realms/${this.config.KEYCLOAK_REALM}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: this.config.KEYCLOAK_ADMIN_CLIENT_ID, client_secret: this.config.KEYCLOAK_ADMIN_CLIENT_SECRET }),
    });
    if (!res.ok) throw this.fail('Kimlik servisine bağlanılamadı', res.status);
    const t = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: t.access_token, until: Date.now() + (t.expires_in - 30) * 1000 };
    return t.access_token;
  }

  private async call(path: string, init: RequestInit = {}) {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${await this.accessToken()}`, 'content-type': 'application/json', ...init.headers },
    });
    return res;
  }

  private fail(message: string, status: number) {
    this.logger.error(`${message} (${status})`);
    return new Problem(502, 'Kimlik servisi hatası', `${message}.`);
  }

  private async findId(username: string) {
    const res = await this.call(`/users?username=${encodeURIComponent(username)}&exact=true`);
    if (!res.ok) throw this.fail('Kullanıcı aranamadı', res.status);
    const list = (await res.json()) as { id: string }[];
    return list[0]?.id ?? null;
  }

  async ensure(a: IdentityAccount) {
    const [firstName, ...rest] = a.displayName.replace(/[^\p{L}\p{N} .'-]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ');
    const body = { username: a.username, email: a.email, firstName, lastName: rest.join(' ') || '-', enabled: true, emailVerified: true };
    const id = await this.findId(a.username);
    const res = id ? await this.call(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }) : await this.call('/users', { method: 'POST', body: JSON.stringify(body) });
    if (res.status === 409) throw new Problem(409, 'Durum çakışması', 'Bu e-posta adresi kimlik servisinde başka bir hesapta kayıtlı.');
    if (!res.ok) throw this.fail('Hesap açılamadı', res.status);
  }

  async invite(username: string) {
    const id = await this.findId(username);
    if (!id) throw this.fail('Hesap kimlik servisinde bulunamadı', 404);
    const qs = new URLSearchParams({ client_id: 'cap-web', redirect_uri: `${this.config.WEB_ORIGIN}/giris`, lifespan: String(72 * 3600) });
    const res = await this.call(`/users/${id}/execute-actions-email?${qs}`, { method: 'PUT', body: JSON.stringify(['UPDATE_PASSWORD']) });
    if (!res.ok) throw this.fail('Şifre belirleme bağlantısı gönderilemedi', res.status);
  }

  async setEnabled(username: string, enabled: boolean) {
    const id = await this.findId(username);
    if (!id) return;
    const res = await this.call(`/users/${id}`, { method: 'PUT', body: JSON.stringify({ enabled }) });
    if (!res.ok) throw this.fail('Hesap durumu değiştirilemedi', res.status);
  }
}

@Global()
@Module({ providers: [{ provide: IdentityPort, useClass: KeycloakIdentity }], exports: [IdentityPort] })
export class IdentityModule {}

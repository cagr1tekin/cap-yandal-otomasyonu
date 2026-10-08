/**
 * infra/keycloak/realm.json dosyasını USERS listesinden üretir.
 * Kullanım: pnpm --filter @cap/seed-data build && pnpm --filter @cap/seed-data realm
 *
 * Güvenlik ayarları (docs/GUVENLIK.md): kendi kendine kayıt kapalı, kaba kuvvet koruması açık,
 * şifre politikası, e-posta bağlantısıyla şifre belirleme / sıfırlama (yerelde Mailpit).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEV_PASSWORD, USERS } from './users';

const WEB = 'http://localhost:3000';

const realm = {
  realm: 'selcuk',
  enabled: true,
  displayName: 'Selçuk Üniversitesi (deneme)',
  internationalizationEnabled: true,
  supportedLocales: ['tr', 'en'],
  defaultLocale: 'tr',
  accessTokenLifespan: 900,
  ssoSessionIdleTimeout: 3600,
  ssoSessionMaxLifespan: 36000,
  actionTokenGeneratedByAdminLifespan: 259200,
  sslRequired: 'external',
  // Hesapları koordinatör açar; öğrenciler kendi kendine kayıt olamaz.
  registrationAllowed: false,
  resetPasswordAllowed: true,
  rememberMe: false,
  verifyEmail: false,
  loginWithEmailAllowed: true,
  duplicateEmailsAllowed: false,
  editUsernameAllowed: false,
  bruteForceProtected: true,
  permanentLockout: false,
  failureFactor: 5,
  waitIncrementSeconds: 60,
  maxFailureWaitSeconds: 900,
  maxDeltaTimeSeconds: 43200,
  passwordPolicy: 'length(10) and digits(1) and upperCase(1) and lowerCase(1) and notUsername(undefined) and notEmail(undefined) and passwordHistory(3)',
  smtpServer: { host: 'mailpit', port: '1025', from: 'noreply@cap.test', fromDisplayName: 'Bilgisayar Müh. ÇAP / YDP' },
  clients: [
    {
      clientId: 'cap-web',
      name: 'Bilgisayar Mühendisliği ÇAP / YDP Takip Sistemi',
      enabled: true,
      publicClient: false,
      // Yalnızca yerel geliştirme için; apps/web/.env.example ile aynı.
      secret: 'cap-web-dev-secret',
      standardFlowEnabled: true,
      directAccessGrantsEnabled: false,
      redirectUris: [`${WEB}/*`],
      webOrigins: [WEB],
      attributes: { 'post.logout.redirect.uris': `${WEB}/*`, 'pkce.code.challenge.method': 'S256' },
      protocolMappers: [
        {
          name: 'audience',
          protocol: 'openid-connect',
          protocolMapper: 'oidc-audience-mapper',
          config: { 'included.client.audience': 'cap-web', 'access.token.claim': 'true', 'id.token.claim': 'false' },
        },
      ],
    },
    {
      // API'nin hesap açmak için kullandığı servis hesabı: yalnızca kullanıcı yönetimi yetkisi.
      clientId: 'cap-api',
      name: 'ÇAP / YDP API (hesap yönetimi)',
      enabled: true,
      publicClient: false,
      secret: 'cap-api-dev-secret',
      standardFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: true,
    },
  ],
  users: [
    {
      username: 'service-account-cap-api',
      enabled: true,
      serviceAccountClientId: 'cap-api',
      clientRoles: { 'realm-management': ['manage-users', 'view-users', 'query-users'] },
    },
    ...USERS.map((u) => {
      // Keycloak kişi adı alanlarında / ( ) — gibi karakterlere izin vermez.
      const clean = u.displayName.replace(/[^\p{L}\p{N} .'-]/gu, ' ').replace(/\s+/g, ' ').trim();
      const [firstName, ...rest] = clean.split(' ');
      return {
        username: u.username,
        enabled: true,
        emailVerified: true,
        email: u.email,
        firstName,
        lastName: rest.join(' ') || '-',
        credentials: [{ type: 'password', value: DEV_PASSWORD, temporary: false }],
      };
    }),
  ],
};

const out = resolve(process.argv[2] ?? 'realm.json');
writeFileSync(out, JSON.stringify(realm, null, 2));
console.log(`${USERS.length} kullanıcı → ${out}`);

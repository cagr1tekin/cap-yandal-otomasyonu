/**
 * infra/keycloak/realm.json dosyasını USERS listesinden üretir.
 * Kullanım: pnpm --filter @cap/seed-data build && pnpm --filter @cap/seed-data realm
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEV_PASSWORD, USERS } from './users';

// Keycloak yalnızca kimlik doğrular; yetki uygulamadaki rol atamalarından gelir.
const realm = {
  realm: 'selcuk',
  enabled: true,
  displayName: 'Selçuk Üniversitesi (deneme)',
  internationalizationEnabled: true,
  supportedLocales: ['tr', 'en'],
  defaultLocale: 'tr',
  accessTokenLifespan: 3600,
  ssoSessionIdleTimeout: 28800,
  sslRequired: 'none',
  // Öğrenciler hesabını kendisi açar (kullanıcı adı: öğrenci numarası); personel rolünü bölüm başkanı atar.
  registrationAllowed: true,
  registrationEmailAsUsername: false,
  editUsernameAllowed: false,
  verifyEmail: false,
  clients: [
    {
      clientId: 'cap-web',
      name: 'Bilgisayar Mühendisliği ÇAP / Yan Dal Otomasyonu',
      enabled: true,
      publicClient: false,
      // Yalnızca yerel geliştirme için; apps/web/.env.example ile aynı.
      secret: 'cap-web-dev-secret',
      standardFlowEnabled: true,
      directAccessGrantsEnabled: true,
      redirectUris: ['http://localhost:3000/*'],
      webOrigins: ['http://localhost:3000'],
      attributes: { 'post.logout.redirect.uris': 'http://localhost:3000/*', 'pkce.code.challenge.method': 'S256' },
      protocolMappers: [
        {
          name: 'audience',
          protocol: 'openid-connect',
          protocolMapper: 'oidc-audience-mapper',
          config: { 'included.client.audience': 'cap-web', 'access.token.claim': 'true', 'id.token.claim': 'false' },
        },
      ],
    },
  ],
  users: USERS.map((u) => {
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
};

const out = resolve(process.argv[2] ?? 'realm.json');
writeFileSync(out, JSON.stringify(realm, null, 2));
console.log(`${realm.users.length} kullanıcı → ${out}`);

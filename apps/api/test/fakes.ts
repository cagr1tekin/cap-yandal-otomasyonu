import { USERS } from '@cap/seed-data';
import type { JWTPayload } from 'jose';
import { TokenVerifier } from '../src/auth/auth';

/** Testte belirteç = kullanıcı adı. Yetki veritabanındaki rol atamalarından gelir. */
export class FakeTokenVerifier extends TokenVerifier {
  async verify(token: string): Promise<JWTPayload> {
    // "yeni." ile başlayan belirteç: Keycloak'ta kendi hesabını yeni açmış kullanıcı.
    const u = USERS.find((x) => x.username === token) ?? (token.startsWith('yeni.') ? { username: token, displayName: token, email: `${token}@ogrenci.test` } : null);
    if (!u) throw new Error('bilinmeyen kullanıcı');
    return { sub: `sub-${u.username}`, preferred_username: u.username, name: u.displayName, email: u.email } as JWTPayload;
  }
}

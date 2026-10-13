import { USERS } from '@cap/seed-data';
import type { JWTPayload } from 'jose';
import { TokenVerifier } from '../src/auth/auth';
import { IdentityPort, type IdentityAccount } from '../src/identity/identity';

/** Testte belirteç = kullanıcı adı ("sub:" önekiyle sahte kimlik de verilebilir). */
export class FakeTokenVerifier extends TokenVerifier {
  async verify(token: string): Promise<JWTPayload> {
    if (token === 'bozuk') throw new Error('imza geçersiz');
    const [username, sub] = token.split('|');
    const known = USERS.find((x) => x.username === username);
    return { sub: sub ?? `sub-${username}`, preferred_username: username, name: known?.displayName ?? username, email: known?.email };
  }
}

/** Bellek içi kimlik servisi: açılan hesapları ve gönderilen davetleri kaydeder. */
export class FakeIdentity extends IdentityPort {
  accounts = new Map<string, IdentityAccount & { enabled: boolean }>();
  invites: string[] = [];

  async ensure(a: IdentityAccount) {
    this.accounts.set(a.username, { ...a, enabled: true });
  }

  async invite(username: string) {
    this.invites.push(username);
    return null;
  }

  async setEnabled(username: string, enabled: boolean) {
    const a = this.accounts.get(username);
    if (a) a.enabled = enabled;
  }
}

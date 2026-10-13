import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'node:crypto';

/** Oran sınırı kullanıcı başına sayılır (belirteç özeti); giriş uçlarında hesap başına, diğerlerinde IP'ye göre. */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const auth: string | undefined = req.headers?.authorization;
    if (auth?.startsWith('Bearer ')) {
      // Belirtecin imza kısmı değil, kullanıcıya özgü gövdesi (sub) kullanılır.
      try {
        const payload = JSON.parse(Buffer.from(auth.slice(7).split('.')[1], 'base64url').toString());
        if (payload.sub) return `u:${payload.sub}`;
      } catch {
        /* geçersiz belirteç: IP'ye düş */
      }
      return `t:${createHash('sha256').update(auth).digest('hex').slice(0, 16)}`;
    }
    // Giriş uçları web sunucusu üzerinden çağrıldığı için IP herkes için aynıdır; sınır hesap başına sayılır.
    const body = req.body as { username?: unknown; token?: unknown } | undefined;
    if (typeof body?.username === 'string') return `l:${body.username.trim().toLowerCase()}`;
    if (typeof body?.token === 'string') return `r:${createHash('sha256').update(body.token).digest('hex').slice(0, 16)}`;
    return req.ip;
  }
}

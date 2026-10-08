import 'server-only';
import { cache } from 'react';
import type { Role } from '@cap/contracts';
import { currentUser } from './auth';
import type { Me } from './types';

/**
 * Oturumdaki kullanıcının rolü. Yetkinin kaynağı veritabanı olduğu için belirtece değil API'nin /me
 * yanıtına bakılır. Kimliği doğrulanmış ama sistemde hesabı olmayan kullanıcı için "tanımsız" döner.
 */
export const getSession = cache(async (): Promise<{ me: (Me & { accessToken: string }) | null; unknown: boolean }> => {
  const user = await currentUser();
  if (!user) return { me: null, unknown: false };
  try {
    const res = await fetch(`${process.env.API_URL}/me`, { headers: { authorization: `Bearer ${user.accessToken}` }, cache: 'no-store' });
    if (res.status === 403) return { me: null, unknown: true };
    if (!res.ok) return { me: null, unknown: false };
    return { me: { ...((await res.json()) as Me), accessToken: user.accessToken }, unknown: false };
  } catch {
    return { me: null, unknown: false };
  }
});

export const getMe = async () => (await getSession()).me;

export const hasRole = (me: { role: Role } | null, ...roles: Role[]) => !!me && roles.includes(me.role);

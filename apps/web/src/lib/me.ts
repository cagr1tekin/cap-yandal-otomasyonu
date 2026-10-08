import 'server-only';
import { cache } from 'react';
import type { Role } from '@cap/contracts';
import { currentUser } from './auth';
import type { Me } from './types';

/**
 * Oturumdaki personelin rolleri ve kapsamı. Yetkinin kaynağı veritabanındaki rol atamaları olduğu için
 * (KARARLAR K-1) belirteçteki rollere değil API'nin /me yanıtına bakılır. İstek başına bir kez çağrılır.
 */
export const getMe = cache(async (): Promise<(Me & { accessToken: string }) | null> => {
  const user = await currentUser();
  if (!user) return null;
  try {
    const res = await fetch(`${process.env.API_URL}/me`, { headers: { authorization: `Bearer ${user.accessToken}` }, cache: 'no-store' });
    if (!res.ok) return null;
    const me = (await res.json()) as Me;
    return { ...me, accessToken: user.accessToken };
  } catch {
    return null;
  }
});

export const hasRole = (me: { roles: Role[] } | null, ...roles: Role[]) => !!me && roles.some((r) => me.roles.includes(r));

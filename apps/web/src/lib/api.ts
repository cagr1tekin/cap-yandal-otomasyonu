import 'server-only';
import { redirect } from 'next/navigation';
import { API_BASE as BASE, currentUser } from './auth';

export interface Problem {
  status: number;
  title: string;
  detail?: string;
  errors?: { path: string; message: string }[];
  results?: { code: string; title: string; message: string; article: string }[];
  needsOsym?: boolean;
  warnings?: { code: string; message: string }[];
}

export class ApiError extends Error {
  constructor(public problem: Problem) {
    super(problem.detail ?? problem.title);
  }
}

/** API çağrısı (yalnızca sunucuda). Oturum yoksa ya da süresi dolduysa giriş sayfasına yönlendirir. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const user = await currentUser();
  if (!user) redirect('/giris');
  const { json, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    cache: 'no-store',
    headers: {
      authorization: `Bearer ${user.accessToken}`,
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401) redirect('/giris');
  if (!res.ok) {
    const problem = (await res.json().catch(() => ({ status: res.status, title: 'Hata' }))) as Problem;
    throw new ApiError({ ...problem, status: res.status });
  }
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('json') ? res.json() : res.text()) as Promise<T>;
}

export async function apiRaw(path: string): Promise<Response> {
  const user = await currentUser();
  if (!user) redirect('/giris');
  return fetch(`${BASE}${path}`, { headers: { authorization: `Bearer ${user.accessToken}` }, cache: 'no-store' });
}

/** Sunucu eylemleri için ortak sonuç biçimi. */
/** link: e-posta kapalıyken koordinatörün kişiye ileteceği şifre belirleme bağlantısı. */
export type ActionState = { ok: boolean; message?: string; problem?: Problem; link?: string } | null;

export async function act(fn: () => Promise<unknown>, okMessage: string): Promise<ActionState> {
  try {
    await fn();
    return { ok: true, message: okMessage };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: e.problem.detail ?? e.problem.title, problem: e.problem };
    // redirect() hatasını yeniden fırlat
    throw e;
  }
}

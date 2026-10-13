'use server';

import { redirect } from 'next/navigation';
import { publicApi } from '@/lib/auth';

export interface PublicFormState {
  error?: string;
  done?: boolean;
}

export async function setPassword(_: PublicFormState, form: FormData): Promise<PublicFormState> {
  const password = String(form.get('password') ?? '');
  if (password !== String(form.get('password2') ?? '')) return { error: 'Şifreler aynı değil.' };
  const r = await publicApi('/auth/password', { token: String(form.get('token') ?? ''), password });
  if (!r.ok) return { error: r.detail };
  redirect('/giris?sifre=tamam');
}

export async function forgotPassword(_: PublicFormState, form: FormData): Promise<PublicFormState> {
  const r = await publicApi('/auth/forgot', { username: String(form.get('username') ?? '').trim() });
  if (!r.ok) return { error: r.detail };
  return { done: true };
}

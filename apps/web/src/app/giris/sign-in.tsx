'use client';

import { signIn } from 'next-auth/react';
import { LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { WAKING } from '@/lib/waking';

/** Sunucu uyanırken her deneme ~50 sn bekler; uyanma ~1-1,5 dk sürdüğü için birkaç kez kendiliğinden denenir. */
const WAKE_RETRIES = 2;

export function SignInForm({ callbackUrl, initialError }: { callbackUrl: string; initialError?: string }) {
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);
  const [waking, setWaking] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(undefined);
    const form = new FormData(e.currentTarget);
    const credentials = { username: form.get('username'), password: form.get('password'), redirect: false };
    let res = await signIn('credentials', credentials);
    for (let i = 0; i < WAKE_RETRIES && res?.error === WAKING; i++) {
      setWaking(true);
      res = await signIn('credentials', credentials);
    }
    setWaking(false);
    if (res?.ok && !res.error) {
      window.location.assign(callbackUrl);
      return;
    }
    setError(res?.error && res.error !== 'CredentialsSignin' ? res.error : 'Kullanıcı adı ya da şifre hatalı.');
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      {error && <Alert tone="bad">{error}</Alert>}
      {waking && <Alert tone="info">Sunucu uykudan uyanıyor; bu bir dakika kadar sürebilir. Sayfayı kapatmayın, giriş kendiliğinden tamamlanacak.</Alert>}
      <Field label="Kullanıcı adı" htmlFor="username" hint="Öğrenciler için öğrenci numarası">
        <Input id="username" name="username" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Şifre" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button size="lg" type="submit" disabled={pending} className="w-full">
        <LogIn aria-hidden className="size-4" /> {pending ? 'GİRİŞ YAPILIYOR…' : 'GİRİŞ YAP'}
      </Button>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { Alert, Button, Field, Input } from '@/components/ui';
import { forgotPassword, setPassword, type PublicFormState } from './actions';

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<PublicFormState, FormData>(setPassword, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="bad">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Field label="Yeni şifre" htmlFor="password" hint="En az 10 karakter">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required autoFocus />
      </Field>
      <Field label="Yeni şifre (tekrar)" htmlFor="password2">
        <Input id="password2" name="password2" type="password" autoComplete="new-password" minLength={10} maxLength={128} required />
      </Field>
      <Button size="lg" type="submit" disabled={pending} className="w-full">
        {pending ? 'KAYDEDİLİYOR…' : 'ŞİFREYİ BELİRLE'}
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<PublicFormState, FormData>(forgotPassword, {});
  if (state.done && state.mail === false) {
    return <Alert tone="info">Bu sistemde e-posta gönderimi kapalı. Yeni şifre belirleme bağlantısı için ÇAP / YDP koordinatörüne başvurun; koordinatör bağlantıyı size iletir.</Alert>;
  }
  if (state.done) {
    return <Alert tone="ok">Hesap varsa kayıtlı e-posta adresine şifre belirleme bağlantısı gönderildi. Gelen kutunuzu ve istenmeyen klasörünü kontrol edin.</Alert>;
  }
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="bad">{state.error}</Alert>}
      <Field label="Kullanıcı adı" htmlFor="username" hint="Öğrenciler için öğrenci numarası">
        <Input id="username" name="username" autoComplete="username" required autoFocus />
      </Field>
      <Button size="lg" type="submit" disabled={pending} className="w-full">
        {pending ? 'GÖNDERİLİYOR…' : 'BAĞLANTI GÖNDER'}
      </Button>
    </form>
  );
}

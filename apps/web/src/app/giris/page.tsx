import Link from 'next/link';
import { Alert, Card, Page, PageHero } from '@/components/ui';
import { SignInForm } from './sign-in';

export const metadata = { title: 'Giriş' };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ donus?: string; callbackUrl?: string; sifre?: string }> }) {
  const { donus, callbackUrl: cb, sifre } = await searchParams;
  const target = donus ?? (cb ? new URL(cb, 'http://x').pathname : undefined);
  const callbackUrl = target?.startsWith('/') && !target.startsWith('//') && target !== '/giris' ? target : '/';
  return (
    <>
      <PageHero title="Giriş" subtitle="Koordinatör, öğrenci ve bölüm başkanı aynı yerden giriş yapar; ne görüleceğini hesabın rolü belirler." />
      <Page className="max-w-xl">
        <Card className="space-y-4">
          {sifre === 'tamam' && <Alert tone="ok">Şifreniz belirlendi. Şimdi giriş yapabilirsiniz.</Alert>}
          <SignInForm callbackUrl={callbackUrl} />
          <div className="space-y-2 text-xs text-su-muted">
            <p>
              <strong className="text-su-heading">Hesabınız yok mu?</strong> Kendi kendine kayıt yoktur. Koordinatör hesabınızı açtığında okul e-postanıza şifre belirleme bağlantısı gelir.
            </p>
            <p>
              <strong className="text-su-heading">Şifrenizi mi unuttunuz?</strong>{' '}
              <Link href="/sifremi-unuttum" className="text-su-primary underline">
                Yeni bağlantı isteyin
              </Link>
              .
            </p>
          </div>
        </Card>
      </Page>
    </>
  );
}

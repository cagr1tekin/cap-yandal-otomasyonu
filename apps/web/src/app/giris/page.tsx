import { Card, Page, PageHero } from '@/components/ui';
import { SignInButton } from './sign-in';

export const metadata = { title: 'Giriş' };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ donus?: string }> }) {
  const { donus } = await searchParams;
  const callbackUrl = donus?.startsWith('/') && !donus.startsWith('//') ? donus : '/';
  return (
    <>
      <PageHero title="Giriş" subtitle="Koordinatör, öğrenci ve bölüm başkanı aynı yerden giriş yapar; ne görüleceğini hesabın rolü belirler." />
      <Page className="max-w-xl">
        <Card className="space-y-4 text-center">
          <p className="text-sm text-su-muted">Sistem şifre saklamaz. Giriş, kimlik servisi (SSO) üzerinden yapılır.</p>
          <SignInButton callbackUrl={callbackUrl} />
          <div className="space-y-2 text-left text-xs text-su-muted">
            <p>
              <strong className="text-su-heading">Hesabınız yok mu?</strong> Kendi kendine kayıt yoktur. Koordinatör hesabınızı açtığında okul e-postanıza şifre belirleme bağlantısı gelir.
            </p>
            <p>
              <strong className="text-su-heading">Şifrenizi mi unuttunuz?</strong> Giriş ekranındaki “Şifremi unuttum” bağlantısını kullanın.
            </p>
            <p>Geliştirme ortamındaki deneme hesapları README dosyasındadır.</p>
          </div>
        </Card>
      </Page>
    </>
  );
}

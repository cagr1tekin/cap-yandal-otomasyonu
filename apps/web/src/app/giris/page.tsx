import { Card, Page, PageHero } from '@/components/ui';
import { SignInButton } from './sign-in';

export const metadata = { title: 'Giriş' };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ donus?: string }> }) {
  const { donus } = await searchParams;
  const callbackUrl = donus?.startsWith('/') && !donus.startsWith('//') ? donus : '/';
  return (
    <>
      <PageHero title="Giriş" subtitle="Öğrenciler ve personel aynı yerden giriş yapar; ne görüleceğini hesabın rolü belirler." />
      <Page className="max-w-xl">
        <Card className="space-y-4 text-center">
          <p className="text-sm text-su-muted">Bu sistem kendi şifresini tutmaz. Giriş, tek oturum açma (SSO) servisi üzerinden yapılır.</p>
          <SignInButton callbackUrl={callbackUrl} />
          <div className="space-y-2 text-left text-xs text-su-muted">
            <p>
              <strong className="text-su-heading">Öğrenciler:</strong> hesabınız yoksa giriş ekranındaki “Kayıt ol” bağlantısıyla, kullanıcı adı olarak öğrenci numaranızı yazarak hesap açın. İlk
              girişte “Bilgilerim” sayfasında öğrenci ve akademik bilgilerinizi girersiniz.
            </p>
            <p>
              <strong className="text-su-heading">Personel:</strong> koordinatör, danışman ve bölüm başkanı rollerini Bilgisayar Mühendisliği bölüm başkanı atar.
            </p>
            <p>Geliştirme ortamındaki deneme hesapları README dosyasındadır.</p>
          </div>
        </Card>
      </Page>
    </>
  );
}

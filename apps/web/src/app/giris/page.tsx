import { Card, Page, PageHero } from '@/components/ui';
import { SignInButton } from './sign-in';

export const metadata = { title: 'Giriş' };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ donus?: string }> }) {
  const { donus } = await searchParams;
  const callbackUrl = donus?.startsWith('/') && !donus.startsWith('//') ? donus : '/';
  return (
    <>
      <PageHero title="Giriş" subtitle="Üniversite kimlik bilgilerinizle giriş yapın." />
      <Page className="max-w-xl">
        <Card className="space-y-4 text-center">
          <p className="text-sm text-su-muted">
            Bu sistem kendi şifresini tutmaz. Giriş, üniversitenin tek oturum açma (SSO) servisi üzerinden yapılır.
          </p>
          <SignInButton callbackUrl={callbackUrl} />
          <p className="text-xs text-su-subtle">Geliştirme ortamında deneme hesapları README dosyasında listelenmiştir.</p>
        </Card>
      </Page>
    </>
  );
}

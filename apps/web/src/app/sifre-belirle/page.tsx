import Link from 'next/link';
import { Alert, Card, Page, PageHero } from '@/components/ui';
import { SetPasswordForm } from './forms';

export const metadata = { title: 'Şifre belirle' };

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ anahtar?: string }> }) {
  const { anahtar } = await searchParams;
  return (
    <>
      <PageHero title="Şifre belirle" subtitle="Bağlantı tek kullanımlıktır; şifreyi belirledikten sonra giriş sayfasından girebilirsiniz." />
      <Page className="max-w-xl">
        <Card className="space-y-4">
          {anahtar ? (
            <SetPasswordForm token={anahtar} />
          ) : (
            <Alert tone="bad">
              Bağlantı eksik. E-postadaki bağlantıyı açın ya da{' '}
              <Link href="/sifremi-unuttum" className="underline">
                yeni bağlantı isteyin
              </Link>
              .
            </Alert>
          )}
        </Card>
      </Page>
    </>
  );
}

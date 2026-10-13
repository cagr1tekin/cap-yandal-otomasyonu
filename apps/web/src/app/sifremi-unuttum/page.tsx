import Link from 'next/link';
import { Card, Page, PageHero } from '@/components/ui';
import { ForgotPasswordForm } from '../sifre-belirle/forms';

export const metadata = { title: 'Şifremi unuttum' };

export default function ForgotPasswordPage() {
  return (
    <>
      <PageHero title="Şifremi unuttum" subtitle="Kayıtlı e-posta adresinize yeni bir şifre belirleme bağlantısı gönderilir." />
      <Page className="max-w-xl">
        <Card className="space-y-4">
          <ForgotPasswordForm />
          <p className="text-xs text-su-muted">
            <Link href="/giris" className="text-su-primary underline">
              Giriş sayfasına dön
            </Link>
          </p>
        </Card>
      </Page>
    </>
  );
}

import Link from 'next/link';
import { EnrollmentTable } from '@/components/enrollment-table';
import { Card, Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import type { EnrollmentListRow } from '@/lib/types';

export const metadata = { title: 'Kayıtlarım' };

export default async function MyEnrollments() {
  const rows = await api<EnrollmentListRow[]>('/me/enrollments');
  return (
    <>
      <PageHero
        title="ÇAP / yan dal kayıtlarım"
        crumbs={['Öğrenci']}
        subtitle="Kayıt sayfanızda protokolünüzü imzalar, her dönem ders kayıt formunuzu hazırlar, özel şartlı ders muafiyeti başvurusu yapar ve dönem sonu beyanınızı girersiniz."
      />
      <Page>
        <Card>
          <EnrollmentTable rows={rows} own empty="Kesin kaydı yapılmış bir programınız yok." />
          {rows.length === 0 && (
            <p className="mt-3 text-sm">
              Başvuru yapmak için <Link href="/ogrenci/basvuru">başvuru sayfasına</Link> gidin.
            </p>
          )}
        </Card>
      </Page>
    </>
  );
}

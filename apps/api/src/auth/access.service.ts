import { Global, Injectable, Module } from '@nestjs/common';
import { conflict, forbidden, notFound } from '../common/http';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth';

/**
 * Kapsam denetimi. Koordinatör ve bölüm başkanı bütün öğrencileri görür; öğrenci yalnızca kendi kartını.
 * Başkasının kartına ait istek, varlığını sızdırmamak için "bulunamadı" olarak yanıtlanır.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  isStaff(user: AuthUser) {
    return user.role === 'KOORDINATOR' || user.role === 'BOLUM_BASKANI';
  }

  isCoordinator(user: AuthUser) {
    return user.role === 'KOORDINATOR';
  }

  /** Öğrenci kartını okuma yetkisi; kartı döndürür. */
  async student(user: AuthUser, studentNo: string) {
    if (!this.isStaff(user) && user.studentNo !== studentNo) throw notFound('Öğrenci');
    const s = await this.prisma.student.findUnique({ where: { studentNo } });
    if (!s) throw notFound('Öğrenci');
    return s;
  }

  /** Öğrencinin kendi kaydına yazma: koordinatör her zaman; öğrenci yalnızca kendi kartına ve kaydı etkinken. */
  async writable(user: AuthUser, studentNo: string, opts: { activeOnly?: boolean } = {}) {
    const s = await this.student(user, studentNo);
    if (user.role === 'BOLUM_BASKANI') throw forbidden('Bölüm başkanı hesabı yalnızca izleme yetkisine sahiptir.');
    if (user.role === 'OGRENCI' && opts.activeOnly !== false && s.status !== 'ACTIVE') {
      throw conflict('Kaydınız etkin olmadığı için bu işlem yapılamaz. Koordinatöre mesaj gönderebilirsiniz.');
    }
    return s;
  }

  assertCoordinator(user: AuthUser) {
    if (!this.isCoordinator(user)) throw forbidden('Bu işlem yalnızca koordinatöre açıktır.');
  }
}

@Global()
@Module({ providers: [AccessService], exports: [AccessService] })
export class AccessModule {}

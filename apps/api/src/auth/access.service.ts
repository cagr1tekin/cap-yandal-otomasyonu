import { Global, Injectable, Module } from '@nestjs/common';
import type { Program } from '@prisma/client';
import { conflict, forbidden } from '../common/http';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth';

/**
 * Rol + kapsam denetimi (docs/KARARLAR.md K-12).
 *  - KOORDINATOR: ÇAP / yan dal komisyonu; bölümün bütün başvuru ve kayıtları.
 *  - BOLUM_BASKANI (Bilgisayar Müh.): yönetici; kullanıcı ve rol yönetimi, denetim kaydı, protokol imzası.
 *  - BOLUM_BASKANI / DANISMAN (ana dal bölümü): yalnızca kendi bölümünün öğrencileri ve imzaları.
 *  - OGRENCI: yalnızca kendi kayıtları.
 */
@Injectable()
export class AccessService {
  private homeCache: Program | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Sistemin sahibi bölüm (Bilgisayar Mühendisliği). */
  async home(): Promise<Program> {
    if (!this.homeCache) {
      this.homeCache = await this.prisma.program.findFirst({ where: { isHome: true } });
      if (!this.homeCache) throw conflict('Bölüm tanımı bulunamadı; seed verisi yüklenmemiş.');
    }
    return this.homeCache;
  }

  isCoordinator(user: AuthUser) {
    return user.roles.includes('KOORDINATOR');
  }

  isStudent(user: AuthUser) {
    return user.roles.includes('OGRENCI');
  }

  headProgramIds(user: AuthUser): string[] {
    return user.assignments.filter((a) => a.role === 'BOLUM_BASKANI' && a.programId).map((a) => a.programId!);
  }

  advisorProgramIds(user: AuthUser): string[] {
    return user.assignments.filter((a) => a.role === 'DANISMAN' && a.programId).map((a) => a.programId!);
  }

  async isHomeHead(user: AuthUser) {
    return this.headProgramIds(user).includes((await this.home()).id);
  }

  /** Komisyon ya da Bilgisayar Mühendisliği bölüm başkanı: bölümün bütün kayıtlarını görür. */
  async isDepartmentStaff(user: AuthUser) {
    return this.isCoordinator(user) || (await this.isHomeHead(user));
  }

  async assertDepartmentStaff(user: AuthUser) {
    if (!(await this.isDepartmentStaff(user))) throw forbidden('Bu işlem yalnızca Bilgisayar Mühendisliği ÇAP / yan dal komisyonu ve bölüm başkanına açıktır.');
  }

  assertCoordinator(user: AuthUser) {
    if (!this.isCoordinator(user)) throw forbidden('Bu işlem yalnızca ÇAP / yan dal koordinatörüne açıktır.');
  }

  async assertHomeHead(user: AuthUser) {
    if (!(await this.isHomeHead(user))) throw forbidden('Bu işlem yalnızca Bilgisayar Mühendisliği bölüm başkanına açıktır.');
  }

  /** Bir öğrencinin kaydını / başvurusunu kim görebilir. */
  async canSeeStudent(user: AuthUser, s: { studentNo: string; programId: string; advisorUsername?: string | null }, extraAdvisor?: string | null) {
    if (user.studentNo === s.studentNo) return true;
    if (await this.isDepartmentStaff(user)) return true;
    if (this.headProgramIds(user).includes(s.programId)) return true;
    return user.roles.includes('DANISMAN') && (s.advisorUsername === user.username || extraAdvisor === user.username);
  }
}

@Global()
@Module({ providers: [AccessService], exports: [AccessService] })
export class AccessModule {}

import { Global, Injectable, Module } from '@nestjs/common';
import type { Role } from '@cap/contracts';
import type { Prisma } from '@prisma/client';
import { forbidden } from '../common/http';
import type { AuthUser } from './auth';

export interface OfferingScope {
  coordinatorUsername: string;
  programId: string;
  program: { unitId: string };
}

type StaffRole = Extract<Role, 'KOORDINATOR' | 'BOLUM_BASKANI' | 'BIRIM' | 'OIDB'>;

/** Rol + kapsam denetimi (teknik doküman bölüm 11). */
@Injectable()
export class AccessService {
  isOidb(user: AuthUser) {
    return user.roles.includes('OIDB');
  }

  unitIds(user: AuthUser, role: Role = 'BIRIM'): string[] {
    return user.assignments.filter((a) => a.role === role && a.unitId).map((a) => a.unitId!);
  }

  programIds(user: AuthUser, role: Role): string[] {
    return user.assignments.filter((a) => a.role === role && a.programId).map((a) => a.programId!);
  }

  /** Kullanıcının belirtilen rollerden biriyle bu teklife erişimi var mı? */
  canOnOffering(user: AuthUser, o: OfferingScope, roles: StaffRole[]): boolean {
    return roles.some((role) => {
      if (!user.roles.includes(role)) return false;
      switch (role) {
        case 'OIDB':
          return true;
        case 'KOORDINATOR':
          return o.coordinatorUsername === user.username;
        case 'BOLUM_BASKANI':
          return this.programIds(user, 'BOLUM_BASKANI').includes(o.programId);
        case 'BIRIM':
          return this.unitIds(user).includes(o.program.unitId);
      }
    });
  }

  assertOffering(user: AuthUser, o: OfferingScope, roles: StaffRole[]) {
    if (!this.canOnOffering(user, o, roles)) throw forbidden('Bu programın kayıtlarına erişim yetkiniz yok.');
  }

  /** Belirtilen programın bölüm başkanı mı? */
  isHeadOf(user: AuthUser, programId: string) {
    return this.programIds(user, 'BOLUM_BASKANI').includes(programId);
  }

  assertUnit(user: AuthUser, unitId: string) {
    if (!this.isOidb(user) && !this.unitIds(user).includes(unitId)) {
      throw forbidden('Bu birim için yetkiniz yok.');
    }
  }

  /** Personelin görebileceği teklifler için Prisma filtresi. */
  offeringWhere(user: AuthUser): Prisma.OfferingWhereInput {
    if (this.isOidb(user)) return {};
    const or: Prisma.OfferingWhereInput[] = [];
    if (user.roles.includes('KOORDINATOR')) or.push({ coordinatorUsername: user.username });
    const deptPrograms = this.programIds(user, 'BOLUM_BASKANI');
    if (deptPrograms.length) or.push({ programId: { in: deptPrograms } });
    const units = this.unitIds(user);
    if (units.length) or.push({ program: { unitId: { in: units } } });
    return or.length ? { OR: or } : { id: '__yok__' };
  }
}

@Global()
@Module({ providers: [AccessService], exports: [AccessService] })
export class AccessModule {}

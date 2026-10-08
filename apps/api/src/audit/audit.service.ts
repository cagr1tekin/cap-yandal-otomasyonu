import { Global, Injectable, Module } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient | PrismaService;

export interface AuditEntry {
  action: string;
  entity: string;
  entityId: string;
  studentNo?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string;
}

/**
 * İşlem kaydı: kim, ne zaman, neyi, eski ve yeni değeriyle ne yaptı. Yalnızca eklenir;
 * tablo veritabanı tetikleyicisiyle değiştirilemez ve silinemez.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(actor: Pick<AuthUser, 'username' | 'role'> | 'sistem', entry: AuditEntry, tx: Tx = this.prisma) {
    await tx.auditLog.create({
      data: {
        actor: actor === 'sistem' ? 'sistem' : actor.username,
        actorRole: actor === 'sistem' ? null : actor.role,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        studentNo: entry.studentNo ?? null,
        before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
        reason: entry.reason ?? null,
        ip: entry.ip,
      },
    });
  }

  /** BigInt kimlik JSON'a çevrilemediği için metin olarak döner. */
  async list(where: Prisma.AuditLogWhereInput, take = 200) {
    const rows = await this.prisma.auditLog.findMany({ where, orderBy: { at: 'desc' }, take: Math.min(take, 1000) });
    return rows.map((r) => ({ ...r, id: r.id.toString() }));
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}

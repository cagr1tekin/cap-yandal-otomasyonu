import { Global, Injectable, Module } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient | PrismaService;

export interface AuditEntry {
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ip?: string;
}

/** Yalnızca ekleme yapılan denetim kaydı; tablo veritabanı tetikleyicisiyle korunur. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, tx: Tx = this.prisma) {
    await tx.auditLog.create({
      data: {
        actor: entry.actor,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
        reason: entry.reason,
        ip: entry.ip,
      },
    });
  }

  /** BigInt kimlik JSON'a çevrilemediği için metin olarak döner. */
  async list(entity: string, entityId: string) {
    const rows = await this.prisma.auditLog.findMany({ where: { entity, entityId }, orderBy: { at: 'desc' } });
    return rows.map((r) => ({ ...r, id: r.id.toString() }));
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}

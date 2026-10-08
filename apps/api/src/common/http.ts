import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  PipeTransform,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';

/** RFC 9457 problem ayrıntısı taşıyan hata. */
export class Problem extends HttpException {
  constructor(status: number, title: string, detail?: string, extra: Record<string, unknown> = {}) {
    super({ title, detail, ...extra }, status);
  }
}

export const badRequest = (detail: string, extra?: Record<string, unknown>) =>
  new Problem(HttpStatus.BAD_REQUEST, 'Geçersiz istek', detail, extra);
export const notFound = (what: string) => new Problem(HttpStatus.NOT_FOUND, 'Bulunamadı', `${what} bulunamadı.`);
export const forbidden = (detail = 'Bu işlem için yetkiniz yok.') =>
  new Problem(HttpStatus.FORBIDDEN, 'Yetkisiz işlem', detail);
export const conflict = (detail: string, extra?: Record<string, unknown>) =>
  new Problem(HttpStatus.CONFLICT, 'Durum çakışması', detail, extra);
export const unprocessable = (detail: string, extra?: Record<string, unknown>) =>
  new Problem(HttpStatus.UNPROCESSABLE_ENTITY, 'Koşullar sağlanmıyor', detail, extra);

/** @Body(new ZodPipe(Schema)) */
export class ZodPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw badRequest('Gönderilen veri doğrulanamadı.', {
        errors: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return parsed.data;
  }
}

@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger('ProblemFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let body: Record<string, unknown> = { title: 'Sunucu hatası', detail: 'Beklenmeyen bir hata oluştu.' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      body =
        typeof r === 'string'
          ? { title: r }
          : 'title' in (r as object)
            ? (r as Record<string, unknown>)
            : { title: (r as { error?: string }).error ?? 'Hata', detail: (r as { message?: unknown }).message };
    } else if (exception instanceof ZodError) {
      status = 400;
      body = { title: 'Geçersiz istek', detail: 'Gönderilen veri doğrulanamadı.', errors: exception.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) };
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      status = 409;
      body = { title: 'Durum çakışması', detail: 'Bu kayıt zaten var ya da bir benzersizlik kuralını ihlal ediyor.' };
    } else {
      this.logger.error(exception);
    }

    res
      .status(status)
      .type('application/problem+json')
      .json({ type: 'about:blank', status, ...body });
  }
}

import { Body, Controller, Get, Injectable, Param, Post, Query } from '@nestjs/common';
import { ReviewSchema } from '@cap/contracts';
import type { z } from 'zod';
import { z as zod } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { ZodPipe } from '../common/http';
import { CurriculumService } from '../curriculum/curriculum.service';
import { DocumentsService } from '../documents/documents';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';

const KINDS = ['plan', 'attempt', 'grades', 'document'] as const;
type Kind = (typeof KINDS)[number];

/**
 * Onay kuyruğu: öğrencinin girdiği ders, dönem kaydı, not ve belgeler "onay bekliyor" başlar.
 * Koordinatör onaylayınca kayıt kilitlenir; reddederse gerekçesiyle o durumda kalır.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculum: CurriculumService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
  ) {}

  async pending(studentNo?: string) {
    const where = studentNo ? { studentNo } : {};
    const student = { select: { fullName: true, track: true } };
    const [plan, attempts, grades, documents, courseRequests] = await Promise.all([
      this.prisma.planItem.findMany({ where: { ...where, status: 'PENDING', removedAt: null }, include: { student, course: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.courseAttempt.findMany({ where: { ...where, status: 'PENDING' }, include: { student, term: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.gradeSubmission.findMany({
        where: { ...where, status: 'PENDING' },
        include: { student, term: true, transcript: { select: { id: true, fileName: true } }, items: { include: { attempt: { select: { courseCode: true, courseName: true, ects: true } } } } },
        orderBy: { submittedAt: 'asc' },
      }),
      this.prisma.document.findMany({ where: { ...where, status: 'PENDING' }, include: { student, term: true, request: { select: { message: true } } }, orderBy: { uploadedAt: 'asc' } }),
      this.prisma.courseRequest.findMany({ where: { ...where, status: 'PENDING' }, include: { student }, orderBy: { createdAt: 'asc' } }),
    ]);
    return { plan, attempts, grades, documents, courseRequests, total: plan.length + attempts.length + grades.length + documents.length + courseRequests.length };
  }

  async review(user: AuthUser, kind: Kind, id: string, input: z.infer<typeof ReviewSchema>) {
    let res: { studentNo: string; label: string } | null = null;
    if (kind === 'plan') res = await this.curriculum.reviewPlanItem(user, id, input.decision, input.note);
    else if (kind === 'attempt') res = await this.curriculum.reviewAttempt(user, id, input.decision, input.note);
    else if (kind === 'document') return this.documents.review(user, id, input.decision, input.note);
    else return this.curriculum.reviewGrades(user, id, { decision: input.decision, note: input.note, conditionalPass: input.conditionalPass });
    // Ders listesi ve dönem kaydı kararları öğrenciye bildirilir.
    const s = await this.prisma.student.findUnique({ where: { studentNo: res.studentNo }, include: { user: true } });
    if (s?.user) {
      await this.notifications.notify(
        s.user.username,
        input.decision === 'APPROVED' ? 'Kaydınız onaylandı' : 'Kaydınız reddedildi',
        `${res.label}${input.decision === 'REJECTED' ? `: ${input.note}` : ' onaylandı ve kilitlendi.'}`,
        `/ogrenciler/${res.studentNo}?sekme=dersler`,
      );
    }
    return res;
  }
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  pending(@Query('studentNo') studentNo?: string) {
    return this.reviews.pending(studentNo);
  }

  @Post(':kind/:id')
  @Roles('KOORDINATOR')
  review(@CurrentUser() user: AuthUser, @Param('kind') kind: string, @Param('id') id: string, @Body(new ZodPipe(ReviewSchema)) body: z.infer<typeof ReviewSchema>) {
    return this.reviews.review(user, zod.enum(KINDS).parse(kind), id, body);
  }
}

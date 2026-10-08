-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Season" AS ENUM ('GUZ', 'BAHAR');

-- CreateEnum
CREATE TYPE "TrackType" AS ENUM ('CAP', 'YANDAL');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('KOORDINATOR', 'OGRENCI', 'BOLUM_BASKANI');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'FROZEN', 'GRADUATED', 'CERTIFIED', 'WITHDRAWN', 'REMOVED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecordSource" AS ENUM ('STUDENT', 'COORDINATOR', 'BACKFILL', 'IMPORT');

-- CreateEnum
CREATE TYPE "CourseKind" AS ENUM ('ZORUNLU', 'TEKNIK_SECMELI', 'SOSYAL_SECMELI');

-- CreateEnum
CREATE TYPE "PlanItemKind" AS ENUM ('COURSE', 'ELECTIVE_SLOT');

-- CreateEnum
CREATE TYPE "AttemptResult" AS ENUM ('TAKEN', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('PROTOKOL', 'DERS_KAYIT_FORMU', 'MUAFIYET_FORMU', 'CAP_TRANSKRIPT', 'ANADAL_TRANSKRIPT', 'YK_KARARI', 'RESMI_YAZI', 'DIGER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'UPLOADED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GanoSource" AS ENUM ('TRANSKRIPT', 'OGRENCI_ISLERI', 'OBIS', 'DIGER');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('MEZUNIYET', 'SERTIFIKA', 'KAYIT_SILME', 'AYRILMA', 'DONDURMA', 'ETKINLESTIRME');

-- CreateEnum
CREATE TYPE "LeaveReason" AS ENUM ('ERASMUS', 'FARABI', 'DERS_ACILMADI', 'DERS_CAKISMASI', 'DIGER');

-- CreateEnum
CREATE TYPE "RuleSetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('COURSES', 'STUDENTS', 'ATTEMPTS');

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "codePrefix" TEXT,
    "isHome" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ects" INTEGER NOT NULL,
    "credit" INTEGER,
    "semester" INTEGER NOT NULL,
    "kind" "CourseKind" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "season" "Season" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "oidcSub" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "invitedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "studentNo" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "schoolEmail" TEXT NOT NULL,
    "phone" TEXT,
    "track" "TrackType" NOT NULL,
    "admissionTermId" TEXT NOT NULL,
    "mainProgramId" TEXT,
    "commonEcts" INTEGER NOT NULL DEFAULT 0,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "RecordSource" NOT NULL DEFAULT 'COORDINATOR',
    "externalRef" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("studentNo")
);

-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "kind" "PlanItemKind" NOT NULL,
    "courseCode" TEXT,
    "name" TEXT NOT NULL,
    "ects" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "source" "RecordSource" NOT NULL,
    "addReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "removedAt" TIMESTAMP(3),
    "removedBy" TEXT,
    "removeReason" TEXT,
    "exemptAt" TIMESTAMP(3),
    "exemptBy" TEXT,
    "exemptReason" TEXT,
    "exemptCondNo" INTEGER,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAttempt" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "planItemId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "ects" INTEGER NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "source" "RecordSource" NOT NULL,
    "result" "AttemptResult" NOT NULL DEFAULT 'TAKEN',
    "grade" TEXT,
    "gradedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "correctedAt" TIMESTAMP(3),
    "correctedBy" TEXT,

    CONSTRAINT "CourseAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeSubmission" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "submittedBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,

    CONSTRAINT "GradeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeSubmissionItem" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "passed" BOOLEAN,

    CONSTRAINT "GradeSubmissionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRequest" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "courseCode" TEXT,

    CONSTRAINT "CourseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "termId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "note" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "previousId" TEXT,
    "requestId" TEXT,
    "messageId" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "termId" TEXT,
    "message" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentNote" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,

    CONSTRAINT "StudentNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GanoRecord" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "gano" DOUBLE PRECISION NOT NULL,
    "source" "GanoSource" NOT NULL,
    "sourceNote" TEXT,
    "mainFrozen" BOOLEAN NOT NULL DEFAULT false,
    "mainGraduated" BOOLEAN NOT NULL DEFAULT false,
    "enteredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,

    CONSTRAINT "GanoRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermLeave" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "reason" "LeaveReason" NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,

    CONSTRAINT "TermLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSet" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" "TrackType" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "status" "RuleSetStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleDefinition" (
    "id" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "article" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RuleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleCheck" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "worst" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDecision" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "type" "DecisionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "ruleCheckId" TEXT,
    "previousStatus" "StudentStatus" NOT NULL,
    "newStatus" "StudentStatus" NOT NULL,
    "decidedBy" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,

    CONSTRAINT "StudentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolTemplate" (
    "id" TEXT NOT NULL,
    "type" "TrackType" NOT NULL,
    "sourceProgramId" TEXT,
    "title" TEXT NOT NULL,
    "commonEcts" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "PlanItemKind" NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "ects" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProtocolTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolCondition" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "sourceCourseCode" TEXT NOT NULL,
    "sourceCourseName" TEXT NOT NULL,
    "targetCourseCode" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "ProtocolCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "kind" "ImportKind" NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "okCount" INTEGER NOT NULL,
    "summary" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "studentNo" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Term_year_season_key" ON "Term"("year", "season");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_oidcSub_key" ON "User"("oidcSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolEmail_key" ON "Student"("schoolEmail");

-- CreateIndex
CREATE INDEX "PlanItem_studentNo_idx" ON "PlanItem"("studentNo");

-- CreateIndex
CREATE INDEX "CourseAttempt_studentNo_termId_idx" ON "CourseAttempt"("studentNo", "termId");

-- CreateIndex
CREATE INDEX "CourseAttempt_planItemId_idx" ON "CourseAttempt"("planItemId");

-- CreateIndex
CREATE INDEX "GradeSubmission_studentNo_termId_idx" ON "GradeSubmission"("studentNo", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeSubmissionItem_submissionId_attemptId_key" ON "GradeSubmissionItem"("submissionId", "attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Document_previousId_key" ON "Document"("previousId");

-- CreateIndex
CREATE INDEX "Document_studentNo_kind_idx" ON "Document"("studentNo", "kind");

-- CreateIndex
CREATE INDEX "Message_studentNo_createdAt_idx" ON "Message"("studentNo", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSet_version_key" ON "RuleSet"("version");

-- CreateIndex
CREATE UNIQUE INDEX "RuleDefinition_ruleSetId_code_key" ON "RuleDefinition"("ruleSetId", "code");

-- CreateIndex
CREATE INDEX "RuleCheck_studentNo_createdAt_idx" ON "RuleCheck"("studentNo", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolTemplate_type_sourceProgramId_key" ON "ProtocolTemplate"("type", "sourceProgramId");

-- CreateIndex
CREATE INDEX "ProtocolTemplateItem_templateId_position_idx" ON "ProtocolTemplateItem"("templateId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolCondition_templateId_no_key" ON "ProtocolCondition"("templateId", "no");

-- CreateIndex
CREATE INDEX "Notification_username_readAt_idx" ON "Notification"("username", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_studentNo_at_idx" ON "AuditLog"("studentNo", "at");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_admissionTermId_fkey" FOREIGN KEY ("admissionTermId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_mainProgramId_fkey" FOREIGN KEY ("mainProgramId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "Student"("studentNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_courseCode_fkey" FOREIGN KEY ("courseCode") REFERENCES "Course"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAttempt" ADD CONSTRAINT "CourseAttempt_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "Student"("studentNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAttempt" ADD CONSTRAINT "CourseAttempt_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "PlanItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAttempt" ADD CONSTRAINT "CourseAttempt_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAttempt" ADD CONSTRAINT "CourseAttempt_courseCode_fkey" FOREIGN KEY ("courseCode") REFERENCES "Course"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSubmission" ADD CONSTRAINT "GradeSubmission_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "Student"("studentNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSubmission" ADD CONSTRAINT "GradeSubmission_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSubmission" ADD CONSTRAINT "GradeSubmission_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSubmissionItem" ADD CONSTRAINT "GradeSubmissionItem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "GradeSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSubmissionItem" ADD CONSTRAINT "GradeSubmissionItem_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "CourseAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRequest" ADD CONSTRAINT "CourseRequest_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "Student"("studentNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "Student"("studentNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "Student"("studentNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "Student"("studentNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "Student"("studentNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GanoRecord" ADD CONSTRAINT "GanoRecord_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "Student"("studentNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GanoRecord" ADD CONSTRAINT "GanoRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermLeave" ADD CONSTRAINT "TermLeave_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "Student"("studentNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermLeave" ADD CONSTRAINT "TermLeave_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleDefinition" ADD CONSTRAINT "RuleDefinition_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleCheck" ADD CONSTRAINT "RuleCheck_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "Student"("studentNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleCheck" ADD CONSTRAINT "RuleCheck_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDecision" ADD CONSTRAINT "StudentDecision_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "Student"("studentNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDecision" ADD CONSTRAINT "StudentDecision_ruleCheckId_fkey" FOREIGN KEY ("ruleCheckId") REFERENCES "RuleCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolTemplate" ADD CONSTRAINT "ProtocolTemplate_sourceProgramId_fkey" FOREIGN KEY ("sourceProgramId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolTemplateItem" ADD CONSTRAINT "ProtocolTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProtocolTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolCondition" ADD CONSTRAINT "ProtocolCondition_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProtocolTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------- Değiştirilemezlik ve silinmezlik

-- Denetim kaydı değiştirilemez ve silinemez.
CREATE OR REPLACE FUNCTION audit_log_readonly() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog kayıtları değiştirilemez veya silinemez';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_readonly();

-- Hiçbir kayıt silinmez; yanlış ya da geçersiz kayıt "iptal" olarak işaretlenir.
CREATE OR REPLACE FUNCTION forbid_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% tablosundan kayıt silinemez; kaydı iptal edin', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\_prisma%' AND tablename <> 'AuditLog' LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_delete()', t || '_no_delete', t);
  END LOOP;
END $$;

-- Mesaj gövdesi, göndereni ve konuşması değiştirilemez; yalnızca okunma zamanı yazılır.
CREATE OR REPLACE FUNCTION message_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW."body" IS DISTINCT FROM OLD."body" OR NEW."senderId" IS DISTINCT FROM OLD."senderId"
     OR NEW."studentNo" IS DISTINCT FROM OLD."studentNo" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Mesajlar değiştirilemez';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_no_edit BEFORE UPDATE ON "Message" FOR EACH ROW EXECUTE FUNCTION message_immutable();

-- Yüklenen dosyanın kimliği (yer, özet, boyut) değişmez; durum ve inceleme alanları değişebilir.
CREATE OR REPLACE FUNCTION document_file_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW."storageKey" IS DISTINCT FROM OLD."storageKey" OR NEW."sha256" IS DISTINCT FROM OLD."sha256"
     OR NEW."size" IS DISTINCT FROM OLD."size" OR NEW."studentNo" IS DISTINCT FROM OLD."studentNo" THEN
    RAISE EXCEPTION 'Yüklenen dosya değiştirilemez; yeni sürüm yükleyin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_no_file_edit BEFORE UPDATE ON "Document" FOR EACH ROW EXECUTE FUNCTION document_file_immutable();

-- ---------------------------------------------------------------- Benzersizlik

-- Aynı ders aynı dönemde bir kez alınır (iptal / ret edilen denemeler hariç).
CREATE UNIQUE INDEX "CourseAttempt_one_per_term" ON "CourseAttempt" ("planItemId", "termId") WHERE "status" IN ('PENDING', 'APPROVED');
-- Bir dönem için aynı anda tek bekleyen not gönderimi.
CREATE UNIQUE INDEX "GradeSubmission_one_pending" ON "GradeSubmission" ("studentNo", "termId") WHERE "status" = 'PENDING';
-- Dönem başına tek geçerli GANO kaydı ve tek izin.
CREATE UNIQUE INDEX "GanoRecord_one_per_term" ON "GanoRecord" ("studentNo", "termId") WHERE "cancelledAt" IS NULL;
CREATE UNIQUE INDEX "TermLeave_one_per_term" ON "TermLeave" ("studentNo", "termId") WHERE "cancelledAt" IS NULL;
-- Aynı ders listede bir kez (çıkarılan, reddedilen, iptal edilen hariç).
CREATE UNIQUE INDEX "PlanItem_one_course" ON "PlanItem" ("studentNo", "courseCode") WHERE "courseCode" IS NOT NULL AND "removedAt" IS NULL AND "status" IN ('PENDING', 'APPROVED');
CREATE UNIQUE INDEX "Program_single_home" ON "Program" ("isHome") WHERE "isHome";
CREATE UNIQUE INDEX "ProtocolTemplate_one_general_per_type" ON "ProtocolTemplate" ("type") WHERE "sourceProgramId" IS NULL;
CREATE UNIQUE INDEX "Term_single_current" ON "Term" ("isCurrent") WHERE "isCurrent";

-- ---------------------------------------------------------------- Değer aralıkları

ALTER TABLE "Student" ADD CONSTRAINT "Student_no_format" CHECK ("studentNo" ~ '^[0-9]{9}$');
ALTER TABLE "Student" ADD CONSTRAINT "Student_common_ects" CHECK ("commonEcts" BETWEEN 0 AND 240);
ALTER TABLE "Course" ADD CONSTRAINT "Course_ects" CHECK ("ects" BETWEEN 0 AND 60 AND "semester" BETWEEN 1 AND 8);
ALTER TABLE "GanoRecord" ADD CONSTRAINT "GanoRecord_range" CHECK ("gano" >= 0 AND "gano" <= 4);
ALTER TABLE "CourseAttempt" ADD CONSTRAINT "CourseAttempt_grade" CHECK ("grade" IS NULL OR "grade" IN ('AA','BA','BB','CB','CC','DC','FF','F','G','K'));
ALTER TABLE "GradeSubmissionItem" ADD CONSTRAINT "GradeSubmissionItem_grade" CHECK ("grade" IN ('AA','BA','BB','CB','CC','DC','FF','F','G','K'));
ALTER TABLE "Document" ADD CONSTRAINT "Document_size" CHECK ("size" > 0);
ALTER TABLE "Term" ADD CONSTRAINT "Term_dates" CHECK ("endsAt" > "startsAt");

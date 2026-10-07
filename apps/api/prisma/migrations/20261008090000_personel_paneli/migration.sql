-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'IN_APPROVAL', 'APPROVED', 'REJECTED', 'SUBMITTED', 'ENTERED', 'FILED');

-- CreateEnum
CREATE TYPE "ApprovalSubject" AS ENUM ('PROTOCOL', 'COURSE_REG');

-- CreateEnum
CREATE TYPE "ApprovalRole" AS ENUM ('OGRENCI_IMZA', 'ANA_DAL_DANISMANI', 'ANA_DAL_BOLUM_BASKANI', 'KOORDINATOR', 'HEDEF_BOLUM_BASKANI');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveReason" AS ENUM ('ERASMUS', 'FARABI', 'DERS_ACILMADI', 'DERS_CAKISMASI', 'DIGER');

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'INELIGIBLE';

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('KOORDINATOR', 'DANISMAN', 'BOLUM_BASKANI', 'BIRIM', 'OIDB');
ALTER TABLE "RoleAssignment" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "MinorPlanItem" DROP CONSTRAINT "MinorPlanItem_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "MinorPlanItem" DROP CONSTRAINT "MinorPlanItem_poolCourseId_fkey";

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "documentDate" TIMESTAMP(3),
ADD COLUMN     "documentNo" TEXT,
ADD COLUMN     "documents" JSONB,
ADD COLUMN     "enteredBy" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "withdrawReason" TEXT;

-- AlterTable
ALTER TABLE "ApplicationWindow" ADD COLUMN     "courseRegistrationDeadline" TIMESTAMP(3),
ADD COLUMN     "registrationDeadline" TIMESTAMP(3),
ADD COLUMN     "waitlistDeadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "registeredBy" TEXT,
ADD COLUMN     "registrationDocuments" JSONB,
ADD COLUMN     "trackAdvisorUsername" TEXT;

-- DropTable
DROP TABLE "MinorPlanItem";

-- DropEnum
DROP TYPE "PlanItemStatus";

-- CreateTable
CREATE TABLE "ProgramCourse" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ects" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "common" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProgramCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Protocol" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "round" INTEGER NOT NULL DEFAULT 1,
    "commonEcts" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "filedAt" TIMESTAMP(3),
    "filedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Protocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolCourse" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ects" INTEGER NOT NULL,

    CONSTRAINT "ProtocolCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRegistration" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT,
    "enteredAt" TIMESTAMP(3),
    "enteredBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRegistrationItem" (
    "id" TEXT NOT NULL,
    "courseRegistrationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ects" INTEGER NOT NULL,

    CONSTRAINT "CourseRegistrationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "subjectType" "ApprovalSubject" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "role" "ApprovalRole" NOT NULL,
    "assigneeUsername" TEXT,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermLeave" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "reason" "LeaveReason" NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermLeave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCourse_programId_code_key" ON "ProgramCourse"("programId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Protocol_enrollmentId_key" ON "Protocol"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolCourse_protocolId_code_key" ON "ProtocolCourse"("protocolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistration_enrollmentId_termId_key" ON "CourseRegistration"("enrollmentId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistrationItem_courseRegistrationId_code_key" ON "CourseRegistrationItem"("courseRegistrationId", "code");

-- CreateIndex
CREATE INDEX "Approval_subjectType_subjectId_idx" ON "Approval"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "Approval_assigneeUsername_decision_idx" ON "Approval"("assigneeUsername", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "TermLeave_enrollmentId_termId_key" ON "TermLeave"("enrollmentId", "termId");

-- AddForeignKey
ALTER TABLE "ProgramCourse" ADD CONSTRAINT "ProgramCourse_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolCourse" ADD CONSTRAINT "ProtocolCourse_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistrationItem" ADD CONSTRAINT "CourseRegistrationItem_courseRegistrationId_fkey" FOREIGN KEY ("courseRegistrationId") REFERENCES "CourseRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermLeave" ADD CONSTRAINT "TermLeave_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


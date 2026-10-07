-- CreateEnum
CREATE TYPE "UnitKind" AS ENUM ('FAKULTE', 'YUKSEKOKUL', 'MYO', 'KONSERVATUVAR');

-- CreateEnum
CREATE TYPE "ProgramLevel" AS ENUM ('ONLISANS', 'LISANS');

-- CreateEnum
CREATE TYPE "ProgramCategory" AS ENUM ('MUHENDISLIK', 'HUKUK', 'TIP', 'SAGLIK', 'DIGER');

-- CreateEnum
CREATE TYPE "Season" AS ENUM ('GUZ', 'BAHAR');

-- CreateEnum
CREATE TYPE "TrackType" AS ENUM ('CAP', 'YANDAL');

-- CreateEnum
CREATE TYPE "OfferingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RuleSetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ApplicationPath" AS ENUM ('RANK', 'ENTRY_SCORE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'WITHDRAWN', 'UNDER_REVIEW', 'PROPOSED', 'ACCEPTED', 'WAITLISTED', 'REJECTED', 'ENROLLED', 'NOT_ENROLLED');

-- CreateEnum
CREATE TYPE "Proposal" AS ENUM ('ASIL', 'YEDEK', 'RET');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'FROZEN', 'WITHDRAWN', 'REMOVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PlanItemStatus" AS ENUM ('PROPOSED', 'APPROVED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "FindingDecision" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OGRENCI', 'KOORDINATOR', 'DANISMAN', 'BOLUM_BASKANI', 'BIRIM', 'OIDB');

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "UnitKind" NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "obisProgramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "ProgramLevel" NOT NULL,
    "durationYears" INTEGER NOT NULL,
    "category" "ProgramCategory" NOT NULL,
    "requiresTalentExam" BOOLEAN NOT NULL DEFAULT false,
    "requiresSuccessRank" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "Offering" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "type" "TrackType" NOT NULL,
    "quota" INTEGER NOT NULL,
    "coordinatorUsername" TEXT NOT NULL,
    "firstYearIntake" INTEGER,
    "quotaJustification" TEXT,
    "status" "OfferingStatus" NOT NULL DEFAULT 'DRAFT',
    "rankingLockedAt" TIMESTAMP(3),
    "registrationClosedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferingSourceProgram" (
    "offeringId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,

    CONSTRAINT "OfferingSourceProgram_pkey" PRIMARY KEY ("offeringId","programId")
);

-- CreateTable
CREATE TABLE "MinorPoolCourse" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ects" INTEGER NOT NULL,

    CONSTRAINT "MinorPoolCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationWindow" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "type" "TrackType" NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "announceAt" TIMESTAMP(3),

    CONSTRAINT "ApplicationWindow_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "path" "ApplicationPath" NOT NULL,
    "osymDocNo" TEXT,
    "osymVerified" BOOLEAN NOT NULL DEFAULT false,
    "obisSnapshot" JSONB NOT NULL,
    "eligibility" JSONB NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ranking" (
    "applicationId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "proposal" "Proposal" NOT NULL,
    "overriddenBy" TEXT,
    "overrideReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ranking_pkey" PRIMARY KEY ("applicationId")
);

-- CreateTable
CREATE TABLE "BoardDecision" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "decisionDate" TIMESTAMP(3) NOT NULL,
    "decisionNo" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "BoardDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "applicationId" TEXT,
    "type" "TrackType" NOT NULL,
    "programId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startTermId" TEXT NOT NULL,
    "ganoStrikes" INTEGER NOT NULL DEFAULT 0,
    "graceUntilTermId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinorPlanItem" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "poolCourseId" TEXT NOT NULL,
    "status" "PlanItemStatus" NOT NULL DEFAULT 'PROPOSED',
    "approvedBy" TEXT,

    CONSTRAINT "MinorPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermScan" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "unitId" TEXT,
    "startedBy" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "TermScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanFinding" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "decision" "FindingDecision" NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "ScanFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "capToMinorOutcome" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "oidcSub" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "unitId" TEXT,
    "programId" TEXT,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RuleSetToTermScan" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RuleSetToTermScan_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Program_obisProgramId_key" ON "Program"("obisProgramId");

-- CreateIndex
CREATE UNIQUE INDEX "Term_year_season_key" ON "Term"("year", "season");

-- CreateIndex
CREATE INDEX "Offering_termId_type_status_idx" ON "Offering"("termId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Offering_programId_termId_type_key" ON "Offering"("programId", "termId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MinorPoolCourse_offeringId_courseCode_key" ON "MinorPoolCourse"("offeringId", "courseCode");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationWindow_unitId_termId_type_key" ON "ApplicationWindow"("unitId", "termId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSet_version_key" ON "RuleSet"("version");

-- CreateIndex
CREATE UNIQUE INDEX "RuleDefinition_ruleSetId_code_key" ON "RuleDefinition"("ruleSetId", "code");

-- CreateIndex
CREATE INDEX "Application_offeringId_status_idx" ON "Application"("offeringId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Application_studentNo_offeringId_key" ON "Application"("studentNo", "offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_applicationId_key" ON "Enrollment"("applicationId");

-- CreateIndex
CREATE INDEX "Enrollment_studentNo_idx" ON "Enrollment"("studentNo");

-- CreateIndex
CREATE INDEX "Enrollment_offeringId_status_idx" ON "Enrollment"("offeringId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MinorPlanItem_enrollmentId_poolCourseId_key" ON "MinorPlanItem"("enrollmentId", "poolCourseId");

-- CreateIndex
CREATE INDEX "ScanFinding_scanId_idx" ON "ScanFinding"("scanId");

-- CreateIndex
CREATE INDEX "Notification_username_readAt_idx" ON "Notification"("username", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_oidcSub_key" ON "User"("oidcSub");

-- CreateIndex
CREATE INDEX "RoleAssignment_userId_idx" ON "RoleAssignment"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "_RuleSetToTermScan_B_index" ON "_RuleSetToTermScan"("B");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferingSourceProgram" ADD CONSTRAINT "OfferingSourceProgram_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferingSourceProgram" ADD CONSTRAINT "OfferingSourceProgram_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinorPoolCourse" ADD CONSTRAINT "MinorPoolCourse_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationWindow" ADD CONSTRAINT "ApplicationWindow_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationWindow" ADD CONSTRAINT "ApplicationWindow_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleDefinition" ADD CONSTRAINT "RuleDefinition_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ranking" ADD CONSTRAINT "Ranking_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardDecision" ADD CONSTRAINT "BoardDecision_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinorPlanItem" ADD CONSTRAINT "MinorPlanItem_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinorPlanItem" ADD CONSTRAINT "MinorPlanItem_poolCourseId_fkey" FOREIGN KEY ("poolCourseId") REFERENCES "MinorPoolCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermScan" ADD CONSTRAINT "TermScan_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "TermScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RuleSetToTermScan" ADD CONSTRAINT "_RuleSetToTermScan_A_fkey" FOREIGN KEY ("A") REFERENCES "RuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RuleSetToTermScan" ADD CONSTRAINT "_RuleSetToTermScan_B_fkey" FOREIGN KEY ("B") REFERENCES "TermScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

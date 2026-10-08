-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Season" AS ENUM ('GUZ', 'BAHAR');

-- CreateEnum
CREATE TYPE "TrackType" AS ENUM ('CAP', 'YANDAL');

-- CreateEnum
CREATE TYPE "CourseKind" AS ENUM ('ZORUNLU', 'TEKNIK_SECMELI', 'SOSYAL_SECMELI');

-- CreateEnum
CREATE TYPE "OfferingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RuleSetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ApplicationPath" AS ENUM ('RANK', 'ENTRY_SCORE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'INELIGIBLE', 'WITHDRAWN', 'UNDER_REVIEW', 'PROPOSED', 'ACCEPTED', 'WAITLISTED', 'REJECTED', 'ENROLLED', 'NOT_ENROLLED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'MISMATCH');

-- CreateEnum
CREATE TYPE "Proposal" AS ENUM ('ASIL', 'YEDEK', 'RET');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'FROZEN', 'WITHDRAWN', 'REMOVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('TRANSKRIPT', 'BASARI_BELGESI', 'YKS_BELGESI', 'DONEM_TRANSKRIPTI', 'DIGER');

-- CreateEnum
CREATE TYPE "ProtocolItemKind" AS ENUM ('COURSE', 'ELECTIVE_SLOT');

-- CreateEnum
CREATE TYPE "ProtocolItemStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'EXEMPT');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'IN_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalSubject" AS ENUM ('PROTOCOL', 'COURSE_REG', 'EXEMPTION');

-- CreateEnum
CREATE TYPE "ApprovalRole" AS ENUM ('OGRENCI', 'ANA_DAL_DANISMANI', 'ANA_DAL_BOLUM_BASKANI', 'KOORDINATOR', 'CAP_BOLUM_BASKANI');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveReason" AS ENUM ('ERASMUS', 'FARABI', 'DERS_ACILMADI', 'DERS_CAKISMASI', 'DIGER');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "FindingDecision" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('DANISMAN', 'KOORDINATOR', 'BOLUM_BASKANI');

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
    "semester" INTEGER NOT NULL,
    "kind" "CourseKind" NOT NULL,

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
CREATE TABLE "Offering" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "type" "TrackType" NOT NULL,
    "quota" INTEGER NOT NULL,
    "firstYearIntake" INTEGER,
    "quotaJustification" TEXT,
    "status" "OfferingStatus" NOT NULL DEFAULT 'DRAFT',
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "announceAt" TIMESTAMP(3),
    "registrationDeadline" TIMESTAMP(3),
    "waitlistDeadline" TIMESTAMP(3),
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
CREATE TABLE "YearStat" (
    "year" INTEGER NOT NULL,
    "baseScore" DOUBLE PRECISION NOT NULL,
    "successRankLimit" INTEGER,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YearStat_pkey" PRIMARY KEY ("year")
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
    "role" "StaffRole" NOT NULL,
    "programId" TEXT,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "studentNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "programId" TEXT NOT NULL,
    "entryYear" INTEGER NOT NULL,
    "semesterNo" INTEGER NOT NULL,
    "gano" DOUBLE PRECISION NOT NULL,
    "completedAllCourses" BOOLEAN NOT NULL,
    "classRank" INTEGER,
    "classSize" INTEGER,
    "entryScore" DOUBLE PRECISION,
    "successRank" INTEGER,
    "advisorUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("studentNo")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "studentNo" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "path" "ApplicationPath" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "eligibility" JSONB NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "verification" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "withdrawReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "applicationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("applicationId","documentId")
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
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startTermId" TEXT NOT NULL,
    "ganoStrikes" INTEGER NOT NULL DEFAULT 0,
    "mainAdvisorUsername" TEXT,
    "mainGraduationGano" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
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
    "kind" "ProtocolItemKind" NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "ects" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,

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
CREATE TABLE "Protocol" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "round" INTEGER NOT NULL DEFAULT 1,
    "commonEcts" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Protocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolCourse" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "ProtocolItemKind" NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "ects" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "status" "ProtocolItemStatus" NOT NULL DEFAULT 'PENDING',
    "grade" TEXT,
    "fulfilledCode" TEXT,
    "fulfilledName" TEXT,
    "termId" TEXT,

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
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRegistrationItem" (
    "id" TEXT NOT NULL,
    "courseRegistrationId" TEXT NOT NULL,
    "protocolCourseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ects" INTEGER NOT NULL,

    CONSTRAINT "CourseRegistrationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExemptionRequest" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "protocolCourseId" TEXT NOT NULL,
    "sourceGrade" TEXT NOT NULL,
    "sourceTerm" TEXT NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'IN_APPROVAL',
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "ExemptionRequest_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "TermRecord" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "mainGano" DOUBLE PRECISION NOT NULL,
    "mainFrozen" BOOLEAN NOT NULL DEFAULT false,
    "declaredBy" TEXT NOT NULL,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "TermRecord_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "TermScan" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
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
    "requestedBy" TEXT NOT NULL,
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
CREATE UNIQUE INDEX "Term_year_season_key" ON "Term"("year", "season");

-- CreateIndex
CREATE UNIQUE INDEX "Offering_termId_type_key" ON "Offering"("termId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSet_version_key" ON "RuleSet"("version");

-- CreateIndex
CREATE UNIQUE INDEX "RuleDefinition_ruleSetId_code_key" ON "RuleDefinition"("ruleSetId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_oidcSub_key" ON "User"("oidcSub");

-- CreateIndex
CREATE INDEX "RoleAssignment_userId_idx" ON "RoleAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "Document_studentNo_kind_idx" ON "Document"("studentNo", "kind");

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
CREATE UNIQUE INDEX "ProtocolTemplate_type_sourceProgramId_key" ON "ProtocolTemplate"("type", "sourceProgramId");

-- CreateIndex
CREATE INDEX "ProtocolTemplateItem_templateId_position_idx" ON "ProtocolTemplateItem"("templateId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolCondition_templateId_no_key" ON "ProtocolCondition"("templateId", "no");

-- CreateIndex
CREATE UNIQUE INDEX "Protocol_enrollmentId_key" ON "Protocol"("enrollmentId");

-- CreateIndex
CREATE INDEX "ProtocolCourse_protocolId_position_idx" ON "ProtocolCourse"("protocolId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistration_enrollmentId_termId_key" ON "CourseRegistration"("enrollmentId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistrationItem_courseRegistrationId_protocolCourseI_key" ON "CourseRegistrationItem"("courseRegistrationId", "protocolCourseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExemptionRequest_enrollmentId_conditionId_key" ON "ExemptionRequest"("enrollmentId", "conditionId");

-- CreateIndex
CREATE INDEX "Approval_subjectType_subjectId_idx" ON "Approval"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "Approval_assigneeUsername_decision_idx" ON "Approval"("assigneeUsername", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "TermRecord_enrollmentId_termId_key" ON "TermRecord"("enrollmentId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "TermLeave_enrollmentId_termId_key" ON "TermLeave"("enrollmentId", "termId");

-- CreateIndex
CREATE INDEX "ScanFinding_scanId_idx" ON "ScanFinding"("scanId");

-- CreateIndex
CREATE INDEX "Notification_username_readAt_idx" ON "Notification"("username", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "_RuleSetToTermScan_B_index" ON "_RuleSetToTermScan"("B");

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferingSourceProgram" ADD CONSTRAINT "OfferingSourceProgram_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferingSourceProgram" ADD CONSTRAINT "OfferingSourceProgram_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleDefinition" ADD CONSTRAINT "RuleDefinition_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "StudentProfile"("studentNo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "StudentProfile"("studentNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ranking" ADD CONSTRAINT "Ranking_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardDecision" ADD CONSTRAINT "BoardDecision_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentNo_fkey" FOREIGN KEY ("studentNo") REFERENCES "StudentProfile"("studentNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_startTermId_fkey" FOREIGN KEY ("startTermId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolTemplate" ADD CONSTRAINT "ProtocolTemplate_sourceProgramId_fkey" FOREIGN KEY ("sourceProgramId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolTemplateItem" ADD CONSTRAINT "ProtocolTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProtocolTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolCondition" ADD CONSTRAINT "ProtocolCondition_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProtocolTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Protocol" ADD CONSTRAINT "Protocol_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProtocolTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolCourse" ADD CONSTRAINT "ProtocolCourse_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistrationItem" ADD CONSTRAINT "CourseRegistrationItem_courseRegistrationId_fkey" FOREIGN KEY ("courseRegistrationId") REFERENCES "CourseRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistrationItem" ADD CONSTRAINT "CourseRegistrationItem_protocolCourseId_fkey" FOREIGN KEY ("protocolCourseId") REFERENCES "ProtocolCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExemptionRequest" ADD CONSTRAINT "ExemptionRequest_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExemptionRequest" ADD CONSTRAINT "ExemptionRequest_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "ProtocolCondition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExemptionRequest" ADD CONSTRAINT "ExemptionRequest_protocolCourseId_fkey" FOREIGN KEY ("protocolCourseId") REFERENCES "ProtocolCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermRecord" ADD CONSTRAINT "TermRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermRecord" ADD CONSTRAINT "TermRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermLeave" ADD CONSTRAINT "TermLeave_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermLeave" ADD CONSTRAINT "TermLeave_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermScan" ADD CONSTRAINT "TermScan_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "TermScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RuleSetToTermScan" ADD CONSTRAINT "_RuleSetToTermScan_A_fkey" FOREIGN KEY ("A") REFERENCES "RuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RuleSetToTermScan" ADD CONSTRAINT "_RuleSetToTermScan_B_fkey" FOREIGN KEY ("B") REFERENCES "TermScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Denetim kaydı değiştirilemez ve silinemez.
CREATE OR REPLACE FUNCTION audit_log_readonly() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog kayıtları değiştirilemez veya silinemez';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_readonly();

-- KR-ÇAP-06 / KR-YD-04: bir öğrencinin aynı türde en fazla bir etkin (veya dondurulmuş) kaydı olabilir.
CREATE UNIQUE INDEX "Enrollment_one_active_per_type"
  ON "Enrollment" ("studentNo", "type")
  WHERE "status" IN ('ACTIVE', 'FROZEN');

-- Yalnızca bir bölüm "ev sahibi" olabilir; yan dal havuzu (kaynak bölümü boş şablon) türü başına tektir.
CREATE UNIQUE INDEX "Program_single_home" ON "Program" ("isHome") WHERE "isHome";
CREATE UNIQUE INDEX "ProtocolTemplate_one_general_per_type" ON "ProtocolTemplate" ("type") WHERE "sourceProgramId" IS NULL;

-- Değer aralıkları.
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_quota_positive" CHECK ("quota" > 0);
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_window_order" CHECK ("closesAt" > "opensAt");
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_strikes_nonneg" CHECK ("ganoStrikes" >= 0);
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_gano_range" CHECK ("gano" >= 0 AND "gano" <= 4);
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_student_no" CHECK ("studentNo" ~ '^[0-9]{9}$');
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_rank_in_class" CHECK ("classRank" IS NULL OR ("classSize" IS NOT NULL AND "classRank" BETWEEN 1 AND "classSize"));
ALTER TABLE "TermRecord" ADD CONSTRAINT "TermRecord_gano_range" CHECK ("mainGano" >= 0 AND "mainGano" <= 4);

-- Job application pipeline (Kanban) + activity log

CREATE TYPE "JobApplicationStatus" AS ENUM ('SAVED', 'APPLIED', 'OA', 'INTERVIEW', 'REJECTED', 'OFFER');

CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'SAVED',
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "applicationUrl" TEXT,
    "notes" TEXT,
    "deadline" TIMESTAMPTZ(3),
    "appliedAt" TIMESTAMPTZ(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobApplicationActivity" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromStatus" "JobApplicationStatus",
    "toStatus" "JobApplicationStatus",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobApplicationActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobApplication_userId_status_sortOrder_idx" ON "JobApplication"("userId", "status", "sortOrder");

CREATE INDEX "JobApplication_userId_idx" ON "JobApplication"("userId");

CREATE INDEX "JobApplicationActivity_applicationId_idx" ON "JobApplicationActivity"("applicationId");

ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobApplicationActivity" ADD CONSTRAINT "JobApplicationActivity_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

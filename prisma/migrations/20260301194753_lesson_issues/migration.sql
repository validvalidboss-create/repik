-- CreateEnum
CREATE TYPE "LessonIssueType" AS ENUM ('TUTOR_NO_SHOW', 'STUDENT_COULD_NOT_JOIN', 'TECHNICAL_PROBLEM', 'QUALITY_NOT_AS_EXPECTED', 'OTHER');

-- CreateEnum
CREATE TYPE "LessonIssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'DISPUTED';

-- CreateTable
CREATE TABLE "LessonIssue" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "type" "LessonIssueType" NOT NULL,
    "status" "LessonIssueStatus" NOT NULL DEFAULT 'OPEN',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonIssue_bookingId_idx" ON "LessonIssue"("bookingId");

-- CreateIndex
CREATE INDEX "LessonIssue_reporterId_idx" ON "LessonIssue"("reporterId");

-- AddForeignKey
ALTER TABLE "LessonIssue" ADD CONSTRAINT "LessonIssue_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonIssue" ADD CONSTRAINT "LessonIssue_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

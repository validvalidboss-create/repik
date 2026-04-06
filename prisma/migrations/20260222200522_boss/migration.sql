-- CreateTable
CREATE TABLE "LessonBalance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonBalance_studentId_idx" ON "LessonBalance"("studentId");

-- CreateIndex
CREATE INDEX "LessonBalance_tutorId_idx" ON "LessonBalance"("tutorId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonBalance_studentId_tutorId_key" ON "LessonBalance"("studentId", "tutorId");

-- AddForeignKey
ALTER TABLE "LessonBalance" ADD CONSTRAINT "LessonBalance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonBalance" ADD CONSTRAINT "LessonBalance_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

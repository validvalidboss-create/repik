-- CreateTable
CREATE TABLE "ArchivedStudent" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivedStudent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArchivedStudent_tutorId_idx" ON "ArchivedStudent"("tutorId");

-- CreateIndex
CREATE INDEX "ArchivedStudent_studentId_idx" ON "ArchivedStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivedStudent_tutorId_studentId_key" ON "ArchivedStudent"("tutorId", "studentId");

-- AddForeignKey
ALTER TABLE "ArchivedStudent" ADD CONSTRAINT "ArchivedStudent_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivedStudent" ADD CONSTRAINT "ArchivedStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

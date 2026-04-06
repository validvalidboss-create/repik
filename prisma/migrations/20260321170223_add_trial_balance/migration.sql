-- CreateTable
CREATE TABLE "TrialBalance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrialBalance_studentId_key" ON "TrialBalance"("studentId");

-- CreateIndex
CREATE INDEX "TrialBalance_studentId_idx" ON "TrialBalance"("studentId");

-- AddForeignKey
ALTER TABLE "TrialBalance" ADD CONSTRAINT "TrialBalance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CreditsTransfer" (
    "id" TEXT NOT NULL,
    "transferKey" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromTutorId" TEXT NOT NULL,
    "toTutorId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditsTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditsTransfer_transferKey_key" ON "CreditsTransfer"("transferKey");

-- CreateIndex
CREATE INDEX "CreditsTransfer_studentId_idx" ON "CreditsTransfer"("studentId");

-- CreateIndex
CREATE INDEX "CreditsTransfer_fromTutorId_idx" ON "CreditsTransfer"("fromTutorId");

-- CreateIndex
CREATE INDEX "CreditsTransfer_toTutorId_idx" ON "CreditsTransfer"("toTutorId");

-- CreateIndex
CREATE INDEX "CreditsTransfer_studentId_fromTutorId_idx" ON "CreditsTransfer"("studentId", "fromTutorId");

-- CreateIndex
CREATE INDEX "CreditsTransfer_studentId_toTutorId_idx" ON "CreditsTransfer"("studentId", "toTutorId");

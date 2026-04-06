-- CreateTable
CREATE TABLE "LessonPackagePurchase" (
    "id" TEXT NOT NULL,
    "purchaseKey" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "lessons" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonPackagePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonPackagePurchase_purchaseKey_key" ON "LessonPackagePurchase"("purchaseKey");

-- CreateIndex
CREATE INDEX "LessonPackagePurchase_studentId_idx" ON "LessonPackagePurchase"("studentId");

-- CreateIndex
CREATE INDEX "LessonPackagePurchase_tutorId_idx" ON "LessonPackagePurchase"("tutorId");

-- CreateIndex
CREATE INDEX "LessonPackagePurchase_studentId_tutorId_idx" ON "LessonPackagePurchase"("studentId", "tutorId");

-- AddForeignKey
ALTER TABLE "LessonPackagePurchase" ADD CONSTRAINT "LessonPackagePurchase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPackagePurchase" ADD CONSTRAINT "LessonPackagePurchase_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

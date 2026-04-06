-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 50;

-- AlterTable
ALTER TABLE "Tutor" ADD COLUMN     "allowedDurations" INTEGER[],
ADD COLUMN     "country" TEXT,
ADD COLUMN     "defaultLessonMinutes" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "native" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tracks" TEXT[];

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE INDEX "Favorite_tutorId_idx" ON "Favorite"("tutorId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_tutorId_key" ON "Favorite"("userId", "tutorId");

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

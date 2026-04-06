-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "note" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Tutor" ADD COLUMN     "payoutBankName" TEXT,
ADD COLUMN     "payoutCardLast4" TEXT,
ADD COLUMN     "payoutIban" TEXT,
ADD COLUMN     "payoutReceiverName" TEXT;

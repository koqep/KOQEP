-- AlterTable
ALTER TABLE "ModerationAuditLog" ADD COLUMN     "targetUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mutedUntil" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "ModerationAuditLog" ADD CONSTRAINT "ModerationAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "revokedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ModerationAuditLog" ADD COLUMN     "targetInviteId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pendingInviteDebt" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "ModerationAuditLog" ADD CONSTRAINT "ModerationAuditLog_targetInviteId_fkey" FOREIGN KEY ("targetInviteId") REFERENCES "Invite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

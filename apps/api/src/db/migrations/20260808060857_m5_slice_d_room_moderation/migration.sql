-- AlterTable
ALTER TABLE "ModerationAuditLog" ADD COLUMN     "deletedMessageCount" INTEGER,
ADD COLUMN     "targetRoomDescription" TEXT,
ADD COLUMN     "targetRoomId" TEXT,
ADD COLUMN     "targetRoomName" TEXT;

-- AddForeignKey
ALTER TABLE "ModerationAuditLog" ADD CONSTRAINT "ModerationAuditLog_targetRoomId_fkey" FOREIGN KEY ("targetRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

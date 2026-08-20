-- AlterTable
ALTER TABLE "ModerationAuditLog" ADD COLUMN     "targetRoomAnnouncement" TEXT;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "announcement" TEXT;

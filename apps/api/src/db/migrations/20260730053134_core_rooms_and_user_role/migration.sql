-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'moderator');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'user';

-- M0's single dev room becomes the real #general core room in place -
-- preserves its id/message history rather than abandoning it for an
-- empty new row (M2 Slice A).
UPDATE "Room" SET "name" = 'general' WHERE "name" = 'genel'
  AND NOT EXISTS (SELECT 1 FROM "Room" WHERE "name" = 'general');

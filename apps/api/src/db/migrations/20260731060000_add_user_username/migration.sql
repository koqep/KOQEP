-- M2.5 Slice A: username as a separate display identity from email.
-- Backfilled from the email local-part for existing rows (verified against
-- the current dataset: no case-insensitive collisions) rather than adding
-- an empty column and abandoning existing accounts without a display name.

-- AlterTable: add nullable first, existing rows can't have a value yet.
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Backfill: everything before the @ in the existing email.
UPDATE "User" SET "username" = split_part("email", '@', 1) WHERE "username" IS NULL;

-- Now safe to require it going forward.
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "revokedByRotation" BOOLEAN NOT NULL DEFAULT false;

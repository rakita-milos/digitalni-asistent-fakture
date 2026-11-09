-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "refresh_expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "refresh_token_hash" TEXT;

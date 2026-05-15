-- CreateEnum
CREATE TYPE "VideoProvider" AS ENUM ('EXTERNAL', 'R2');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "videoProvider" "VideoProvider",
ADD COLUMN "videoAssetKey" TEXT,
ADD COLUMN "videoMimeType" TEXT,
ADD COLUMN "videoBytes" INTEGER;

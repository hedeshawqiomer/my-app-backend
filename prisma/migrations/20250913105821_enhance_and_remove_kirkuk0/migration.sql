-- DropIndex
DROP INDEX "public"."Post_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Post_status_acceptedAt_idx";

-- DropIndex
DROP INDEX "public"."Post_status_city_idx";

-- DropIndex
DROP INDEX "public"."User_role_idx";

-- AlterTable
ALTER TABLE "public"."Image" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Post" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "updatedAt" DROP DEFAULT;

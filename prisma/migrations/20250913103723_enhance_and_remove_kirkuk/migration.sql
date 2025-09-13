-- 0) Enable citext (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS citext;

-- 1) Make User.email CITEXT (case-insensitive) and keep it NOT NULL/UNIQUE
ALTER TABLE "public"."User"
  ALTER COLUMN "email" TYPE citext;

-- 2) Ensure User.updatedAt exists and is NOT NULL now() (for @updatedAt)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='User' AND column_name='updatedAt'
  ) THEN
    ALTER TABLE "public"."User" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END$$;

UPDATE "public"."User" SET "updatedAt" = COALESCE("updatedAt", NOW());
ALTER TABLE "public"."User" ALTER COLUMN "updatedAt" SET NOT NULL;

-- 3) Ensure Post.updatedAt is NOT NULL, default now() (for @updatedAt)
ALTER TABLE "public"."Post"
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
UPDATE "public"."Post" SET "updatedAt" = COALESCE("updatedAt", NOW());
ALTER TABLE "public"."Post" ALTER COLUMN "updatedAt" SET NOT NULL;

-- 4) Add Image.createdAt / Image.updatedAt if missing, fill values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Image' AND column_name='createdAt'
  ) THEN
    ALTER TABLE "public"."Image" ADD COLUMN "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Image' AND column_name='updatedAt'
  ) THEN
    ALTER TABLE "public"."Image" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
  END IF;
END$$;

UPDATE "public"."Image" SET
  "createdAt" = COALESCE("createdAt", NOW()),
  "updatedAt" = COALESCE("updatedAt", NOW());

ALTER TABLE "public"."Image"
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- 5) Change Image -> Post FK to ON DELETE CASCADE
ALTER TABLE "public"."Image" DROP CONSTRAINT IF EXISTS "Image_postId_fkey";
ALTER TABLE "public"."Image"
  ADD CONSTRAINT "Image_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "public"."Post"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 6) Remove 'Kirkuk' from City enum (safe rebuild)
DO $$
DECLARE
  has_kirkuk boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'City' AND e.enumlabel = 'Kirkuk'
  ) INTO has_kirkuk;

  IF has_kirkuk THEN
    -- If any rows still have 'Kirkuk', set to NULL (or remap to any valid city here)
    UPDATE "public"."Post" SET "city" = NULL WHERE "city"::text = 'Kirkuk';

    CREATE TYPE "City_new" AS ENUM ('Erbil','Sulaimani','Duhok','Halabja');

    ALTER TABLE "public"."Post"
      ALTER COLUMN "city" TYPE "City_new" USING ("city"::text::"City_new");

    ALTER TYPE "City" RENAME TO "City_old";
    ALTER TYPE "City_new" RENAME TO "City";
    DROP TYPE "City_old";
  END IF;
END$$;

-- 7) Helpful indexes (create if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='Post_status_city_idx') THEN
    CREATE INDEX "Post_status_city_idx" ON "public"."Post"("status","city");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='Post_status_acceptedAt_idx') THEN
    CREATE INDEX "Post_status_acceptedAt_idx" ON "public"."Post"("status","acceptedAt");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='Post_createdAt_idx') THEN
    CREATE INDEX "Post_createdAt_idx" ON "public"."Post"("createdAt");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='Image_postId_order_idx') THEN
    CREATE INDEX "Image_postId_order_idx" ON "public"."Image"("postId","order");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='User_role_idx') THEN
    CREATE INDEX "User_role_idx" ON "public"."User"("role");
  END IF;
END$$;

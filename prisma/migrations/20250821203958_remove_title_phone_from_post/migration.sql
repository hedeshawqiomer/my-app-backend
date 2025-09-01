/*
  Warnings:

  - You are about to drop the column `phone` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Post` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Post" DROP COLUMN "phone",
DROP COLUMN "title";

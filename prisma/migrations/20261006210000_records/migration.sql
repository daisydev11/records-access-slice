-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('NOTE_DELETED');

-- CreateTable
CREATE TABLE "Note" (
    "id" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "recordPublicId" TEXT NOT NULL,
    "recordInternalId" INTEGER NOT NULL,
    "recordTitle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Note_publicId_key" ON "Note"("publicId");

-- CreateIndex
CREATE INDEX "Note_userId_createdAt_idx" ON "Note"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: Prisma's schema language cannot express check constraints.

-- A note always has a real title, and a public identifier of the expected form.
ALTER TABLE "Note" ADD CONSTRAINT "Note_title_check" CHECK (char_length(btrim("title")) BETWEEN 1 AND 120);
ALTER TABLE "Note" ADD CONSTRAINT "Note_body_check" CHECK (char_length("body") <= 5000);
ALTER TABLE "Note" ADD CONSTRAINT "Note_publicId_check" CHECK ("publicId" ~ '^[A-Za-z0-9_-]{16}$');

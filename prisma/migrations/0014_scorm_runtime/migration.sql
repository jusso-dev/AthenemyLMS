ALTER TABLE "ExternalPackageAttempt" ADD COLUMN "runtimeSessionId" TEXT;
CREATE TABLE "ExternalPackageSession" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "sessionTimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalPackageSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExternalPackageSession_tokenHash_key" ON "ExternalPackageSession"("tokenHash");
CREATE INDEX "ExternalPackageSession_attemptId_idx" ON "ExternalPackageSession"("attemptId");
CREATE INDEX "ExternalPackageSession_expiresAt_idx" ON "ExternalPackageSession"("expiresAt");
ALTER TABLE "ExternalPackageSession" ADD CONSTRAINT "ExternalPackageSession_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExternalPackageAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

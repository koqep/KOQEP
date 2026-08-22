-- CreateTable
CREATE TABLE "TrafficLog" (
    "id" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "connectionId" TEXT,
    "bytesTransferred" INTEGER,
    "integrityHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "TrafficLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrafficLog_userId_idx" ON "TrafficLog"("userId");

-- CreateIndex
CREATE INDEX "TrafficLog_createdAt_idx" ON "TrafficLog"("createdAt");

-- CreateIndex
CREATE INDEX "TrafficLog_connectionId_idx" ON "TrafficLog"("connectionId");

-- AddForeignKey
ALTER TABLE "TrafficLog" ADD CONSTRAINT "TrafficLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

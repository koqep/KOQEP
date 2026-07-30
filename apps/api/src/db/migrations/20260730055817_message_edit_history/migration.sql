-- CreateTable
CREATE TABLE "MessageEdit" (
    "id" TEXT NOT NULL,
    "previousContent" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageId" TEXT NOT NULL,

    CONSTRAINT "MessageEdit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageEdit_messageId_idx" ON "MessageEdit"("messageId");

-- AddForeignKey
ALTER TABLE "MessageEdit" ADD CONSTRAINT "MessageEdit_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

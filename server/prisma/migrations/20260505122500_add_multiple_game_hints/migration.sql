-- CreateTable
CREATE TABLE "GameHint" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "hintOrder" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameHint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameHint_gameSessionId_idx" ON "GameHint"("gameSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GameHint_gameSessionId_hintOrder_key" ON "GameHint"("gameSessionId", "hintOrder");

-- AddForeignKey
ALTER TABLE "GameHint" ADD CONSTRAINT "GameHint_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

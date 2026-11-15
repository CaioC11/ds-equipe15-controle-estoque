-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN     "estoqueDestinoId" TEXT,
ADD COLUMN     "estoqueOrigemId" TEXT,
ADD COLUMN     "transferenciaId" TEXT;

-- CreateIndex
CREATE INDEX "Movimentacao_transferenciaId_idx" ON "Movimentacao"("transferenciaId");

/*
  Warnings:

  - The values [SOLICITADO,ATRASADO] on the enum `StatusEmprestimo` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `dataEmprestimo` on the `Emprestimo` table. All the data in the column will be lost.
  - You are about to drop the column `dataPrevistaDevolucao` on the `Emprestimo` table. All the data in the column will be lost.
  - You are about to drop the column `usuarioSolicitanteId` on the `Emprestimo` table. All the data in the column will be lost.
  - You are about to drop the column `categoria` on the `Item` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[termoId]` on the table `Emprestimo` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nome]` on the table `Estoque` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `responsavelCargo` to the `Emprestimo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `responsavelLotacao` to the `Emprestimo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `responsavelNome` to the `Emprestimo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `responsavelSiape` to the `Emprestimo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categoriaId` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipo` to the `Item` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TipoItem" AS ENUM ('PATRIMONIAL', 'CONSUMO');

-- AlterEnum
BEGIN;
CREATE TYPE "StatusEmprestimo_new" AS ENUM ('AGUARDANDO_TERMO', 'ATIVO', 'DEVOLVIDO', 'CANCELADO');
ALTER TABLE "Emprestimo" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Emprestimo" ALTER COLUMN "status" TYPE "StatusEmprestimo_new" USING ("status"::text::"StatusEmprestimo_new");
ALTER TYPE "StatusEmprestimo" RENAME TO "StatusEmprestimo_old";
ALTER TYPE "StatusEmprestimo_new" RENAME TO "StatusEmprestimo";
DROP TYPE "StatusEmprestimo_old";
ALTER TABLE "Emprestimo" ALTER COLUMN "status" SET DEFAULT 'AGUARDANDO_TERMO';
COMMIT;

-- AlterTable
ALTER TABLE "Emprestimo" DROP COLUMN "dataEmprestimo",
DROP COLUMN "dataPrevistaDevolucao",
DROP COLUMN "usuarioSolicitanteId",
ADD COLUMN     "dataRetirada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "prazoDevolucao" TIMESTAMP(3),
ADD COLUMN     "responsavelCargo" TEXT NOT NULL,
ADD COLUMN     "responsavelLotacao" TEXT NOT NULL,
ADD COLUMN     "responsavelNome" TEXT NOT NULL,
ADD COLUMN     "responsavelSiape" TEXT NOT NULL,
ADD COLUMN     "termoId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'AGUARDANDO_TERMO';

-- AlterTable
ALTER TABLE "Estoque" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "gestorId" TEXT;

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "categoria",
ADD COLUMN     "categoriaId" TEXT NOT NULL,
ADD COLUMN     "numeroSerie" TEXT,
ADD COLUMN     "tipo" "TipoItem" NOT NULL;

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Termo" (
    "id" TEXT NOT NULL,
    "numeroAno" TEXT NOT NULL,
    "arquivoPdf" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Termo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_key" ON "Categoria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Termo_numeroAno_key" ON "Termo"("numeroAno");

-- CreateIndex
CREATE UNIQUE INDEX "Emprestimo_termoId_key" ON "Emprestimo"("termoId");

-- CreateIndex
CREATE UNIQUE INDEX "Estoque_nome_key" ON "Estoque"("nome");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_termoId_fkey" FOREIGN KEY ("termoId") REFERENCES "Termo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

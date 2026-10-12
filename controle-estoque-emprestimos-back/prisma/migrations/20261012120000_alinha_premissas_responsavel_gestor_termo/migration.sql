-- Alinha o modelo às premissas A1 a A7 (validadas pela Gerência de Infraestrutura):
--   A1: vários gestores por estoque (tabela EstoqueGestor, substitui Estoque.gestorId)
--   A3: responsável cadastrado pelo gestor e reaproveitado (tabela Responsavel)
--   A4: item "sem tombamento" e nº de série único
--   A5: justificativa de permanência (libera novo empréstimo em atraso)
--   A6: PDF gerado e PDF assinado no Termo
--   A7: nível mínimo sem default (null = sem alerta)

-- CreateTable
CREATE TABLE "EstoqueGestor" (
    "estoqueId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstoqueGestor_pkey" PRIMARY KEY ("estoqueId","usuarioId")
);

-- CreateTable
CREATE TABLE "Responsavel" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "siape" TEXT,
    "cpf" TEXT,
    "lotacao" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Responsavel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EstoqueGestor_usuarioId_idx" ON "EstoqueGestor"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Responsavel_siape_key" ON "Responsavel"("siape");

-- CreateIndex
CREATE UNIQUE INDEX "Responsavel_cpf_key" ON "Responsavel"("cpf");

-- AddForeignKey
ALTER TABLE "EstoqueGestor" ADD CONSTRAINT "EstoqueGestor_estoqueId_fkey" FOREIGN KEY ("estoqueId") REFERENCES "Estoque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A1: preserva o gestor já gravado em Estoque.gestorId antes de remover a coluna
INSERT INTO "EstoqueGestor" ("estoqueId", "usuarioId")
SELECT "id", "gestorId" FROM "Estoque" WHERE "gestorId" IS NOT NULL;

-- AlterTable
ALTER TABLE "Estoque" DROP COLUMN "gestorId";

-- AlterTable (A4, A7)
ALTER TABLE "Item" ADD COLUMN     "semTombamento" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "nivelMinimo" DROP DEFAULT;

-- CreateIndex (A4)
CREATE UNIQUE INDEX "Item_numeroSerie_key" ON "Item"("numeroSerie");

-- AlterTable (A6)
ALTER TABLE "Termo" ADD COLUMN     "arquivoAssinado" TEXT;

-- AlterTable (A3, A5): responsavelId entra nulo, é preenchido a partir dos dados antigos e só depois vira NOT NULL
ALTER TABLE "Emprestimo" ADD COLUMN     "justificativaPermanencia" TEXT,
ADD COLUMN     "responsavelId" TEXT;

-- A3: cria um Responsavel para cada Siape já usado em empréstimos e vincula
INSERT INTO "Responsavel" ("id", "nome", "siape", "lotacao", "cargo", "updatedAt")
SELECT DISTINCT ON ("responsavelSiape")
    gen_random_uuid()::text, "responsavelNome", "responsavelSiape", "responsavelLotacao", "responsavelCargo", CURRENT_TIMESTAMP
FROM "Emprestimo"
ORDER BY "responsavelSiape", "createdAt" DESC;

UPDATE "Emprestimo" e
SET "responsavelId" = r."id"
FROM "Responsavel" r
WHERE r."siape" = e."responsavelSiape";

ALTER TABLE "Emprestimo" ALTER COLUMN "responsavelId" SET NOT NULL,
DROP COLUMN "responsavelCargo",
DROP COLUMN "responsavelLotacao",
DROP COLUMN "responsavelNome",
DROP COLUMN "responsavelSiape";

-- CreateIndex
CREATE INDEX "Emprestimo_responsavelId_idx" ON "Emprestimo"("responsavelId");

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Responsavel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

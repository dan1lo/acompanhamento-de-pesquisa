-- AlterTable
ALTER TABLE "aluno" ADD COLUMN     "exclusaoSolicitadaEm" TIMESTAMP(3),
ADD COLUMN     "exportacaoSolicitadaEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reuniao" ADD COLUMN     "lembreteEnviado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "tokenRecuperacao" TEXT,
ADD COLUMN     "tokenRecuperacaoExpiraEm" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_tokenRecuperacao_key" ON "usuario"("tokenRecuperacao");


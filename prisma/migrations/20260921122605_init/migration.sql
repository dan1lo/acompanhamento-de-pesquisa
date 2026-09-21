-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('PROFESSOR', 'ALUNO', 'COORIENTADOR');

-- CreateEnum
CREATE TYPE "NivelAluno" AS ENUM ('TCC', 'MESTRADO', 'DOUTORADO');

-- CreateEnum
CREATE TYPE "StatusAluno" AS ENUM ('OK', 'ATENCAO', 'CRITICO');

-- CreateEnum
CREATE TYPE "StatusReuniao" AS ENUM ('AGENDADA', 'REALIZADA', 'CANCELADA', 'FALTA');

-- CreateEnum
CREATE TYPE "StatusResumo" AS ENUM ('RASCUNHO', 'PUBLICADO');

-- CreateEnum
CREATE TYPE "StatusTarefa" AS ENUM ('ABERTA', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "TipoNota" AS ENUM ('PRIVADA', 'COMPARTILHADA');

-- CreateEnum
CREATE TYPE "StatusProducao" AS ENUM ('EM_ESCRITA', 'SUBMETIDO', 'EM_REVISAO', 'ACEITO', 'PUBLICADO');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('DIAS_SEM_REUNIAO', 'TAREFA_ATRASADA', 'PRAZO_PROXIMO', 'FALTA_SEM_AVISO', 'CHECKIN_NAO_PREENCHIDO');

-- CreateEnum
CREATE TYPE "ProvedorIA" AS ENUM ('CLAUDE', 'GEMINI');

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "papel" "PapelUsuario" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "nivel" "NivelAluno" NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "professorId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,

    CONSTRAINT "convite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aceite_ciencia" (
    "id" TEXT NOT NULL,
    "aceitoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versao" TEXT NOT NULL DEFAULT '1.0',
    "alunoId" TEXT NOT NULL,

    CONSTRAINT "aceite_ciencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aluno" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nivel" "NivelAluno" NOT NULL,
    "tema" TEXT,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "statusManual" "StatusAluno",
    "arquivado" BOOLEAN NOT NULL DEFAULT false,
    "bemEstarAtivo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT,
    "orientadorId" TEXT NOT NULL,

    CONSTRAINT "aluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coorientacao" (
    "id" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alunoId" TEXT NOT NULL,
    "coorientadorId" TEXT NOT NULL,

    CONSTRAINT "coorientacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horario_livre" (
    "id" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "recorrente" BOOLEAN NOT NULL DEFAULT false,
    "diaSemana" INTEGER,
    "reservado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horario_livre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horario_fixo" (
    "id" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alunoId" TEXT NOT NULL,

    CONSTRAINT "horario_fixo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reuniao" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "pauta" TEXT,
    "status" "StatusReuniao" NOT NULL DEFAULT 'AGENDADA',
    "falta" BOOLEAN NOT NULL DEFAULT false,
    "googleEventId" TEXT,
    "meetLink" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "alunoId" TEXT NOT NULL,
    "horarioLivreId" TEXT,

    CONSTRAINT "reuniao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkin" (
    "id" TEXT NOT NULL,
    "oQueFez" TEXT,
    "duvidas" TEXT,
    "bloqueios" TEXT,
    "preenchidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reuniaoId" TEXT NOT NULL,

    CONSTRAINT "checkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcricao" (
    "id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "origemArquivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reuniaoId" TEXT NOT NULL,

    CONSTRAINT "transcricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumo" (
    "id" TEXT NOT NULL,
    "status" "StatusResumo" NOT NULL DEFAULT 'RASCUNHO',
    "decisoes" TEXT,
    "combinados" TEXT,
    "duvidasAbertas" TEXT,
    "proximosPassos" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "provedorIA" "ProvedorIA",
    "publicadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "autorId" TEXT,
    "reuniaoId" TEXT NOT NULL,

    CONSTRAINT "resumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefa" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavel" TEXT,
    "prazo" TIMESTAMP(3),
    "status" "StatusTarefa" NOT NULL DEFAULT 'ABERTA',
    "concluidaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "alunoId" TEXT NOT NULL,
    "reuniaoId" TEXT,

    CONSTRAINT "tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nota" (
    "id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" "TipoNota" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alunoId" TEXT NOT NULL,
    "reuniaoId" TEXT,

    CONSTRAINT "nota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marco" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "dataPrevista" TIMESTAMP(3) NOT NULL,
    "dataConcluida" TIMESTAMP(3),
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alunoId" TEXT NOT NULL,

    CONSTRAINT "marco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrega" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alunoId" TEXT NOT NULL,

    CONSTRAINT "entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versao_entrega" (
    "id" TEXT NOT NULL,
    "link" TEXT,
    "arquivoUrl" TEXT,
    "feedback" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregaId" TEXT NOT NULL,

    CONSTRAINT "versao_entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producao_academica" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "venue" TEXT,
    "status" "StatusProducao" NOT NULL DEFAULT 'EM_ESCRITA',
    "prazoSubmissao" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "alunoId" TEXT NOT NULL,

    CONSTRAINT "producao_academica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bem_estar" (
    "id" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alunoId" TEXT NOT NULL,

    CONSTRAINT "bem_estar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerta" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alunoId" TEXT NOT NULL,

    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_alerta" (
    "id" TEXT NOT NULL,
    "nivel" "NivelAluno" NOT NULL,
    "diasAtencao" INTEGER NOT NULL DEFAULT 14,
    "diasCritico" INTEGER NOT NULL DEFAULT 30,
    "professorId" TEXT NOT NULL,

    CONSTRAINT "configuracao_alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_auditoria" (
    "id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "detalhes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "log_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conexao_google" (
    "id" TEXT NOT NULL,
    "accessTokenCifrado" TEXT NOT NULL,
    "refreshTokenCifrado" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "conectado" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "professorId" TEXT NOT NULL,

    CONSTRAINT "conexao_google_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "convite_token_key" ON "convite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "convite_alunoId_key" ON "convite"("alunoId");

-- CreateIndex
CREATE UNIQUE INDEX "aceite_ciencia_alunoId_key" ON "aceite_ciencia"("alunoId");

-- CreateIndex
CREATE UNIQUE INDEX "aluno_email_key" ON "aluno"("email");

-- CreateIndex
CREATE UNIQUE INDEX "aluno_usuarioId_key" ON "aluno"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "coorientacao_alunoId_coorientadorId_key" ON "coorientacao"("alunoId", "coorientadorId");

-- CreateIndex
CREATE UNIQUE INDEX "reuniao_horarioLivreId_key" ON "reuniao"("horarioLivreId");

-- CreateIndex
CREATE UNIQUE INDEX "checkin_reuniaoId_key" ON "checkin"("reuniaoId");

-- CreateIndex
CREATE UNIQUE INDEX "transcricao_reuniaoId_key" ON "transcricao"("reuniaoId");

-- CreateIndex
CREATE UNIQUE INDEX "resumo_reuniaoId_key" ON "resumo"("reuniaoId");

-- CreateIndex
CREATE UNIQUE INDEX "configuracao_alerta_professorId_nivel_key" ON "configuracao_alerta"("professorId", "nivel");

-- CreateIndex
CREATE UNIQUE INDEX "conexao_google_professorId_key" ON "conexao_google"("professorId");

-- AddForeignKey
ALTER TABLE "convite" ADD CONSTRAINT "convite_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convite" ADD CONSTRAINT "convite_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aceite_ciencia" ADD CONSTRAINT "aceite_ciencia_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluno" ADD CONSTRAINT "aluno_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aluno" ADD CONSTRAINT "aluno_orientadorId_fkey" FOREIGN KEY ("orientadorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coorientacao" ADD CONSTRAINT "coorientacao_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coorientacao" ADD CONSTRAINT "coorientacao_coorientadorId_fkey" FOREIGN KEY ("coorientadorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horario_fixo" ADD CONSTRAINT "horario_fixo_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reuniao" ADD CONSTRAINT "reuniao_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reuniao" ADD CONSTRAINT "reuniao_horarioLivreId_fkey" FOREIGN KEY ("horarioLivreId") REFERENCES "horario_livre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin" ADD CONSTRAINT "checkin_reuniaoId_fkey" FOREIGN KEY ("reuniaoId") REFERENCES "reuniao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcricao" ADD CONSTRAINT "transcricao_reuniaoId_fkey" FOREIGN KEY ("reuniaoId") REFERENCES "reuniao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumo" ADD CONSTRAINT "resumo_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumo" ADD CONSTRAINT "resumo_reuniaoId_fkey" FOREIGN KEY ("reuniaoId") REFERENCES "reuniao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_reuniaoId_fkey" FOREIGN KEY ("reuniaoId") REFERENCES "reuniao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota" ADD CONSTRAINT "nota_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota" ADD CONSTRAINT "nota_reuniaoId_fkey" FOREIGN KEY ("reuniaoId") REFERENCES "reuniao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marco" ADD CONSTRAINT "marco_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versao_entrega" ADD CONSTRAINT "versao_entrega_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "entrega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_academica" ADD CONSTRAINT "producao_academica_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bem_estar" ADD CONSTRAINT "bem_estar_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracao_alerta" ADD CONSTRAINT "configuracao_alerta_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conexao_google" ADD CONSTRAINT "conexao_google_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

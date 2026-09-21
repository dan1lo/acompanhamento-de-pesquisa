-- DropForeignKey
ALTER TABLE "aceite_ciencia" DROP CONSTRAINT "aceite_ciencia_alunoId_fkey";

-- DropForeignKey
ALTER TABLE "alerta" DROP CONSTRAINT "alerta_alunoId_fkey";

-- DropForeignKey
ALTER TABLE "bem_estar" DROP CONSTRAINT "bem_estar_alunoId_fkey";

-- DropForeignKey
ALTER TABLE "checkin" DROP CONSTRAINT "checkin_reuniaoId_fkey";

-- DropForeignKey
ALTER TABLE "convite" DROP CONSTRAINT "convite_alunoId_fkey";

-- DropForeignKey
ALTER TABLE "coorientacao" DROP CONSTRAINT "coorientacao_alunoId_fkey";

-- DropForeignKey
ALTER TABLE "entrega" DROP CONSTRAINT "entrega_alunoId_fkey";

-- DropForeignKey
ALTER TABLE "horario_fixo" DROP CONSTRAINT "horario_fixo_alunoId_fkey";

-- DropForeignKey
ALTER TABLE "log_auditoria" DROP CONSTRAINT "log_auditoria_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "marco" DROP CONSTRAINT "marco_alunoId_fkey";

-- DropForeignKey
ALTER TABLE "nota" DROP CONSTRAINT "nota_alunoId_fkey";

-- DropForeignKey
ALTER TABLE "producao_academica" DROP CONSTRAINT "producao_academica_alunoId_fkey";

-- DropForeignKey
ALTER TABLE "resumo" DROP CONSTRAINT "resumo_reuniaoId_fkey";

-- DropForeignKey
ALTER TABLE "reuniao" DROP CONSTRAINT "reuniao_alunoId_fkey";

-- DropForeignKey
ALTER TABLE "tarefa" DROP CONSTRAINT "tarefa_alunoId_fkey";

-- DropForeignKey
ALTER TABLE "transcricao" DROP CONSTRAINT "transcricao_reuniaoId_fkey";

-- DropForeignKey
ALTER TABLE "versao_entrega" DROP CONSTRAINT "versao_entrega_entregaId_fkey";

-- AddForeignKey
ALTER TABLE "convite" ADD CONSTRAINT "convite_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aceite_ciencia" ADD CONSTRAINT "aceite_ciencia_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coorientacao" ADD CONSTRAINT "coorientacao_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horario_fixo" ADD CONSTRAINT "horario_fixo_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reuniao" ADD CONSTRAINT "reuniao_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkin" ADD CONSTRAINT "checkin_reuniaoId_fkey" FOREIGN KEY ("reuniaoId") REFERENCES "reuniao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcricao" ADD CONSTRAINT "transcricao_reuniaoId_fkey" FOREIGN KEY ("reuniaoId") REFERENCES "reuniao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumo" ADD CONSTRAINT "resumo_reuniaoId_fkey" FOREIGN KEY ("reuniaoId") REFERENCES "reuniao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota" ADD CONSTRAINT "nota_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marco" ADD CONSTRAINT "marco_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versao_entrega" ADD CONSTRAINT "versao_entrega_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_academica" ADD CONSTRAINT "producao_academica_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bem_estar" ADD CONSTRAINT "bem_estar_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;


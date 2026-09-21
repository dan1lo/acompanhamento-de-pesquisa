"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAluno, requireProfessor } from "@/lib/guards";
import { registrarAuditoria } from "@/lib/auditoria";

export async function solicitarExportacaoDados() {
  const { usuario, aluno } = await requireAluno();

  await prisma.aluno.update({
    where: { id: aluno.id },
    data: { exportacaoSolicitadaEm: new Date() },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "SOLICITAR_EXPORTACAO_DADOS",
    entidade: "Aluno",
    entidadeId: aluno.id,
  });

  revalidatePath("/privacidade");
}

export async function montarExportacaoDados(alunoId: string) {
  const dados = await prisma.aluno.findUnique({
    where: { id: alunoId },
    include: {
      reunioes: { include: { resumo: true, checkin: true, tarefas: true } },
      notas: { where: { tipo: "COMPARTILHADA" } },
      marcos: true,
      entregas: { include: { versoes: true } },
      producoes: true,
      bemEstar: true,
      aceiteCiencia: true,
    },
  });
  return dados;
}

export async function solicitarExclusaoDados(formData: FormData) {
  const { usuario, aluno } = await requireAluno();
  void formData;

  await prisma.aluno.update({
    where: { id: aluno.id },
    data: { exclusaoSolicitadaEm: new Date() },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "SOLICITAR_EXCLUSAO_DADOS",
    entidade: "Aluno",
    entidadeId: aluno.id,
  });

  revalidatePath("/privacidade");
}

export async function confirmarExclusaoDados(alunoId: string) {
  const professor = await requireProfessor();

  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno || aluno.orientadorId !== professor.id) throw new Error("Aluno não encontrado");
  if (!aluno.exclusaoSolicitadaEm) throw new Error("Não há solicitação de exclusão pendente para este aluno");

  await registrarAuditoria({
    usuarioId: professor.id,
    acao: "EXECUTAR_EXCLUSAO_DADOS",
    entidade: "Aluno",
    entidadeId: alunoId,
    detalhes: `Exclusão solicitada em ${aluno.exclusaoSolicitadaEm.toISOString()}`,
  });

  await prisma.$transaction(async (tx) => {
    await tx.aluno.delete({ where: { id: alunoId } });
    if (aluno.usuarioId) {
      await tx.usuario.delete({ where: { id: aluno.usuarioId } });
    }
  });

  revalidatePath("/painel");
}

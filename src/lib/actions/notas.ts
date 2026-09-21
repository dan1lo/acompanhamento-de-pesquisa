"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProfessor } from "@/lib/guards";

const CriarNotaSchema = z.object({
  conteudo: z.string().min(1, "Escreva algo antes de salvar"),
  tipo: z.enum(["PRIVADA", "COMPARTILHADA"]),
});

export async function criarNota(alunoId: string, reuniaoId: string | null, formData: FormData) {
  const professor = await requireProfessor();

  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno || aluno.orientadorId !== professor.id) throw new Error("Aluno não encontrado");

  const dados = CriarNotaSchema.parse({
    conteudo: formData.get("conteudo"),
    tipo: formData.get("tipo"),
  });

  await prisma.nota.create({
    data: {
      alunoId,
      reuniaoId: reuniaoId ?? undefined,
      conteudo: dados.conteudo,
      tipo: dados.tipo,
    },
  });

  revalidatePath(`/alunos/${alunoId}`);
  if (reuniaoId) revalidatePath(`/reunioes/${reuniaoId}`);
}

export async function atualizarStatusManual(alunoId: string, status: "OK" | "ATENCAO" | "CRITICO" | "AUTOMATICO") {
  const professor = await requireProfessor();

  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno || aluno.orientadorId !== professor.id) throw new Error("Aluno não encontrado");

  await prisma.aluno.update({
    where: { id: alunoId },
    data: { statusManual: status === "AUTOMATICO" ? null : status },
  });

  revalidatePath("/painel");
  revalidatePath(`/alunos/${alunoId}`);
}

export async function arquivarAluno(alunoId: string) {
  const professor = await requireProfessor();
  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno || aluno.orientadorId !== professor.id) throw new Error("Aluno não encontrado");

  await prisma.aluno.update({ where: { id: alunoId }, data: { arquivado: true } });
  revalidatePath("/painel");
  revalidatePath(`/alunos/${alunoId}`);
}

export async function reativarAluno(alunoId: string) {
  const professor = await requireProfessor();
  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno || aluno.orientadorId !== professor.id) throw new Error("Aluno não encontrado");

  await prisma.aluno.update({ where: { id: alunoId }, data: { arquivado: false } });
  revalidatePath("/painel");
  revalidatePath(`/alunos/${alunoId}`);
}

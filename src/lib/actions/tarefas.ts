"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAluno, requireProfessor } from "@/lib/guards";
import { parseDataLocal } from "@/lib/datas";

const CriarTarefaSchema = z.object({
  titulo: z.string().min(1, "Informe o título da tarefa"),
  responsavel: z.string().optional(),
  prazo: z.string().optional(),
});

export async function criarTarefa(alunoId: string, formData: FormData) {
  const professor = await requireProfessor();

  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno || aluno.orientadorId !== professor.id) throw new Error("Aluno não encontrado");

  const dados = CriarTarefaSchema.parse({
    titulo: formData.get("titulo"),
    responsavel: formData.get("responsavel") || undefined,
    prazo: formData.get("prazo") || undefined,
  });

  await prisma.tarefa.create({
    data: {
      alunoId,
      titulo: dados.titulo,
      responsavel: dados.responsavel,
      prazo: dados.prazo ? parseDataLocal(dados.prazo) : undefined,
    },
  });

  revalidatePath(`/alunos/${alunoId}`);
}

export async function concluirTarefa(tarefaId: string) {
  const session = await requireQualquerPapelParaTarefa(tarefaId);

  await prisma.tarefa.update({
    where: { id: tarefaId },
    data: { status: "CONCLUIDA", concluidaEm: new Date() },
  });

  revalidatePath("/inicio");
  revalidatePath("/tarefas");
  revalidatePath(`/alunos/${session.alunoId}`);
}

export async function reabrirTarefa(tarefaId: string) {
  const professor = await requireProfessor();

  const tarefa = await prisma.tarefa.findUnique({ where: { id: tarefaId }, include: { aluno: true } });
  if (!tarefa || tarefa.aluno.orientadorId !== professor.id) throw new Error("Tarefa não encontrada");

  await prisma.tarefa.update({ where: { id: tarefaId }, data: { status: "ABERTA", concluidaEm: null } });
  revalidatePath(`/alunos/${tarefa.alunoId}`);
}

async function requireQualquerPapelParaTarefa(tarefaId: string) {
  const tarefa = await prisma.tarefa.findUnique({ where: { id: tarefaId }, include: { aluno: true } });
  if (!tarefa) throw new Error("Tarefa não encontrada");

  // Tanto o professor quanto o próprio aluno podem marcar como concluída.
  try {
    const professor = await requireProfessor();
    if (tarefa.aluno.orientadorId === professor.id) return tarefa;
  } catch {
    // não é professor, tenta como aluno
  }

  const { aluno } = await requireAluno();
  if (tarefa.alunoId !== aluno.id) throw new Error("Sem permissão para esta tarefa");
  return tarefa;
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAluno, requireProfessor } from "@/lib/guards";

const CriarEntregaSchema = z.object({
  titulo: z.string().min(1, "Informe o título da entrega"),
  link: z.string().optional(),
});

export async function criarEntrega(formData: FormData) {
  const { aluno } = await requireAluno();

  const dados = CriarEntregaSchema.parse({
    titulo: formData.get("titulo"),
    link: formData.get("link") || undefined,
  });

  await prisma.entrega.create({
    data: {
      alunoId: aluno.id,
      titulo: dados.titulo,
      versoes: dados.link ? { create: [{ link: dados.link }] } : undefined,
    },
  });

  revalidatePath("/entregas");
  revalidatePath(`/alunos/${aluno.id}`);
}

const NovaVersaoSchema = z.object({
  link: z.string().min(1, "Informe o link ou referência da versão"),
});

export async function adicionarVersaoEntrega(entregaId: string, formData: FormData) {
  const { aluno } = await requireAluno();

  const entrega = await prisma.entrega.findUnique({ where: { id: entregaId } });
  if (!entrega || entrega.alunoId !== aluno.id) throw new Error("Entrega não encontrada");

  const dados = NovaVersaoSchema.parse({ link: formData.get("link") });

  await prisma.versaoEntrega.create({
    data: { entregaId, link: dados.link },
  });

  revalidatePath("/entregas");
  revalidatePath(`/alunos/${aluno.id}`);
}

const FeedbackSchema = z.object({
  feedback: z.string().min(1, "Escreva o feedback"),
});

export async function darFeedbackVersao(versaoId: string, formData: FormData) {
  const professor = await requireProfessor();

  const versao = await prisma.versaoEntrega.findUnique({
    where: { id: versaoId },
    include: { entrega: { include: { aluno: true } } },
  });
  if (!versao || versao.entrega.aluno.orientadorId !== professor.id) {
    throw new Error("Versão não encontrada");
  }

  const dados = FeedbackSchema.parse({ feedback: formData.get("feedback") });

  await prisma.versaoEntrega.update({
    where: { id: versaoId },
    data: { feedback: dados.feedback },
  });

  revalidatePath(`/alunos/${versao.entrega.alunoId}`);
}

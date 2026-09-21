"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAluno, requireProfessor } from "@/lib/guards";
import { parseDataLocal } from "@/lib/datas";

const CriarProducaoSchema = z.object({
  titulo: z.string().min(1, "Informe o título"),
  venue: z.string().optional(),
  prazoSubmissao: z.string().optional(),
});

export async function criarProducaoAcademica(formData: FormData) {
  const { aluno } = await requireAluno();

  const dados = CriarProducaoSchema.parse({
    titulo: formData.get("titulo"),
    venue: formData.get("venue") || undefined,
    prazoSubmissao: formData.get("prazoSubmissao") || undefined,
  });

  await prisma.producaoAcademica.create({
    data: {
      alunoId: aluno.id,
      titulo: dados.titulo,
      venue: dados.venue,
      prazoSubmissao: dados.prazoSubmissao ? parseDataLocal(dados.prazoSubmissao) : undefined,
    },
  });

  revalidatePath("/producao");
  revalidatePath(`/alunos/${aluno.id}`);
}

const STATUS_VALIDOS = ["EM_ESCRITA", "SUBMETIDO", "EM_REVISAO", "ACEITO", "PUBLICADO"] as const;

export async function atualizarStatusProducao(producaoId: string, status: (typeof STATUS_VALIDOS)[number]) {
  const professor = await requireProfessor();

  const producao = await prisma.producaoAcademica.findUnique({
    where: { id: producaoId },
    include: { aluno: true },
  });
  if (!producao || producao.aluno.orientadorId !== professor.id) throw new Error("Produção não encontrada");
  if (!STATUS_VALIDOS.includes(status)) throw new Error("Status inválido");

  await prisma.producaoAcademica.update({ where: { id: producaoId }, data: { status } });
  revalidatePath(`/alunos/${producao.alunoId}`);
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProfessor } from "@/lib/guards";
import { parseDataLocal } from "@/lib/datas";

const CriarMarcoSchema = z.object({
  titulo: z.string().min(1, "Informe o nome do marco"),
  dataPrevista: z.string().min(1, "Informe a data prevista"),
});

export async function criarMarco(alunoId: string, formData: FormData) {
  const professor = await requireProfessor();
  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno || aluno.orientadorId !== professor.id) throw new Error("Aluno não encontrado");

  const dados = CriarMarcoSchema.parse({
    titulo: formData.get("titulo"),
    dataPrevista: formData.get("dataPrevista"),
  });

  await prisma.marco.create({
    data: {
      alunoId,
      titulo: dados.titulo,
      dataPrevista: parseDataLocal(dados.dataPrevista),
    },
  });

  revalidatePath(`/alunos/${alunoId}`);
}

export async function concluirMarco(marcoId: string) {
  const professor = await requireProfessor();
  const marco = await prisma.marco.findUnique({ where: { id: marcoId }, include: { aluno: true } });
  if (!marco || marco.aluno.orientadorId !== professor.id) throw new Error("Marco não encontrado");

  await prisma.marco.update({
    where: { id: marcoId },
    data: { concluido: true, dataConcluida: new Date() },
  });

  revalidatePath(`/alunos/${marco.alunoId}`);
}

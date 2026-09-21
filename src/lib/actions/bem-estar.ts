"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAluno } from "@/lib/guards";

const NivelSchema = z.object({
  nivel: z.coerce.number().int().min(1).max(5),
});

export async function registrarBemEstar(formData: FormData) {
  const { aluno } = await requireAluno();
  if (!aluno.bemEstarAtivo) throw new Error("O termômetro de bem-estar está desativado para sua conta");

  const dados = NivelSchema.parse({ nivel: formData.get("nivel") });

  await prisma.bemEstar.create({
    data: { alunoId: aluno.id, nivel: dados.nivel },
  });

  revalidatePath("/inicio");
  revalidatePath(`/alunos/${aluno.id}`);
}

export async function alternarBemEstarAtivo(ativar: boolean) {
  const { aluno } = await requireAluno();

  await prisma.aluno.update({ where: { id: aluno.id }, data: { bemEstarAtivo: ativar } });

  revalidatePath("/inicio");
}

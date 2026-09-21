"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProfessor } from "@/lib/guards";
import { parseDataHoraRecife } from "@/lib/datas";

const CriarHorarioSchema = z.object({
  inicio: z.string().min(1, "Informe o início"),
  fim: z.string().min(1, "Informe o fim"),
});

export async function criarHorarioLivre(formData: FormData) {
  const professor = await requireProfessor();

  const dados = CriarHorarioSchema.parse({
    inicio: formData.get("inicio"),
    fim: formData.get("fim"),
  });

  const inicio = parseDataHoraRecife(dados.inicio);
  const fim = parseDataHoraRecife(dados.fim);

  if (fim <= inicio) throw new Error("O horário de fim deve ser depois do início");

  await prisma.horarioLivre.create({
    data: {
      professorId: professor.id,
      inicio,
      fim,
    },
  });

  revalidatePath("/horarios");
}

export async function removerHorarioLivre(horarioId: string) {
  const professor = await requireProfessor();

  const horario = await prisma.horarioLivre.findUnique({ where: { id: horarioId } });
  if (!horario || horario.professorId !== professor.id) {
    throw new Error("Horário não encontrado");
  }
  if (horario.reservado) {
    throw new Error("Não é possível remover um horário já reservado — cancele a reunião primeiro");
  }

  await prisma.horarioLivre.delete({ where: { id: horarioId } });
  revalidatePath("/horarios");
}

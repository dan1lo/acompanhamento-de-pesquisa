"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProfessor } from "@/lib/guards";

const ConfigSchema = z.object({
  nivel: z.enum(["TCC", "MESTRADO", "DOUTORADO"]),
  diasAtencao: z.coerce.number().int().min(1),
  diasCritico: z.coerce.number().int().min(1),
});

export async function salvarConfiguracaoAlerta(formData: FormData) {
  const professor = await requireProfessor();

  const dados = ConfigSchema.parse({
    nivel: formData.get("nivel"),
    diasAtencao: formData.get("diasAtencao"),
    diasCritico: formData.get("diasCritico"),
  });

  if (dados.diasCritico <= dados.diasAtencao) {
    throw new Error("O limite crítico deve ser maior que o limite de atenção");
  }

  await prisma.configuracaoAlerta.upsert({
    where: { professorId_nivel: { professorId: professor.id, nivel: dados.nivel } },
    create: { professorId: professor.id, ...dados },
    update: { diasAtencao: dados.diasAtencao, diasCritico: dados.diasCritico },
  });

  revalidatePath("/configuracoes/alertas");
}

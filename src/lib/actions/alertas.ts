"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProfessor } from "@/lib/guards";
import { gerarAlertas } from "@/lib/jobs/alertas";

export async function gerarAlertasAgora() {
  await requireProfessor();
  await gerarAlertas();
  revalidatePath("/alertas");
}

export async function resolverAlerta(alertaId: string) {
  const professor = await requireProfessor();

  const alerta = await prisma.alerta.findUnique({ where: { id: alertaId }, include: { aluno: true } });
  if (!alerta || alerta.aluno.orientadorId !== professor.id) throw new Error("Alerta não encontrado");

  await prisma.alerta.update({ where: { id: alertaId }, data: { resolvido: true } });
  revalidatePath("/alertas");
}

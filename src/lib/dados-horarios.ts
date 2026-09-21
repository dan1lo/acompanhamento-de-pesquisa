import { prisma } from "@/lib/prisma";

export async function listarHorariosDisponiveis(professorId: string) {
  const antecedenciaMinima = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return prisma.horarioLivre.findMany({
    where: {
      professorId,
      reservado: false,
      inicio: { gte: antecedenciaMinima },
    },
    orderBy: { inicio: "asc" },
  });
}

export async function listarProximosHorarios(professorId: string) {
  const agora = new Date();

  return prisma.horarioLivre.findMany({
    where: { professorId, inicio: { gte: agora } },
    orderBy: { inicio: "asc" },
    include: { reuniao: { include: { aluno: true } } },
  });
}

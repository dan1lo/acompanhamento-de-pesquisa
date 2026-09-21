import { prisma } from "@/lib/prisma";

export type EventoLinhaDoTempo = {
  data: Date;
  tipo: "reuniao" | "tarefa_concluida" | "marco" | "entrega";
  titulo: string;
  link?: string;
};

/** RF28 — reuniões, resumos publicados, tarefas concluídas, marcos e entregas em ordem cronológica. */
export async function montarLinhaDoTempo(alunoId: string): Promise<EventoLinhaDoTempo[]> {
  const [reunioes, tarefasConcluidas, marcos, entregas] = await Promise.all([
    prisma.reuniao.findMany({
      where: { alunoId, status: { in: ["REALIZADA", "FALTA"] } },
      include: { resumo: true },
    }),
    prisma.tarefa.findMany({ where: { alunoId, status: "CONCLUIDA", concluidaEm: { not: null } } }),
    prisma.marco.findMany({ where: { alunoId, concluido: true, dataConcluida: { not: null } } }),
    prisma.entrega.findMany({ where: { alunoId } }),
  ]);

  const eventos: EventoLinhaDoTempo[] = [];

  for (const r of reunioes) {
    eventos.push({
      data: r.data,
      tipo: "reuniao",
      titulo:
        r.status === "FALTA"
          ? "Falta sem aviso"
          : r.resumo?.status === "PUBLICADO"
            ? "Reunião — resumo publicado"
            : "Reunião realizada",
      link: `/reunioes/${r.id}`,
    });
  }

  for (const t of tarefasConcluidas) {
    if (t.concluidaEm) eventos.push({ data: t.concluidaEm, tipo: "tarefa_concluida", titulo: `Tarefa concluída: ${t.titulo}` });
  }

  for (const m of marcos) {
    if (m.dataConcluida) eventos.push({ data: m.dataConcluida, tipo: "marco", titulo: `Marco concluído: ${m.titulo}` });
  }

  for (const e of entregas) {
    eventos.push({ data: e.criadoEm, tipo: "entrega", titulo: `Entrega registrada: ${e.titulo}` });
  }

  return eventos.sort((a, b) => b.data.getTime() - a.data.getTime());
}

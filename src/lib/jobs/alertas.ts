import { prisma } from "@/lib/prisma";
import { diasDesdeUltimaReuniao, LIMITES_PADRAO, statusAutomatico } from "@/lib/status";
import { garantirAlertasAluno } from "@/lib/dados-alertas";
import { alunoTemOrientador } from "@/lib/guards";

const JANELA_DEDUP_HORAS = 20;
const DIAS_PRAZO_PROXIMO = 7;

async function jaAlertadoRecentemente(alunoId: string, tipo: string): Promise<boolean> {
  const desde = new Date(Date.now() - JANELA_DEDUP_HORAS * 60 * 60 * 1000);
  const existente = await prisma.alerta.findFirst({
    where: { alunoId, tipo: tipo as never, resolvido: false, criadoEm: { gte: desde } },
  });
  return Boolean(existente);
}

/** Gera alertas de acompanhamento (RF30). Idempotente o suficiente para rodar em job diário. */
export async function gerarAlertas(): Promise<{ criados: number }> {
  let criados = 0;

  const alunos = await prisma.aluno.findMany({
    where: { arquivado: false },
    include: {
      reunioes: { where: { status: "REALIZADA" }, orderBy: { data: "desc" }, take: 1 },
      tarefas: { where: { status: "ABERTA" } },
      orientador: { include: { configAlertas: true } },
    },
  });

  const agora = new Date();
  const emBreve = new Date(agora.getTime() + DIAS_PRAZO_PROXIMO * 24 * 60 * 60 * 1000);

  for (const aluno of alunos) {
    if (!alunoTemOrientador(aluno.orientador?.email)) {
      continue;
    }

    // Garante os alertas de reunião (1 semana, 15 dias, 1 mês) e de produções acadêmicas
    await garantirAlertasAluno(aluno.id, aluno.nome);

    for (const tarefa of aluno.tarefas) {
      if (tarefa.prazo && tarefa.prazo < agora) {
        if (!(await jaAlertadoRecentemente(aluno.id, "TAREFA_ATRASADA"))) {
          await prisma.alerta.create({
            data: {
              alunoId: aluno.id,
              tipo: "TAREFA_ATRASADA",
              mensagem: `Tarefa atrasada: "${tarefa.titulo}"`,
            },
          });
          criados++;
        }
      } else if (tarefa.prazo && tarefa.prazo <= emBreve) {
        if (!(await jaAlertadoRecentemente(aluno.id, "PRAZO_PROXIMO"))) {
          await prisma.alerta.create({
            data: {
              alunoId: aluno.id,
              tipo: "PRAZO_PROXIMO",
              mensagem: `Prazo se aproximando: "${tarefa.titulo}"`,
            },
          });
          criados++;
        }
      }
    }

    const marcosProximos = await prisma.marco.findMany({
      where: { alunoId: aluno.id, concluido: false, dataPrevista: { lte: emBreve, gte: agora } },
    });
    if (marcosProximos.length > 0 && !(await jaAlertadoRecentemente(aluno.id, "PRAZO_PROXIMO"))) {
      await prisma.alerta.create({
        data: {
          alunoId: aluno.id,
          tipo: "PRAZO_PROXIMO",
          mensagem: `Marco se aproximando: "${marcosProximos[0].titulo}"`,
        },
      });
      criados++;
    }

    const reuniaoProxima24h = await prisma.reuniao.findFirst({
      where: {
        alunoId: aluno.id,
        status: "AGENDADA",
        data: { gte: agora, lte: new Date(agora.getTime() + 24 * 60 * 60 * 1000) },
      },
      include: { checkin: true },
    });
    if (
      reuniaoProxima24h &&
      !reuniaoProxima24h.checkin?.preenchidoEm &&
      !(await jaAlertadoRecentemente(aluno.id, "CHECKIN_NAO_PREENCHIDO"))
    ) {
      await prisma.alerta.create({
        data: {
          alunoId: aluno.id,
          tipo: "CHECKIN_NAO_PREENCHIDO",
          mensagem: "Check-in não preenchido para a reunião de amanhã",
        },
      });
      criados++;
    }
  }

  return { criados };
}

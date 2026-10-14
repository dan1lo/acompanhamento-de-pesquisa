import { prisma } from "@/lib/prisma";
import { diasDesdeUltimaReuniao } from "@/lib/status";

export interface NotificacaoItem {
  id: string;
  tipo: string;
  mensagem: string;
  alunoId: string;
  alunoNome: string;
  criadoEm: string;
  resolvido: boolean;
}

/**
 * Verifica se algum orientando completou 7 ou mais dias sem reunião.
 * Se sim, cria automaticamente o alerta: "[Aluno] está há 1 semana sem marcar reunião."
 * Retorna os alertas ativos formatados para exibição no popup e na topbar.
 */
export async function verificarEObterAlertasProfessor(professorId: string): Promise<NotificacaoItem[]> {
  try {
    // 1. Busca todos os alunos ativos do orientador com a última reunião realizada
    const alunos = await prisma.aluno.findMany({
      where: { orientadorId: professorId, arquivado: false },
      include: {
        reunioes: {
          where: { status: "REALIZADA" },
          orderBy: { data: "desc" },
          take: 1,
        },
      },
    });

    // 2. Para cada aluno, calcula os dias sem reunião
    for (const aluno of alunos) {
      const ultimaReuniao = aluno.reunioes[0]?.data ?? null;
      const dias = diasDesdeUltimaReuniao(ultimaReuniao, aluno.dataInicio);

      // Quando o aluno chega a 7 dias ou mais sem reunião
      if (dias >= 7) {
        const mensagemAlerta = `${aluno.nome} está há 1 semana sem marcar reunião.`;

        // Verifica se já existe um alerta ativo (não resolvido) com esta mensagem para este aluno
        const alertaExistente = await prisma.alerta.findFirst({
          where: {
            alunoId: aluno.id,
            tipo: "DIAS_SEM_REUNIAO",
            resolvido: false,
          },
        });

        if (!alertaExistente) {
          await prisma.alerta.create({
            data: {
              alunoId: aluno.id,
              tipo: "DIAS_SEM_REUNIAO",
              mensagem: mensagemAlerta,
            },
          });
        }
      }
    }

    // 3. Retorna os alertas ativos do orientador
    const alertas = await prisma.alerta.findMany({
      where: {
        resolvido: false,
        aluno: { orientadorId: professorId },
      },
      include: {
        aluno: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: "desc" },
      take: 10,
    });

    return alertas.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      mensagem: a.mensagem,
      alunoId: a.alunoId,
      alunoNome: a.aluno.nome,
      criadoEm: a.criadoEm.toISOString(),
      resolvido: a.resolvido,
    }));
  } catch (error) {
    console.error("Erro ao verificar/obter alertas do professor:", error);
    return [];
  }
}


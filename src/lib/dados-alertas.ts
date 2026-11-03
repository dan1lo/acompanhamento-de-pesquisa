import { prisma } from "@/lib/prisma";
import { diasDesdeUltimaReuniao } from "@/lib/status";
import { alunoTemOrientador } from "@/lib/guards";

export interface NotificacaoItem {
  id: string;
  tipo: string;
  mensagem: string;
  alunoId: string;
  alunoNome: string;
  criadoEm: string;
  resolvido: boolean;
  link?: string;
  linkRotulo?: string;
  conviteReuniaoId?: string;
}

export interface ConviteReuniaoRow {
  id: string;
  remetenteId: string;
  remetenteNome: string;
  remetentePapel: string;
  destinatarioUsuarioId: string | null;
  alunoId: string;
  alunoNome: string;
  alunoEmail: string;
  orientadorId: string;
  orientadorNome: string;
  orientadorEmail: string;
  data: Date;
  dataStr: string;
  horarioStr: string;
  pauta: string | null;
  incluirMeet: boolean;
  meetLink: string | null;
  sincronizarGoogle: boolean;
  status: string;
  justificativaRecusa: string | null;
  reuniaoId: string | null;
  lidaPeloDestinatario: boolean;
  lidaPeloRemetente: boolean;
  atualizadoEm: Date;
  criadoEm: Date;
}

let tabelaConviteReuniaoGarantida = false;

export async function garantirTabelaConviteReuniao() {
  if (tabelaConviteReuniaoGarantida) return;
  try {
    const check = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'convite_reuniao'
      ) AS "exists";
    `);
    if (check && check[0]?.exists) {
      tabelaConviteReuniaoGarantida = true;
      return;
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS convite_reuniao (
        id TEXT PRIMARY KEY,
        "remetenteId" TEXT NOT NULL,
        "remetenteNome" TEXT NOT NULL,
        "remetentePapel" TEXT NOT NULL,
        "destinatarioUsuarioId" TEXT,
        "alunoId" TEXT NOT NULL,
        "alunoNome" TEXT NOT NULL,
        "alunoEmail" TEXT NOT NULL,
        "orientadorId" TEXT NOT NULL,
        "orientadorNome" TEXT NOT NULL,
        "orientadorEmail" TEXT NOT NULL,
        "data" TIMESTAMP NOT NULL,
        "dataStr" TEXT NOT NULL,
        "horarioStr" TEXT NOT NULL,
        "pauta" TEXT,
        "incluirMeet" BOOLEAN DEFAULT false,
        "meetLink" TEXT,
        "sincronizarGoogle" BOOLEAN DEFAULT true,
        "status" TEXT NOT NULL DEFAULT 'PENDENTE',
        "justificativaRecusa" TEXT,
        "reuniaoId" TEXT,
        "lidaPeloDestinatario" BOOLEAN DEFAULT false,
        "lidaPeloRemetente" BOOLEAN DEFAULT true,
        "atualizadoEm" TIMESTAMP DEFAULT NOW(),
        "criadoEm" TIMESTAMP DEFAULT NOW()
      );
    `);
    tabelaConviteReuniaoGarantida = true;
  } catch (err: any) {
    if (
      err?.code === "23505" ||
      err?.code === "42P07" ||
      String(err?.message || "").includes("já existe")
    ) {
      tabelaConviteReuniaoGarantida = true;
      return;
    }
  }
}

const alunosSendoVerificados = new Set<string>();

/**
 * Converte mensagens de alerta com metadados para a visão do Orientador.
 */
export function formatarMensagemAlertaParaProfessor(mensagem: string): string {
  const base = mensagem.includes("|||") ? mensagem.split("|||")[0].trim() : mensagem;
  return base.replace(/\s*\(com sala no Google Meet\)/gi, "");
}

/**
 * Converte mensagens de alerta para a visão do Aluno (2ª pessoa).
 */
export function formatarMensagemAlertaParaAluno(
  mensagem: string,
  nomeAluno?: string,
  tipo?: string
): string {
  const msg = mensagem.trim().replace(/\s*\(com sala no Google Meet\)/gi, "");

  // Alertas codificados com metadados |||
  if (msg.includes("|||")) {
    const parts = msg.split("|||").map((s) => s.trim());
    const msgBase = parts[0];
    const titulo = parts[1] || "Atividade";
    const stage = parts[3] || "";

    // 1. Inatividade em Atividades da Pesquisa
    if (
      stage === "INATIVIDADE_ATIVIDADES" ||
      parts[2] === "INATIVIDADE_ATIVIDADES" ||
      msg.includes("INATIVIDADE_ATIVIDADES")
    ) {
      const periodo =
        parts[4] ||
        (msgBase.includes("1 mês")
          ? "1 mês"
          : msgBase.includes("15 dias")
          ? "15 dias"
          : "1 semana");
      return `Você está há ${periodo} sem avançar em nenhuma atividade da pesquisa.`;
    }

    // 2. Alertas de Prazos do Quadro de Atividades
    if (stage === "ATIVIDADE_ATRASADA" || stage === "MARCO_ATRASADO") {
      return `Você perdeu o prazo da atividade '${titulo}'.`;
    }
    if (stage === "ATIVIDADE_HOJE") {
      return `Atenção: O prazo da atividade '${titulo}' vence hoje!`;
    }
    if (stage === "ATIVIDADE_AMANHA" || stage === "MARCO_AMANHA") {
      return `O prazo da atividade '${titulo}' vence amanhã!`;
    }
    if (stage === "ATIVIDADE_SEMANA" || stage === "MARCO_SEMANA") {
      return `O prazo da atividade '${titulo}' está próximo (em uma semana).`;
    }
    if (stage === "ATIVIDADE_NAO_INICIADA") {
      return `Você ainda não iniciou a atividade '${titulo}', que vence em breve. Comece o quanto antes!`;
    }
    if (stage === "SUBTAREFA_ATRASADA") {
      return `Você possui uma subtarefa atrasada na atividade '${titulo}'.`;
    }
    if (stage === "SEM_ATIVIDADES_PLANEJADAS") {
      return "Você ainda não planejou suas atividades no Quadro de Atividades.";
    }
    if (stage === "ATIVIDADE_CONCLUIDA") {
      return `Você concluiu a atividade '${titulo}'.`;
    }

    // 3. Alertas de Produção Acadêmica
    if (msgBase.includes("entregar em uma semana")) {
      return `O prazo de entrega para '${titulo}' está próximo!`;
    }
    if (msgBase.includes("entregar amanhã")) {
      return `O prazo de entrega para '${titulo}' é amanhã!`;
    }
    if (msgBase.includes("trabalho atrasado")) {
      return `Você perdeu o prazo de entrega para '${titulo}'.`;
    }

    return msgBase;
  }

  // Alertas de Inatividade sem metadados
  if (msg.includes("sem avançar em nenhuma atividade")) {
    const matchPeriodo = msg.match(/(1 semana|15 dias|1 mês)/i);
    const per = matchPeriodo ? matchPeriodo[1] : "algum tempo";
    return `Você está há ${per} sem avançar em nenhuma atividade da pesquisa.`;
  }

  // Alertas de Reunião
  if (msg.includes("1 semana sem marcar reunião")) {
    return "Você está há 1 semana sem marcar reunião.";
  }
  if (msg.includes("15 dias sem marcar reunião")) {
    return "Você está há 15 dias sem marcar reunião.";
  }
  if (msg.includes("1 mês sem marcar reunião") || msg.includes("1 mes sem marcar reunião")) {
    return "Você está há 1 mês sem marcar reunião.";
  }

  if (nomeAluno) {
    const prefixo = `${nomeAluno.trim()} está `;
    if (msg.toLowerCase().startsWith(prefixo.toLowerCase())) {
      return `Você está ${msg.slice(prefixo.length)}`;
    }
  }

  const matchEstaHa = msg.match(/^.+?\s+está\s+há\s+(.+)$/i);
  if (matchEstaHa) {
    return `Você está há ${matchEstaHa[1]}`;
  }

  if (tipo === "DIAS_SEM_REUNIAO" || /^\d+\s+dias sem reunião/i.test(msg)) {
    const matchDias = msg.match(/^(\d+)\s+dias sem reunião/i);
    if (matchDias) {
      const dias = Number(matchDias[1]);
      if (dias >= 30) {
        return "Você está há 1 mês sem marcar reunião.";
      }
      if (dias >= 15) {
        return "Você está há 15 dias sem marcar reunião.";
      }
      if (dias >= 7) {
        return "Você está há 1 semana sem marcar reunião.";
      }
      return `Você está há ${dias} dias sem marcar reunião.`;
    }
  }

  return msg;
}

/**
 * Garante que os alertas de reunião e produção do orientando sejam gerados
 * de forma idempotente, sem duplicatas e respeitando ciclos e resoluções.
 */
export async function garantirAlertasAluno(alunoId: string, alunoNome: string) {
  if (alunosSendoVerificados.has(alunoId)) {
    return;
  }

  alunosSendoVerificados.add(alunoId);

  try {
    const aluno = await prisma.aluno.findUnique({
      where: { id: alunoId },
      include: {
        orientador: {
          select: { email: true },
        },
        reunioes: {
          where: { status: "REALIZADA" },
          orderBy: { data: "desc" },
          take: 1,
        },
        producoes: true,
      },
    });

    if (!aluno || aluno.arquivado || !alunoTemOrientador(aluno.orientador?.email)) {
      return;
    }

    const agora = new Date();

    // 1. ALERTAS DE REUNIÃO (7 dias, 15 dias, 1 mês)
    const ultimaReuniao = aluno.reunioes[0]?.data ?? null;
    const diasSemReuniao = diasDesdeUltimaReuniao(ultimaReuniao, aluno.dataInicio);

    let meetingStage: "1 semana" | "15 dias" | "1 mês" | null = null;
    if (diasSemReuniao >= 30) {
      meetingStage = "1 mês";
    } else if (diasSemReuniao >= 15) {
      meetingStage = "15 dias";
    } else if (diasSemReuniao >= 7) {
      meetingStage = "1 semana";
    }

    if (meetingStage) {
      const alertaExistente = await prisma.alerta.findFirst({
        where: {
          alunoId: aluno.id,
          tipo: "DIAS_SEM_REUNIAO",
          mensagem: { contains: meetingStage },
        },
        orderBy: { criadoEm: "desc" },
      });

      const alertouNesteCiclo =
        alertaExistente &&
        (ultimaReuniao
          ? new Date(alertaExistente.criadoEm) >= new Date(ultimaReuniao)
          : true);

      if (!alertouNesteCiclo) {
        // Ao avançar de estágio (ex: de 1 semana para 15 dias), arquiva alertas anteriores pendentes
        await prisma.alerta.updateMany({
          where: {
            alunoId: aluno.id,
            tipo: "DIAS_SEM_REUNIAO",
            resolvido: false,
          },
          data: { resolvido: true },
        });

        await prisma.alerta.create({
          data: {
            alunoId: aluno.id,
            tipo: "DIAS_SEM_REUNIAO",
            mensagem: `${aluno.nome} está há ${meetingStage} sem marcar reunião.`,
          },
        });
      }
    }

    // 2. ALERTAS DE PRODUÇÃO ACADÊMICA
    for (const producao of aluno.producoes) {
      if (!producao.prazoSubmissao) {
        continue;
      }

      // Se a produção já foi submetida ou aceita/publicada, arquiva eventuais alertas pendentes
      if (producao.status !== "EM_ESCRITA") {
        await prisma.alerta.updateMany({
          where: {
            alunoId: aluno.id,
            mensagem: { contains: producao.id },
            resolvido: false,
          },
          data: { resolvido: true },
        });
        continue;
      }

      const prazo = new Date(producao.prazoSubmissao);
      const diffMs = prazo.getTime() - agora.getTime();
      const diffDias = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

      let prodStage: "SEMANA" | "AMANHA" | "ATRASADO" | null = null;
      let msgBase = "";
      let tipoAlerta: "PRAZO_PROXIMO" | "TAREFA_ATRASADA" = "PRAZO_PROXIMO";

      if (diffMs < 0) {
        // Prazo passou
        prodStage = "ATRASADO";
        tipoAlerta = "TAREFA_ATRASADA";
        msgBase = `${aluno.nome} está com um trabalho atrasado.`;
      } else if (diffDias <= 1 && diffMs >= 0) {
        // Prazo amanhã / dia seguinte
        prodStage = "AMANHA";
        tipoAlerta = "PRAZO_PROXIMO";
        msgBase = `${aluno.nome} tem um trabalho para entregar amanhã.`;
      } else if (diffDias <= 7 && diffDias > 1) {
        // Prazo em uma semana
        prodStage = "SEMANA";
        tipoAlerta = "PRAZO_PROXIMO";
        msgBase = `${aluno.nome} tem um trabalho para entregar em uma semana.`;
      }

      if (prodStage) {
        const identificador = `${producao.id} ||| ${prodStage}`;
        const alertaExistente = await prisma.alerta.findFirst({
          where: {
            alunoId: aluno.id,
            mensagem: { contains: identificador },
          },
        });

        if (!alertaExistente) {
          // Arquiva alertas anteriores pendentes desta mesma produção ao avançar de estágio
          await prisma.alerta.updateMany({
            where: {
              alunoId: aluno.id,
              mensagem: { contains: producao.id },
              resolvido: false,
            },
            data: { resolvido: true },
          });

          const mensagemCompleta = `${msgBase} ||| ${producao.titulo} ||| ${producao.id} ||| ${prodStage}`;

          await prisma.alerta.create({
            data: {
              alunoId: aluno.id,
              tipo: tipoAlerta,
              mensagem: mensagemCompleta,
            },
          });
        }
      }
    }

    // 3. ALERTAS DO QUADRO DE ATIVIDADES E ROADMAP
    try {
      // 3.1 ALERTA DE INATIVIDADE (Aluno há muito tempo sem avançar em nenhuma atividade)
      const ultimosAvancos = await prisma.$queryRawUnsafe<Array<{ ult_data: Date | string | null }>>(
        `SELECT GREATEST(
           MAX("prazoRealizado"::timestamp),
           MAX(CASE WHEN porcentagem > 0 THEN "atualizadoEm" ELSE NULL END),
           MAX("criadoEm")
         ) as ult_data
         FROM marco_roadmap
         WHERE "alunoId" = $1;`,
        aluno.id
      );

      const ultimasSubtarefas = await prisma.$queryRawUnsafe<Array<{ ult_sub: Date | string | null }>>(
        `SELECT MAX("concluidaEm") as ult_sub
         FROM tarefa
         WHERE "alunoId" = $1 AND status = 'CONCLUIDA' AND "marcoId" IS NOT NULL;`,
        aluno.id
      );

      let dataReferenciaAvanco: Date | null = null;
      if (ultimosAvancos[0]?.ult_data) {
        dataReferenciaAvanco = new Date(ultimosAvancos[0].ult_data);
      }
      if (ultimasSubtarefas[0]?.ult_sub) {
        const dSub = new Date(ultimasSubtarefas[0].ult_sub);
        if (!dataReferenciaAvanco || dSub > dataReferenciaAvanco) {
          dataReferenciaAvanco = dSub;
        }
      }
      if (!dataReferenciaAvanco) {
        dataReferenciaAvanco = new Date(aluno.dataInicio);
      }

      const diffMsInat = agora.getTime() - dataReferenciaAvanco.getTime();
      const diasSemAvanco = Math.floor(diffMsInat / (1000 * 60 * 60 * 24));

      let inatividadeStage: "1 semana" | "15 dias" | "1 mês" | null = null;
      if (diasSemAvanco >= 30) {
        inatividadeStage = "1 mês";
      } else if (diasSemAvanco >= 15) {
        inatividadeStage = "15 dias";
      } else if (diasSemAvanco >= 7) {
        inatividadeStage = "1 semana";
      }

      if (inatividadeStage) {
        const identificadorInat = `INATIVIDADE_ATIVIDADES ||| ${inatividadeStage}`;
        const alertaExistente = await prisma.alerta.findFirst({
          where: {
            alunoId: aluno.id,
            mensagem: { contains: identificadorInat },
          },
          orderBy: { criadoEm: "desc" },
        });

        const alertouNesteCiclo =
          alertaExistente &&
          (dataReferenciaAvanco ? new Date(alertaExistente.criadoEm) >= dataReferenciaAvanco : true);

        if (!alertouNesteCiclo) {
          // Arquiva alertas de inatividade anteriores ao subir de estágio
          await prisma.alerta.updateMany({
            where: {
              alunoId: aluno.id,
              mensagem: { contains: "INATIVIDADE_ATIVIDADES" },
              resolvido: false,
            },
            data: { resolvido: true },
          });

          const msgBase = `${aluno.nome} está há ${inatividadeStage} sem avançar em nenhuma atividade da pesquisa.`;
          const mensagemCompleta = `${msgBase} ||| ${aluno.nome} ||| inatividade ||| INATIVIDADE_ATIVIDADES ||| ${inatividadeStage}`;

          await prisma.alerta.create({
            data: {
              alunoId: aluno.id,
              tipo: "TAREFA_ATRASADA",
              mensagem: mensagemCompleta,
            },
          });
        }
      } else if (diasSemAvanco < 7) {
        // Se avançou recentemente, resolve alertas anteriores de inatividade pendentes
        await prisma.alerta.updateMany({
          where: {
            alunoId: aluno.id,
            mensagem: { contains: "INATIVIDADE_ATIVIDADES" },
            resolvido: false,
          },
          data: { resolvido: true },
        });
      }

      // 3.2 ALERTAS DE PRAZOS DAS ATIVIDADES DO QUADRO
      interface MarcoRow {
        id: string;
        titulo: string;
        prazoPlanejado: string | Date;
        status: string;
        porcentagem: number;
      }
      const marcos = await prisma.$queryRawUnsafe<MarcoRow[]>(
        `SELECT id, titulo, "prazoPlanejado", status, porcentagem FROM marco_roadmap WHERE "alunoId" = $1 ORDER BY ordem ASC;`,
        aluno.id
      );

      // Se o aluno está ativo há mais de 7 dias e não possui nenhuma atividade cadastrada
      if (marcos.length === 0) {
        const diasDesdeInicio = Math.floor(
          (agora.getTime() - new Date(aluno.dataInicio).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diasDesdeInicio >= 7) {
          const identificadorSemAtiv = "SEM_ATIVIDADES_PLANEJADAS";
          const alertaExistente = await prisma.alerta.findFirst({
            where: {
              alunoId: aluno.id,
              mensagem: { contains: identificadorSemAtiv },
            },
          });
          if (!alertaExistente) {
            const msgBase = `${aluno.nome} ainda não possui nenhuma atividade planejada no Quadro de Atividades.`;
            await prisma.alerta.create({
              data: {
                alunoId: aluno.id,
                tipo: "PRAZO_PROXIMO",
                mensagem: `${msgBase} ||| Quadro de Atividades ||| sem_atividades ||| SEM_ATIVIDADES_PLANEJADAS`,
              },
            });
          }
        }
      } else {
        // Se já possui atividades, garante a resolução de alerta de quadro vazio
        await prisma.alerta.updateMany({
          where: {
            alunoId: aluno.id,
            mensagem: { contains: "SEM_ATIVIDADES_PLANEJADAS" },
            resolvido: false,
          },
          data: { resolvido: true },
        });

        const hojeZero = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

        for (const marco of marcos) {
          // Se concluída, resolve qualquer alerta pendente sobre esta atividade
          if (marco.status === "CONCLUIDO" || Number(marco.porcentagem) === 100) {
            await prisma.alerta.updateMany({
              where: {
                alunoId: aluno.id,
                mensagem: { contains: marco.id },
                resolvido: false,
              },
              data: { resolvido: true },
            });
            continue;
          }

          if (!marco.prazoPlanejado) continue;

          let prazoAtividade: Date;
          if (typeof marco.prazoPlanejado === "string") {
            const [ano, mes, dia] = marco.prazoPlanejado.split("T")[0].split("-").map(Number);
            prazoAtividade = new Date(ano, mes - 1, dia);
          } else {
            const d = new Date(marco.prazoPlanejado);
            prazoAtividade = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
          }

          const diffMs = prazoAtividade.getTime() - hojeZero.getTime();
          const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));
          const dataFmt = prazoAtividade.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });

          let stage:
            | "ATIVIDADE_ATRASADA"
            | "ATIVIDADE_HOJE"
            | "ATIVIDADE_AMANHA"
            | "ATIVIDADE_SEMANA"
            | "ATIVIDADE_NAO_INICIADA"
            | null = null;
          let tipoAlerta: "TAREFA_ATRASADA" | "PRAZO_PROXIMO" = "PRAZO_PROXIMO";
          let msgBase = "";

          if (diffDias < 0) {
            stage = "ATIVIDADE_ATRASADA";
            tipoAlerta = "TAREFA_ATRASADA";
            msgBase = `${aluno.nome} está com a atividade '${marco.titulo}' atrasada (prazo era ${dataFmt}).`;
          } else if (diffDias === 0) {
            stage = "ATIVIDADE_HOJE";
            tipoAlerta = "PRAZO_PROXIMO";
            msgBase = `${aluno.nome} tem a atividade '${marco.titulo}' com prazo para hoje.`;
          } else if (diffDias === 1) {
            stage = "ATIVIDADE_AMANHA";
            tipoAlerta = "PRAZO_PROXIMO";
            msgBase = `${aluno.nome} tem a atividade '${marco.titulo}' para concluir amanhã (${dataFmt}).`;
          } else if (diffDias <= 7) {
            if (Number(marco.porcentagem) === 0 || marco.status === "NAO_INICIADO") {
              stage = "ATIVIDADE_NAO_INICIADA";
              tipoAlerta = "PRAZO_PROXIMO";
              msgBase = `${aluno.nome} ainda não iniciou a atividade '${marco.titulo}', que vence em ${diffDias} dias (${dataFmt}).`;
            } else {
              stage = "ATIVIDADE_SEMANA";
              tipoAlerta = "PRAZO_PROXIMO";
              msgBase = `${aluno.nome} tem a atividade '${marco.titulo}' com prazo para a próxima semana (${dataFmt}).`;
            }
          }

          if (stage) {
            const identificador = `${marco.id} ||| ${stage}`;
            const alertaExistente = await prisma.alerta.findFirst({
              where: {
                alunoId: aluno.id,
                mensagem: { contains: identificador },
              },
            });

            if (!alertaExistente) {
              await prisma.alerta.updateMany({
                where: {
                  alunoId: aluno.id,
                  mensagem: { contains: marco.id },
                  resolvido: false,
                },
                data: { resolvido: true },
              });

              const mensagemCompleta = `${msgBase} ||| ${marco.titulo} ||| ${marco.id} ||| ${stage}`;

              await prisma.alerta.create({
                data: {
                  alunoId: aluno.id,
                  tipo: tipoAlerta,
                  mensagem: mensagemCompleta,
                },
              });
            }
          }
        }
      }

      // 3.3 ALERTAS DE SUBTAREFAS VINCULADAS ATRASADAS
      const subtarefasAtrasadas = await prisma.$queryRawUnsafe<
        Array<{
          tarefaId: string;
          tarefaTitulo: string;
          prazo: Date;
          marcoId: string;
          marcoTitulo: string;
        }>
      >(
        `SELECT t.id as "tarefaId", t.titulo as "tarefaTitulo", t.prazo, m.id as "marcoId", m.titulo as "marcoTitulo"
         FROM tarefa t
         JOIN marco_roadmap m ON m.id = t."marcoId"
         WHERE t."alunoId" = $1 AND t.status = 'ABERTA' AND t.prazo IS NOT NULL AND t.prazo < $2;`,
        aluno.id,
        agora
      );

      for (const sub of subtarefasAtrasadas) {
        const identificadorSub = `${sub.tarefaId} ||| SUBTAREFA_ATRASADA`;
        const alertaExistente = await prisma.alerta.findFirst({
          where: {
            alunoId: aluno.id,
            mensagem: { contains: identificadorSub },
          },
        });

        if (!alertaExistente) {
          const msgBase = `${aluno.nome} possui a subtarefa '${sub.tarefaTitulo}' atrasada na atividade '${sub.marcoTitulo}'.`;
          const mensagemCompleta = `${msgBase} ||| ${sub.marcoTitulo} ||| ${sub.tarefaId} ||| SUBTAREFA_ATRASADA`;

          await prisma.alerta.create({
            data: {
              alunoId: aluno.id,
              tipo: "TAREFA_ATRASADA",
              mensagem: mensagemCompleta,
            },
          });
        }
      }
    } catch {
      // Silencioso se tabela marco_roadmap não existir ainda
    }
  } catch (err) {
    console.error(`Erro ao garantir alertas para aluno ${alunoId}:`, err);
  } finally {
    alunosSendoVerificados.delete(alunoId);
  }
}

/**
 * Verifica alertas de todos os orientandos de um professor e retorna os alertas ativos.
 */
export async function verificarEObterAlertasProfessor(professorId: string): Promise<NotificacaoItem[]> {
  try {
    await garantirTabelaConviteReuniao();

    const alunos = await prisma.aluno.findMany({
      where: { orientadorId: professorId, arquivado: false },
      select: { id: true, nome: true },
    });

    for (const aluno of alunos) {
      await garantirAlertasAluno(aluno.id, aluno.nome);
    }

    // 1. Convites de reunião recebidos pelo orientador (enviados por alunos) ou respostas aos convites que o orientador enviou
    let convitesReuniaoRows: ConviteReuniaoRow[] = [];
    try {
      convitesReuniaoRows = await prisma.$queryRawUnsafe<ConviteReuniaoRow[]>(
        `SELECT * FROM convite_reuniao WHERE "orientadorId" = $1 ORDER BY "atualizadoEm" DESC, "criadoEm" DESC`,
        professorId
      );
    } catch {}

    const itensConviteProfessor: NotificacaoItem[] = [];
    for (const c of convitesReuniaoRows) {
      const dataPt = new Date(c.data).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      // Se o aluno enviou o convite para o orientador e está PENDENTE
      if (c.remetentePapel === "ALUNO" && c.status === "PENDENTE" && !c.lidaPeloDestinatario) {
        itensConviteProfessor.push({
          id: c.id,
          conviteReuniaoId: c.id,
          tipo: "CONVITE_REUNIAO",
          mensagem: `${c.alunoNome} enviou um convite de reunião para ${dataPt} às ${c.horarioStr}.`,
          alunoId: c.alunoId,
          alunoNome: c.alunoNome,
          criadoEm: new Date(c.criadoEm).toISOString(),
          resolvido: false,
          link: "/reunioes",
          linkRotulo: "Ir para Reuniões",
        });
      }

      // Se o orientador enviou o convite e o aluno aceitou ou recusou (e o orientador ainda não leu a resposta)
      if (
        c.remetentePapel !== "ALUNO" &&
        (c.status === "ACEITO" || c.status === "RECUSADO") &&
        !c.lidaPeloRemetente
      ) {
        const msgResposta =
          c.status === "ACEITO"
            ? `${c.alunoNome} aceitou o convite de reunião para ${dataPt} às ${c.horarioStr}.`
            : `${c.alunoNome} recusou o convite de reunião para ${dataPt} às ${c.horarioStr}. Justificativa: "${c.justificativaRecusa || "Não informada"}"`;

        itensConviteProfessor.push({
          id: `resp_${c.id}`,
          conviteReuniaoId: c.id,
          tipo: "RESPOSTA_CONVITE_REUNIAO",
          mensagem: msgResposta,
          alunoId: c.alunoId,
          alunoNome: c.alunoNome,
          criadoEm: new Date(c.atualizadoEm || c.criadoEm).toISOString(),
          resolvido: false,
          link: "/reunioes",
          linkRotulo: "Ver em Reuniões",
        });
      }
    }

    const alertas = await prisma.alerta.findMany({
      where: {
        resolvido: false,
        aluno: { orientadorId: professorId },
      },
      include: {
        aluno: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: "desc" },
    });

    const alertasUnicosMap = new Map<string, typeof alertas[0]>();
    for (const a of alertas) {
      if (a.mensagem.includes("marcou uma reunião para")) continue;
      const msgFormatada = formatarMensagemAlertaParaProfessor(a.mensagem);
      const chave = `${a.alunoId}-${a.tipo}-${msgFormatada}`;
      if (!alertasUnicosMap.has(chave)) {
        alertasUnicosMap.set(chave, a);
      }
    }

    const alertasUnicos = Array.from(alertasUnicosMap.values()).slice(0, 10);

    const itensAlerta = alertasUnicos.map((a) => {
      let link = `/alunos/${a.alunoId}`;
      let linkRotulo = "Acompanhar orientando";

      if (
        a.mensagem.includes("||| ATIVIDADE_") ||
        a.mensagem.includes("||| INATIVIDADE_") ||
        a.mensagem.includes("||| SUBTAREFA_") ||
        a.mensagem.includes("||| SEM_ATIVIDADES_") ||
        a.mensagem.includes("||| MARCO_") ||
        a.mensagem.includes("sem avançar em nenhuma atividade")
      ) {
        link = `/roadmap?alunoId=${a.alunoId}`;
        linkRotulo = "Ver Quadro de Atividades";
      }

      return {
        id: a.id,
        tipo: a.tipo,
        mensagem: formatarMensagemAlertaParaProfessor(a.mensagem),
        alunoId: a.alunoId,
        alunoNome: a.aluno.nome,
        criadoEm: a.criadoEm.toISOString(),
        resolvido: a.resolvido,
        link,
        linkRotulo,
      };
    });

    return [...itensConviteProfessor, ...itensAlerta].sort(
      (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    );
  } catch (error) {
    console.error("Erro ao verificar/obter alertas do professor:", error);
    return [];
  }
}

/**
 * Obtém as notificações e alertas ativos (não lidos/não resolvidos) do aluno.
 */
export async function obterNotificacoesAluno(alunoId: string): Promise<NotificacaoItem[]> {
  try {
    await garantirTabelaConviteReuniao();

    const aluno = await prisma.aluno.findUnique({
      where: { id: alunoId },
      select: { id: true, nome: true, arquivado: true },
    });

    if (aluno && !aluno.arquivado) {
      await garantirAlertasAluno(aluno.id, aluno.nome);
    }

    // 1. Convites de reunião recebidos pelo aluno (enviados pelo orientador) ou respostas aos convites que o aluno enviou
    let convitesReuniaoRows: ConviteReuniaoRow[] = [];
    try {
      convitesReuniaoRows = await prisma.$queryRawUnsafe<ConviteReuniaoRow[]>(
        `SELECT * FROM convite_reuniao WHERE "alunoId" = $1 ORDER BY "atualizadoEm" DESC, "criadoEm" DESC`,
        alunoId
      );
    } catch {}

    const itensConviteAluno: NotificacaoItem[] = [];
    for (const c of convitesReuniaoRows) {
      const dataPt = new Date(c.data).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      // Se o orientador enviou o convite para o aluno e está PENDENTE
      if (c.remetentePapel !== "ALUNO" && c.status === "PENDENTE" && !c.lidaPeloDestinatario) {
        itensConviteAluno.push({
          id: c.id,
          conviteReuniaoId: c.id,
          tipo: "CONVITE_REUNIAO",
          mensagem: `${c.orientadorNome} enviou um convite de reunião para ${dataPt} às ${c.horarioStr}.`,
          alunoId: c.alunoId,
          alunoNome: c.alunoNome,
          criadoEm: new Date(c.criadoEm).toISOString(),
          resolvido: false,
          link: "/reunioes",
          linkRotulo: "Ir para Reuniões",
        });
      }

      // Se o aluno enviou o convite e o orientador aceitou ou recusou
      if (
        c.remetentePapel === "ALUNO" &&
        (c.status === "ACEITO" || c.status === "RECUSADO") &&
        !c.lidaPeloRemetente
      ) {
        const msgResposta =
          c.status === "ACEITO"
            ? `${c.orientadorNome} aceitou o convite de reunião para ${dataPt} às ${c.horarioStr}.`
            : `${c.orientadorNome} recusou o convite de reunião para ${dataPt} às ${c.horarioStr}. Justificativa: "${c.justificativaRecusa || "Não informada"}"`;

        itensConviteAluno.push({
          id: `resp_${c.id}`,
          conviteReuniaoId: c.id,
          tipo: "RESPOSTA_CONVITE_REUNIAO",
          mensagem: msgResposta,
          alunoId: c.alunoId,
          alunoNome: c.alunoNome,
          criadoEm: new Date(c.atualizadoEm || c.criadoEm).toISOString(),
          resolvido: false,
          link: "/reunioes",
          linkRotulo: "Ver em Reuniões",
        });
      }
    }

    // 2. Notificações de comentários em artigo / convite de orientação
    let rows: Array<{
      id: string;
      alunoId: string;
      producaoId: string | null;
      mensagem: string;
      lida: boolean;
      criadoEm: Date;
    }> = [];

    try {
      rows = await prisma.$queryRawUnsafe(
        `SELECT id, "alunoId", "producaoId", mensagem, lida, "criadoEm" FROM notificacao_aluno WHERE "alunoId" = $1 AND lida = false ORDER BY "criadoEm" DESC LIMIT 10`,
        alunoId
      );
    } catch {
      // Silencioso se a tabela ainda não existir
    }

    // 3. Alertas ativos da tabela 'alerta'
    const alertasAtivos = await prisma.alerta.findMany({
      where: {
        alunoId,
        resolvido: false,
      },
      orderBy: { criadoEm: "desc" },
    });

    const alertasUnicosMap = new Map<string, typeof alertasAtivos[0]>();
    for (const a of alertasAtivos) {
      if (a.mensagem.includes("marcou uma reunião para")) continue;
      const msgFormatada = formatarMensagemAlertaParaAluno(a.mensagem, aluno?.nome, a.tipo);
      const chave = `${a.alunoId}-${a.tipo}-${msgFormatada}`;
      if (!alertasUnicosMap.has(chave)) {
        alertasUnicosMap.set(chave, a);
      }
    }
    const alertasAtivosUnicos = Array.from(alertasUnicosMap.values()).slice(0, 10);

    const itensNotificacao: NotificacaoItem[] = rows
      .filter((r) => !r.mensagem.includes("marcou uma reunião com você para"))
      .map((r) => {
        if (r.mensagem.includes("||| CONVITE_ORIENTACAO |||")) {
          const parts = r.mensagem.split("|||").map((s) => s.trim());
          return {
            id: r.id,
            tipo: "CONVITE_ORIENTACAO",
            mensagem: parts[0],
            alunoId: r.alunoId,
            alunoNome: aluno?.nome ?? "",
            criadoEm: new Date(r.criadoEm).toISOString(),
            resolvido: r.lida,
            link: "/alertas",
            linkRotulo: "Ver convite",
          };
        }

        if (r.mensagem.includes("||| QUADRO_ATIVIDADE |||")) {
          const parts = r.mensagem.split("|||").map((s) => s.trim());
          return {
            id: r.id,
            tipo: "NOVA_ATIVIDADE",
            mensagem: parts[0],
            alunoId: r.alunoId,
            alunoNome: aluno?.nome ?? "",
            criadoEm: new Date(r.criadoEm).toISOString(),
            resolvido: r.lida,
            link: "/roadmap",
            linkRotulo: "Ver atividades",
          };
        }

        return {
          id: r.id,
          tipo: "NOVA_MARCACAO",
          mensagem: r.mensagem,
          alunoId: r.alunoId,
          alunoNome: aluno?.nome ?? "",
          criadoEm: new Date(r.criadoEm).toISOString(),
          resolvido: r.lida,
          link: r.producaoId ? `/producao/${r.producaoId}` : "/producao",
          linkRotulo: "Ver artigo",
        };
      });

    const itensAlerta: NotificacaoItem[] = alertasAtivosUnicos.map((a) => {
      let link = "/alertas";
      let linkRotulo = "Acessar";

      if (
        a.mensagem.includes("||| ATIVIDADE_") ||
        a.mensagem.includes("||| INATIVIDADE_") ||
        a.mensagem.includes("||| SUBTAREFA_") ||
        a.mensagem.includes("||| SEM_ATIVIDADES_") ||
        a.mensagem.includes("||| MARCO_") ||
        a.mensagem.includes("sem avançar em nenhuma atividade")
      ) {
        link = "/roadmap";
        linkRotulo = "Ver Quadro de Atividades";
      } else if (a.mensagem.includes("|||")) {
        const parts = a.mensagem.split("|||").map((s) => s.trim());
        const producaoId = parts[2];
        link = producaoId ? `/producao/${producaoId}` : "/producao";
        linkRotulo = "Ver produção";
      } else if (a.tipo === "DIAS_SEM_REUNIAO") {
        link = "/reunioes";
        linkRotulo = "Agendar reunião";
      } else if (a.tipo === "TAREFA_ATRASADA" || a.tipo === "PRAZO_PROXIMO") {
        link = "/entregas";
        linkRotulo = "Ver entregas";
      } else if (a.tipo === "CHECKIN_NAO_PREENCHIDO" || a.tipo === "FALTA_SEM_AVISO") {
        link = "/reunioes";
        linkRotulo = "Minhas reuniões";
      }

      return {
        id: a.id,
        tipo: a.tipo,
        mensagem: formatarMensagemAlertaParaAluno(a.mensagem, aluno?.nome, a.tipo),
        alunoId: a.alunoId,
        alunoNome: aluno?.nome ?? "",
        criadoEm: a.criadoEm.toISOString(),
        resolvido: a.resolvido,
        link,
        linkRotulo,
      };
    });

    return [...itensConviteAluno, ...itensNotificacao, ...itensAlerta].sort(
      (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    );
  } catch (err) {
    console.error("Erro ao obter notificações do aluno:", err);
    return [];
  }
}

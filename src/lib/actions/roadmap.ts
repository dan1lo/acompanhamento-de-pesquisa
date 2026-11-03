"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type StatusMarco = "NAO_INICIADO" | "EM_ANDAMENTO" | "CONCLUIDO" | "ATRASADO";

export interface TarefaVinculadaMarco {
  id: string;
  titulo: string;
  responsavel?: string | null;
  responsavelTipo?: "ALUNO" | "PROFESSOR" | "AMBOS" | null;
  prazo?: string | null;
  status: "ABERTA" | "CONCLUIDA";
  concluidaEm?: string | null;
}

export interface MarcoRoadmapItem {
  id: string;
  alunoId: string;
  ordem: number;
  titulo: string; // Título da Atividade / Seção Planejada (ex: "1. Introdução e Contextualização")
  descricao?: string | null; // Conteúdo planejado para esta atividade
  estimativaPaginas?: string | null; // Estimativa de páginas (ex: "3-5 páginas")
  canvasSecaoId?: string | null; // ID correspondente no Card 6 do Canvas
  fase: string; // ex: "Introdução", "Fundamentação", "Metodologia", "Resultados", "Conclusão"
  responsavelTipo?: "ALUNO" | "PROFESSOR" | "AMBOS" | null;
  prazoPlanejado: string; // YYYY-MM-DD
  prazoRealizado?: string | null; // YYYY-MM-DD
  status: StatusMarco;
  porcentagem: number; // 0 a 100
  diasDiferenca?: number;
  situacaoPrazo: "NO_PRAZO" | "ATENCAO" | "ATRASADO" | "CONCLUIDO_NO_PRAZO" | "CONCLUIDO_COM_ATRASO" | "CONCLUIDO_ADIANTADO";
  tarefas: TarefaVinculadaMarco[];
  criadoEm: string;
}

export interface RoadmapResponse {
  alunoId: string;
  alunoNome: string;
  alunoEmail: string;
  orientadorNome?: string;
  nivel: string;
  tema?: string | null;
  marcos: MarcoRoadmapItem[];
  estatisticas: {
    totalMarcos: number; // Total de Capítulos
    concluidos: number; // Capítulos Concluídos
    emAndamento: number; // Em Redação
    atrasados: number; // Capítulos Atrasados
    porcentagemGeral: number; // % Geral da Dissertação/Tese
    etapaAtualNome?: string;
    totalPaginasEstimadas?: string; // Total de páginas estimadas somadas
  };
  orientandos?: Array<{ id: string; nome: string; nivel: string }>;
  isAluno: boolean;
}

const TEMPLATES_CAPITULOS: Record<
  string,
  Array<{
    titulo: string;
    fase: string;
    estimativaPaginas: string;
    descricao: string;
  }>
> = {
  TCC: [
    {
      titulo: "1. Introdução e Contextualização",
      fase: "Introdução",
      estimativaPaginas: "4-6 páginas",
      descricao: "Apresentação do tema, relevância acadêmica/prática, formulação do problema, justificativa e objetivos.",
    },
    {
      titulo: "2. Revisão Bibliográfica & Referencial Teórico",
      fase: "Fundamentação",
      estimativaPaginas: "15-20 páginas",
      descricao: "Mapeamento das lacunas na literatura, conceitos norteadores e autores fundamentais da área.",
    },
    {
      titulo: "3. Metodologia e Procedimentos",
      fase: "Metodologia",
      estimativaPaginas: "6-10 páginas",
      descricao: "Classificação da pesquisa, instrumentos de coleta de dados, critérios de amostragem e técnicas de análise.",
    },
    {
      titulo: "4. Desenvolvimento, Resultados e Discussão",
      fase: "Resultados",
      estimativaPaginas: "18-25 páginas",
      descricao: "Apresentação sistemática dos dados coletados, experimentos executados e discussão analítica dos resultados.",
    },
    {
      titulo: "5. Considerações Finais e Trabalhos Futuros",
      fase: "Conclusão",
      estimativaPaginas: "4-6 páginas",
      descricao: "Síntese dos achados, limitações do estudo, resposta aos objetivos e proposição de pesquisas futuras.",
    },
  ],
  MESTRADO: [
    {
      titulo: "1. Introdução, Objetivos e Hipóteses",
      fase: "Introdução",
      estimativaPaginas: "10-15 páginas",
      descricao: "Problema de investigação, delimitação do escopo, motivação científica, objetivos e hipóteses centrais.",
    },
    {
      titulo: "2. Revisão Sistemática da Literatura (RSL)",
      fase: "Estado da Arte",
      estimativaPaginas: "25-35 páginas",
      descricao: "Protocolo de RSL, síntese quanti-qualitativa de publicações de alto impacto e mapa das lacunas científicas.",
    },
    {
      titulo: "3. Procedimentos Metodológicos e Instrumentação",
      fase: "Metodologia",
      estimativaPaginas: "12-18 páginas",
      descricao: "Desenho da pesquisa, instrumentos empíricos/computacionais, rigor metodológico e procedimentos éticos.",
    },
    {
      titulo: "4. Desenvolvimento e Coleta Experimental",
      fase: "Desenvolvimento",
      estimativaPaginas: "30-45 páginas",
      descricao: "Implementação da proposta, protocolos de teste controlados, execução experimental e dados brutos.",
    },
    {
      titulo: "5. Análise dos Resultados e Validação",
      fase: "Análise",
      estimativaPaginas: "25-35 páginas",
      descricao: "Discussão comparativa dos resultados com a literatura existente, testes estatísticos e validação empírica.",
    },
    {
      titulo: "6. Conclusões, Produção Científica e Desdobramentos",
      fase: "Conclusão",
      estimativaPaginas: "6-10 páginas",
      descricao: "Confirmação das hipóteses, artigos decorrentes submetidos e agenda de contribuições científicas.",
    },
  ],
  DOUTORADO: [
    {
      titulo: "1. Introdução, Tese e Contribuição Original",
      fase: "Introdução",
      estimativaPaginas: "15-20 páginas",
      descricao: "Declaração explícita da tese defendida, originalidade da contribuição e relevância teórica/prática internacional.",
    },
    {
      titulo: "2. Arcabouço Teórico e Estado da Arte Crítico",
      fase: "Fundamentação",
      estimativaPaginas: "40-60 páginas",
      descricao: "Análise crítica e aprofundada dos modelos teóricos vigentes e identificação das fronteiras do conhecimento.",
    },
    {
      titulo: "3. Desenho Metodológico e Formalização",
      fase: "Metodologia",
      estimativaPaginas: "20-30 páginas",
      descricao: "Formalização matemática/conceitual, protocolos de validação cruzada e critérios de repetibilidade.",
    },
    {
      titulo: "4. Contribuição I: Modelo Teórico / Artigo 1",
      fase: "Contribuição I",
      estimativaPaginas: "30-45 páginas",
      descricao: "Primeiro pilar da tese: formulação inovadora com validação conceitual e artigo indexado Qualis A.",
    },
    {
      titulo: "5. Contribuição II: Experimentos e Validação Empírica",
      fase: "Contribuição II",
      estimativaPaginas: "35-50 páginas",
      descricao: "Segundo pilar da tese: aplicação em larga escala, experimentos empíricos e comparativo com baselines de ponta.",
    },
    {
      titulo: "6. Discussão Geral, Implicações e Limitações",
      fase: "Discussão",
      estimativaPaginas: "20-30 páginas",
      descricao: "Síntese holística dos achados, demonstração irrefutável da tese e análise das limitações epistemológicas.",
    },
    {
      titulo: "7. Conclusões e Agenda de Pesquisas Futuras",
      fase: "Conclusão",
      estimativaPaginas: "8-12 páginas",
      descricao: "Balanço das contribuições originais, patentes/produtos desenvolvidos e direções de pesquisa para o grupo.",
    },
  ],
};

let tabelaRoadmapGarantida = false;

export async function garantirTabelasRoadmap() {
  if (tabelaRoadmapGarantida) return;
  try {
    // Garante tabela marco_roadmap
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS marco_roadmap (
        id TEXT PRIMARY KEY,
        "alunoId" TEXT NOT NULL,
        ordem INTEGER NOT NULL DEFAULT 1,
        titulo TEXT NOT NULL,
        descricao TEXT,
        fase TEXT DEFAULT 'Geral',
        "estimativaPaginas" TEXT,
        "canvasSecaoId" TEXT,
        "responsavelTipo" TEXT DEFAULT 'AMBOS',
        "prazoPlanejado" DATE NOT NULL,
        "prazoRealizado" DATE,
        status TEXT NOT NULL DEFAULT 'NAO_INICIADO',
        porcentagem INTEGER NOT NULL DEFAULT 0,
        "atualizadoEm" TIMESTAMP DEFAULT NOW(),
        "criadoEm" TIMESTAMP DEFAULT NOW()
      );
    `);

    // Garante as colunas novas caso a tabela já existisse
    await prisma.$executeRawUnsafe(`
      ALTER TABLE marco_roadmap ADD COLUMN IF NOT EXISTS "estimativaPaginas" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE marco_roadmap ADD COLUMN IF NOT EXISTS "canvasSecaoId" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE marco_roadmap ADD COLUMN IF NOT EXISTS "responsavelTipo" TEXT DEFAULT 'AMBOS';
    `);

    // Adiciona colunas marcoId e responsavelTipo em tarefa se não existirem
    await prisma.$executeRawUnsafe(`
      ALTER TABLE tarefa ADD COLUMN IF NOT EXISTS "marcoId" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE tarefa ADD COLUMN IF NOT EXISTS "responsavelTipo" TEXT DEFAULT 'ALUNO';
    `);

    tabelaRoadmapGarantida = true;
  } catch (err: any) {
    if (
      err?.code === "23505" ||
      err?.code === "42P07" ||
      String(err?.message || "").includes("já existe")
    ) {
      tabelaRoadmapGarantida = true;
      return;
    }
  }
}

/**
 * Calcula a soma de páginas estimadas para todos os capítulos
 */
function calcularTotalPaginasEstimadas(marcos: MarcoRoadmapItem[]): string {
  let minTotal = 0;
  let maxTotal = 0;
  let temEstimativa = false;

  for (const m of marcos) {
    if (!m.estimativaPaginas) continue;
    temEstimativa = true;
    const match = m.estimativaPaginas.match(/(\d+)\s*[-aà]\s*(\d+)/i);
    if (match) {
      minTotal += parseInt(match[1], 10);
      maxTotal += parseInt(match[2], 10);
    } else {
      const single = m.estimativaPaginas.match(/(\d+)/);
      if (single) {
        const val = parseInt(single[1], 10);
        minTotal += val;
        maxTotal += val;
      }
    }
  }

  if (!temEstimativa || maxTotal === 0) return "A definir";
  if (minTotal === maxTotal) return `~${maxTotal} páginas`;
  return `${minTotal} – ${maxTotal} páginas`;
}

/**
 * Obtém os dados completos do Quadro de Atividades da Pesquisa para um orientando.
 */
export async function obterRoadmapAluno(alunoIdAlvo?: string): Promise<RoadmapResponse | null> {
  await garantirTabelasRoadmap();
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    include: { aluno: true },
  });
  if (!usuario) throw new Error("Usuário não encontrado");

  const isAluno = usuario.papel === "ALUNO";
  let targetAlunoId = alunoIdAlvo;
  let orientandos: Array<{ id: string; nome: string; nivel: string }> = [];

  if (isAluno) {
    let alunoObj = usuario.aluno;
    if (!alunoObj && usuario.email) {
      alunoObj = await prisma.aluno.findUnique({
        where: { email: usuario.email.toLowerCase().trim() },
      });
    }
    if (!alunoObj) return null;
    targetAlunoId = alunoObj.id;
  } else {
    orientandos = await prisma.aluno.findMany({
      where: { orientadorId: usuario.id, arquivado: false },
      select: { id: true, nome: true, nivel: true },
      orderBy: { nome: "asc" },
    });
    if (!targetAlunoId && orientandos.length > 0) {
      targetAlunoId = orientandos[0].id;
    }
  }

  if (!targetAlunoId) return null;

  const aluno = await prisma.aluno.findUnique({
    where: { id: targetAlunoId },
    include: {
      orientador: { select: { nome: true } },
    },
  });
  if (!aluno) return null;

  // Busca as atividades da tabela marco_roadmap
  let rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM marco_roadmap WHERE "alunoId" = $1 ORDER BY ordem ASC, "prazoPlanejado" ASC;`,
    targetAlunoId
  );

  // Se ainda estiver completamente vazio, aplica o template de atividades de acordo com o nível acadêmico
  if (rows.length === 0) {
    await aplicarTemplateRoadmap(targetAlunoId, aluno.nivel);
    rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM marco_roadmap WHERE "alunoId" = $1 ORDER BY ordem ASC, "prazoPlanejado" ASC;`,
      targetAlunoId
    );
  }

  // Busca todas as tarefas do aluno para mapear tarefas vinculadas aos capítulos
  const tarefasAluno = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, titulo, responsavel, "responsavelTipo", prazo, status, "concluidaEm", "marcoId"
     FROM tarefa
     WHERE "alunoId" = $1;`,
    targetAlunoId
  );

  const tarefasPorMarco = new Map<string, TarefaVinculadaMarco[]>();
  for (const t of tarefasAluno) {
    if (t.marcoId) {
      const lista = tarefasPorMarco.get(t.marcoId) ?? [];
      lista.push({
        id: t.id,
        titulo: t.titulo,
        responsavel: t.responsavel,
        responsavelTipo: t.responsavelTipo,
        prazo: t.prazo ? new Date(t.prazo).toISOString().split("T")[0] : null,
        status: t.status === "CONCLUIDA" ? "CONCLUIDA" : "ABERTA",
        concluidaEm: t.concluidaEm ? new Date(t.concluidaEm).toISOString() : null,
      });
      tarefasPorMarco.set(t.marcoId, lista);
    }
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const marcosFormatados: MarcoRoadmapItem[] = rows.map((r) => {
    const prazoPlan = new Date(r.prazoPlanejado);
    prazoPlan.setHours(0, 0, 0, 0);
    const prazoPlanStr = prazoPlan.toISOString().split("T")[0];

    const prazoReal = r.prazoRealizado ? new Date(r.prazoRealizado) : null;
    if (prazoReal) prazoReal.setHours(0, 0, 0, 0);
    const prazoRealStr = prazoReal ? prazoReal.toISOString().split("T")[0] : null;

    let statusCalculado: StatusMarco = r.status as StatusMarco;
    let diasDiferenca = 0;
    let situacaoPrazo: MarcoRoadmapItem["situacaoPrazo"] = "NO_PRAZO";

    if (statusCalculado === "CONCLUIDO" && prazoReal) {
      const diffMs = prazoPlan.getTime() - prazoReal.getTime();
      diasDiferenca = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diasDiferenca > 0) {
        situacaoPrazo = "CONCLUIDO_ADIANTADO";
      } else if (diasDiferenca < 0) {
        situacaoPrazo = "CONCLUIDO_COM_ATRASO";
      } else {
        situacaoPrazo = "CONCLUIDO_NO_PRAZO";
      }
    } else {
      const diffHoje = Math.round((prazoPlan.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      diasDiferenca = diffHoje;

      if (diffHoje < 0) {
        statusCalculado = "ATRASADO";
        situacaoPrazo = "ATRASADO";
      } else if (diffHoje <= 7) {
        situacaoPrazo = "ATENCAO";
      } else {
        situacaoPrazo = "NO_PRAZO";
      }
    }

    const tarefasVinculadas = tarefasPorMarco.get(r.id) ?? [];
    let porcentagem = Number(r.porcentagem) || 0;
    if (statusCalculado === "CONCLUIDO") {
      porcentagem = 100;
    } else if (tarefasVinculadas.length > 0) {
      const tarefasConcluidas = tarefasVinculadas.filter((t) => t.status === "CONCLUIDA").length;
      porcentagem = Math.round((tarefasConcluidas / tarefasVinculadas.length) * 100);
    }

    return {
      id: r.id,
      alunoId: r.alunoId,
      ordem: Number(r.ordem) || 1,
      titulo: r.titulo,
      descricao: r.descricao,
      estimativaPaginas: r.estimativaPaginas,
      canvasSecaoId: r.canvasSecaoId,
      fase: r.fase || `Capítulo ${r.ordem || 1}`,
      responsavelTipo: (r.responsavelTipo as "ALUNO" | "PROFESSOR" | "AMBOS") || "AMBOS",
      prazoPlanejado: prazoPlanStr,
      prazoRealizado: prazoRealStr,
      status: statusCalculado,
      porcentagem,
      diasDiferenca,
      situacaoPrazo,
      tarefas: tarefasVinculadas,
      criadoEm: new Date(r.criadoEm).toISOString(),
    };
  });

  const totalMarcos = marcosFormatados.length;
  const concluidos = marcosFormatados.filter((m) => m.status === "CONCLUIDO").length;
  const atrasados = marcosFormatados.filter((m) => m.status === "ATRASADO").length;
  const emAndamento = marcosFormatados.filter((m) => m.status === "EM_ANDAMENTO").length;
  const porcentagemGeral = totalMarcos > 0 ? Math.round((concluidos / totalMarcos) * 100) : 0;
  const etapaAtual = marcosFormatados.find((m) => m.status !== "CONCLUIDO");
  const totalPaginasEstimadas = calcularTotalPaginasEstimadas(marcosFormatados);

  return {
    alunoId: aluno.id,
    alunoNome: aluno.nome,
    alunoEmail: aluno.email,
    orientadorNome: aluno.orientador?.nome,
    nivel: aluno.nivel,
    tema: aluno.tema,
    marcos: marcosFormatados,
    estatisticas: {
      totalMarcos,
      concluidos,
      emAndamento,
      atrasados,
      porcentagemGeral,
      etapaAtualNome: etapaAtual?.titulo,
      totalPaginasEstimadas,
    },
    orientandos,
    isAluno,
  };
}

/**
 * Adiciona uma nova atividade ao Quadro de Atividades.
 */
export async function criarMarcoRoadmap(dados: {
  alunoId: string;
  titulo: string;
  descricao?: string;
  fase?: string;
  estimativaPaginas?: string;
  responsavelTipo?: "ALUNO" | "PROFESSOR" | "AMBOS";
  prazoPlanejado: string; // YYYY-MM-DD
}): Promise<{ ok: boolean; id?: string; erro?: string }> {
  try {
    await garantirTabelasRoadmap();
    const session = await auth();
    if (!session?.user) throw new Error("Não autenticado");

    const novoId = `cap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Determina a próxima ordem
    const ult = await prisma.$queryRawUnsafe<any[]>(
      `SELECT MAX(ordem) as max_ordem FROM marco_roadmap WHERE "alunoId" = $1;`,
      dados.alunoId
    );
    const proximaOrdem = (Number(ult[0]?.max_ordem) || 0) + 1;
    const faseNome = dados.fase?.trim() || "Atividade";
    const responsavel = dados.responsavelTipo || "AMBOS";

    await prisma.$executeRawUnsafe(
      `INSERT INTO marco_roadmap (
        id, "alunoId", ordem, titulo, descricao, "estimativaPaginas",
        fase, "responsavelTipo", "prazoPlanejado", status, porcentagem
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE(NULLIF($9, '')::date, CURRENT_DATE), 'NAO_INICIADO', 0);`,
      novoId,
      dados.alunoId,
      proximaOrdem,
      dados.titulo.trim(),
      dados.descricao?.trim() || null,
      dados.estimativaPaginas?.trim() || null,
      faseNome,
      responsavel,
      dados.prazoPlanejado
    );

    // Se o criador for professor/orientador, envia notificação para o orientando
    const usuarioCriador = await prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { papel: true, nome: true },
    });

    if (usuarioCriador && usuarioCriador.papel !== "ALUNO") {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO notificacao_aluno (id, "alunoId", mensagem, lida, "criadoEm")
           VALUES ($1, $2, $3, false, NOW());`,
          `notif_ativ_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          dados.alunoId,
          `${usuarioCriador.nome} adicionou a atividade "${dados.titulo.trim()}" ao seu Quadro de Atividades. ||| QUADRO_ATIVIDADE ||| ${novoId}`
        );
      } catch {}
    }

    revalidatePath("/roadmap");
    revalidatePath(`/alunos/${dados.alunoId}`);

    return { ok: true, id: novoId };
  } catch (err: any) {
    return { ok: false, erro: err?.message || "Erro ao criar atividade" };
  }
}

/**
 * Atualiza uma atividade do Quadro de Atividades.
 */
export async function atualizarMarcoRoadmap(
  marcoId: string,
  dados: {
    titulo?: string;
    descricao?: string;
    fase?: string;
    estimativaPaginas?: string;
    responsavelTipo?: "ALUNO" | "PROFESSOR" | "AMBOS";
    prazoPlanejado?: string;
    prazoRealizado?: string | null;
    status?: StatusMarco;
    porcentagem?: number;
    ordem?: number;
  }
): Promise<{ ok: boolean; erro?: string }> {
  try {
    await garantirTabelasRoadmap();
    const session = await auth();
    if (!session?.user) throw new Error("Não autenticado");

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM marco_roadmap WHERE id = $1 LIMIT 1;`,
      marcoId
    );
    if (rows.length === 0) throw new Error("Atividade não encontrada");
    const marco = rows[0];

    let novoStatus = dados.status ?? marco.status;
    let novoPrazoRealizado = dados.prazoRealizado !== undefined ? dados.prazoRealizado : marco.prazoRealizado;
    let novaPorcentagem = dados.porcentagem !== undefined ? dados.porcentagem : marco.porcentagem;

    if (novoStatus === "CONCLUIDO" && !novoPrazoRealizado) {
      novoPrazoRealizado = new Date().toISOString().split("T")[0];
      novaPorcentagem = 100;
    } else if (novoStatus !== "CONCLUIDO" && dados.status !== undefined) {
      novoPrazoRealizado = null;
    }

    await prisma.$executeRawUnsafe(
      `UPDATE marco_roadmap
       SET titulo = COALESCE($1, titulo),
           descricao = COALESCE($2, descricao),
           "estimativaPaginas" = COALESCE($3, "estimativaPaginas"),
           fase = COALESCE($4, fase),
           "responsavelTipo" = COALESCE($5, "responsavelTipo"),
           "prazoPlanejado" = COALESCE(NULLIF($6, '')::date, "prazoPlanejado"),
           "prazoRealizado" = NULLIF($7, '')::date,
           status = $8,
           porcentagem = $9,
           ordem = COALESCE($10, ordem),
           "atualizadoEm" = NOW()
       WHERE id = $11;`,
      dados.titulo?.trim(),
      dados.descricao?.trim(),
      dados.estimativaPaginas?.trim(),
      dados.fase?.trim(),
      dados.responsavelTipo,
      dados.prazoPlanejado || null,
      novoPrazoRealizado || null,
      novoStatus,
      novaPorcentagem,
      dados.ordem,
      marcoId
    );

    // Gerenciamento inteligente de alertas de atividades
    if (novoStatus === "CONCLUIDO") {
      try {
        // Resolve alertas pendentes sobre o prazo desta atividade
        await prisma.alerta.updateMany({
          where: {
            alunoId: marco.alunoId,
            mensagem: { contains: marcoId },
            resolvido: false,
          },
          data: { resolvido: true },
        });

        // Resolve alertas de inatividade pois o aluno concluiu uma atividade
        await prisma.alerta.updateMany({
          where: {
            alunoId: marco.alunoId,
            mensagem: { contains: "INATIVIDADE_ATIVIDADES" },
            resolvido: false,
          },
          data: { resolvido: true },
        });

        // Notifica o professor sobre a conclusão da atividade
        const aluno = await prisma.aluno.findUnique({
          where: { id: marco.alunoId },
          select: { nome: true },
        });
        if (aluno) {
          const tit = dados.titulo?.trim() || marco.titulo;
          const msgConcluida = `${aluno.nome} concluiu a atividade '${tit}'. ||| ${tit} ||| ${marcoId} ||| ATIVIDADE_CONCLUIDA`;
          await prisma.alerta.create({
            data: {
              alunoId: marco.alunoId,
              tipo: "PRAZO_PROXIMO",
              mensagem: msgConcluida,
            },
          });
        }
      } catch {}
    } else if (novaPorcentagem > 0) {
      try {
        // Se avançou na porcentagem, resolve inatividade pendente
        await prisma.alerta.updateMany({
          where: {
            alunoId: marco.alunoId,
            mensagem: { contains: "INATIVIDADE_ATIVIDADES" },
            resolvido: false,
          },
          data: { resolvido: true },
        });
      } catch {}
    }

    revalidatePath("/roadmap");
    revalidatePath(`/alunos/${marco.alunoId}`);

    return { ok: true };
  } catch (err: any) {
    return { ok: false, erro: err?.message || "Erro ao atualizar atividade" };
  }
}

/**
 * Exclui uma atividade do Quadro de Atividades.
 */
export async function excluirMarcoRoadmap(marcoId: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    await garantirTabelasRoadmap();
    const session = await auth();
    if (!session?.user) throw new Error("Não autenticado");

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "alunoId" FROM marco_roadmap WHERE id = $1 LIMIT 1;`,
      marcoId
    );
    const alunoId = rows[0]?.alunoId;

    // Desvincula tarefas ligadas a esta atividade
    await prisma.$executeRawUnsafe(
      `UPDATE tarefa SET "marcoId" = NULL WHERE "marcoId" = $1;`,
      marcoId
    );

    await prisma.$executeRawUnsafe(
      `DELETE FROM marco_roadmap WHERE id = $1;`,
      marcoId
    );

    revalidatePath("/roadmap");
    if (alunoId) {
      revalidatePath(`/alunos/${alunoId}`);
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, erro: err?.message || "Erro ao excluir atividade" };
  }
}

/**
 * Vincula ou desvincula uma tarefa a uma atividade do Quadro.
 */
export async function vincularTarefaAoMarco(
  tarefaId: string,
  marcoId: string | null
): Promise<{ ok: boolean; erro?: string }> {
  try {
    await garantirTabelasRoadmap();
    const session = await auth();
    if (!session?.user) throw new Error("Não autenticado");

    await prisma.$executeRawUnsafe(
      `UPDATE tarefa SET "marcoId" = $1 WHERE id = $2;`,
      marcoId,
      tarefaId
    );

    revalidatePath("/roadmap");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, erro: err?.message || "Erro ao vincular tarefa à atividade" };
  }
}

/**
 * Aplica um template padrão de atividades de acordo com o nível acadêmico (TCC, MESTRADO ou DOUTORADO).
 */
export async function aplicarTemplateRoadmap(
  alunoId: string,
  nivel: string
): Promise<{ ok: boolean; totalCriados?: number; erro?: string }> {
  try {
    await garantirTabelasRoadmap();
    const hoje = new Date();

    const addMeses = (meses: number) => {
      const d = new Date(hoje);
      d.setMonth(d.getMonth() + meses);
      return d.toISOString().split("T")[0];
    };

    const nivelKey = nivel.toUpperCase().includes("DOUT")
      ? "DOUTORADO"
      : nivel.toUpperCase().includes("MEST")
      ? "MESTRADO"
      : "TCC";

    const lista = TEMPLATES_CAPITULOS[nivelKey] || TEMPLATES_CAPITULOS.TCC;

    // Limpa atividades anteriores
    await prisma.$executeRawUnsafe(
      `DELETE FROM marco_roadmap WHERE "alunoId" = $1;`,
      alunoId
    );

    let ord = 1;

    for (const item of lista) {
      const capId = `cap_${Date.now()}_${ord}_${Math.random().toString(36).substring(2, 6)}`;
      const prazoPlan = addMeses(ord * (nivelKey === "DOUTORADO" ? 6 : nivelKey === "MESTRADO" ? 3 : 1));

      await prisma.$executeRawUnsafe(
        `INSERT INTO marco_roadmap (
          id, "alunoId", ordem, titulo, descricao, "estimativaPaginas",
          fase, "responsavelTipo", "prazoPlanejado", status, porcentagem
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'AMBOS', COALESCE(NULLIF($8, '')::date, CURRENT_DATE), 'NAO_INICIADO', 0);`,
        capId,
        alunoId,
        ord,
        item.titulo,
        item.descricao,
        item.estimativaPaginas,
        item.fase,
        prazoPlan
      );

      ord++;
    }

    revalidatePath("/roadmap");
    revalidatePath(`/alunos/${alunoId}`);

    return { ok: true, totalCriados: lista.length };
  } catch (err: any) {
    return { ok: false, erro: err?.message || "Erro ao aplicar template" };
  }
}


/**
 * Alterna o status de uma tarefa vinculada a um marco/atividade
 */
export async function alternarStatusTarefaMarco(
  tarefaId: string,
  novoStatus: "ABERTA" | "CONCLUIDA",
  alunoId: string
): Promise<{ ok: boolean; erro?: string }> {
  try {
    await garantirTabelasRoadmap();
    const session = await auth();
    if (!session?.user) throw new Error("Não autenticado");

    const concluidaEm = novoStatus === "CONCLUIDA" ? new Date().toISOString() : null;

    await prisma.$executeRawUnsafe(
      `UPDATE tarefa
       SET status = $1,
           "concluidaEm" = $2::timestamp
       WHERE id = $3;`,
      novoStatus,
      concluidaEm,
      tarefaId
    );

    if (novoStatus === "CONCLUIDA") {
      try {
        await prisma.alerta.updateMany({
          where: {
            alunoId,
            mensagem: { contains: tarefaId },
            resolvido: false,
          },
          data: { resolvido: true },
        });
        await prisma.alerta.updateMany({
          where: {
            alunoId,
            mensagem: { contains: "INATIVIDADE_ATIVIDADES" },
            resolvido: false,
          },
          data: { resolvido: true },
        });
      } catch {}
    }

    revalidatePath("/roadmap");
    revalidatePath(`/alunos/${alunoId}`);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, erro: err?.message || "Erro ao atualizar status da tarefa" };
  }
}

/**
 * Altera rapidamente o status de um marco/atividade (ex: NÃO_INICIADO, EM_ANDAMENTO, CONCLUIDO)
 */
export async function atualizarStatusRapidoMarco(
  marcoId: string,
  novoStatus: StatusMarco,
  alunoId: string
): Promise<{ ok: boolean; erro?: string }> {
  try {
    return await atualizarMarcoRoadmap(marcoId, {
      status: novoStatus,
      porcentagem: novoStatus === "CONCLUIDO" ? 100 : novoStatus === "NAO_INICIADO" ? 0 : 50,
      prazoRealizado: novoStatus === "CONCLUIDO" ? new Date().toISOString().split("T")[0] : null,
    });
  } catch (err: any) {
    return { ok: false, erro: err?.message || "Erro ao atualizar status" };
  }
}


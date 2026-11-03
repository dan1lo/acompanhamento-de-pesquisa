"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type ResponsavelTipo = "ALUNO" | "PROFESSOR" | "AMBOS";

export interface TarefaReuniaoItem {
  id: string;
  titulo: string;
  descricao?: string | null;
  responsavel?: string | null;
  responsavelTipo: ResponsavelTipo;
  prazo?: string | null; // YYYY-MM-DD
  status: "ABERTA" | "CONCLUIDA";
  concluidaEm?: string | null;
  criadoEm: string;
  reuniaoId: string;
  reuniaoDataStr: string;
  marcoId?: string | null;
  marcoTitulo?: string | null;
  atrasada: boolean;
}

export interface ReuniaoComAtividades {
  id: string;
  data: string; // ISO
  dataStr: string; // YYYY-MM-DD
  horarioStr: string;
  pauta?: string | null;
  status: "AGENDADA" | "REALIZADA" | "CANCELADA" | "FALTA";
  tarefas: TarefaReuniaoItem[];
  comparativoComAnterior?: {
    reuniaoAnteriorId: string;
    reuniaoAnteriorDataStr: string;
    evoluiuTarefas: TarefaReuniaoItem[];
    estagnouTarefas: TarefaReuniaoItem[];
  } | null;
}

export interface IndicadorPeriodo {
  total: number;
  concluidas: number;
  pendentes: number;
  atrasadas: number;
  taxaConclusao: number; // 0 a 100
}

export interface GestaoAtividadesResponse {
  alunoId: string;
  alunoNome: string;
  alunoEmail: string;
  orientadorNome?: string;
  isAluno: boolean;
  reunioes: ReuniaoComAtividades[];
  todasTarefas: TarefaReuniaoItem[];
  indicadores: {
    ultimos30Dias: IndicadorPeriodo;
    ultimos60Dias: IndicadorPeriodo;
    semestre: IndicadorPeriodo;
    geral: IndicadorPeriodo;
  };
  orientandos?: Array<{ id: string; nome: string; nivel: string }>;
}

let colunasGarantidas = false;

async function garantirColunas() {
  if (colunasGarantidas) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE tarefa ADD COLUMN IF NOT EXISTS "responsavelTipo" TEXT DEFAULT 'ALUNO';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE tarefa ADD COLUMN IF NOT EXISTS "marcoId" TEXT;
    `);
    colunasGarantidas = true;
  } catch (err) {
    console.warn("Aviso ao garantir colunas de tarefa:", err);
  }
}

export async function obterGestaoAtividades(
  alunoIdAlvo?: string
): Promise<GestaoAtividadesResponse> {
  await garantirColunas();

  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Não autenticado");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    include: {
      aluno: true,
      alunosOrientados: {
        where: { arquivado: false },
        select: { id: true, nome: true, nivel: true },
      },
    },
  });

  if (!usuario) {
    throw new Error("Usuário não encontrado");
  }

  const isAluno = usuario.papel === "ALUNO";
  let targetAlunoId: string;

  if (isAluno) {
    if (!usuario.aluno) {
      throw new Error("Registro de aluno não encontrado");
    }
    targetAlunoId = usuario.aluno.id;
  } else {
    if (alunoIdAlvo) {
      targetAlunoId = alunoIdAlvo;
    } else if (usuario.alunosOrientados.length > 0) {
      targetAlunoId = usuario.alunosOrientados[0].id;
    } else {
      return {
        alunoId: "",
        alunoNome: "",
        alunoEmail: "",
        isAluno: false,
        reunioes: [],
        todasTarefas: [],
        indicadores: {
          ultimos30Dias: { total: 0, concluidas: 0, pendentes: 0, atrasadas: 0, taxaConclusao: 0 },
          ultimos60Dias: { total: 0, concluidas: 0, pendentes: 0, atrasadas: 0, taxaConclusao: 0 },
          semestre: { total: 0, concluidas: 0, pendentes: 0, atrasadas: 0, taxaConclusao: 0 },
          geral: { total: 0, concluidas: 0, pendentes: 0, atrasadas: 0, taxaConclusao: 0 },
        },
        orientandos: [],
      };
    }
  }

  const aluno = await prisma.aluno.findUnique({
    where: { id: targetAlunoId },
    include: {
      orientador: { select: { id: true, nome: true } },
    },
  });

  if (!aluno) {
    throw new Error("Aluno não encontrado");
  }

  // Buscar todas as reuniões do aluno ordenadas da mais antiga para a mais recente
  const reunioesDb = await prisma.reuniao.findMany({
    where: { alunoId: targetAlunoId },
    orderBy: { data: "asc" },
  });

  // Buscar tarefas vinculadas a reuniões ou do aluno
  interface TarefaRow {
    id: string;
    titulo: string;
    descricao: string | null;
    responsavel: string | null;
    responsavelTipo: string | null;
    prazo: Date | null;
    status: string;
    concluidaEm: Date | null;
    criadoEm: Date;
    reuniaoId: string | null;
    marcoId: string | null;
  }

  const tarefasRows = await prisma.$queryRawUnsafe<TarefaRow[]>(
    `SELECT id, titulo, descricao, responsavel, "responsavelTipo", prazo, status, "concluidaEm", "criadoEm", "reuniaoId", "marcoId"
     FROM tarefa
     WHERE "alunoId" = $1
     ORDER BY "criadoEm" ASC`,
    targetAlunoId
  );

  // Buscar títulos dos marcos para mapeamento
  interface MarcoMini {
    id: string;
    titulo: string;
  }
  let marcosMap: Record<string, string> = {};
  try {
    const marcos = await prisma.$queryRawUnsafe<MarcoMini[]>(
      `SELECT id, titulo FROM marco_roadmap WHERE "alunoId" = $1`,
      targetAlunoId
    );
    for (const m of marcos) {
      marcosMap[m.id] = m.titulo;
    }
  } catch {}

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Mapear tarefas estruturadas
  const todasTarefasFormatadas: TarefaReuniaoItem[] = tarefasRows.map((t) => {
    let prazoStr: string | null = null;
    let atrasada = false;
    if (t.prazo) {
      const p = new Date(t.prazo);
      prazoStr = p.toISOString().slice(0, 10);
      if (t.status === "ABERTA" && p < hoje) {
        atrasada = true;
      }
    }

    const reuniaoVinculada = reunioesDb.find((r) => r.id === t.reuniaoId);
    const reuniaoDataStr = reuniaoVinculada
      ? new Date(reuniaoVinculada.data).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "Avulsa";

    let respTipo: ResponsavelTipo = "ALUNO";
    if (t.responsavelTipo === "PROFESSOR") respTipo = "PROFESSOR";
    else if (t.responsavelTipo === "AMBOS") respTipo = "AMBOS";

    return {
      id: t.id,
      titulo: t.titulo,
      descricao: t.descricao,
      responsavel: t.responsavel,
      responsavelTipo: respTipo,
      prazo: prazoStr,
      status: t.status === "CONCLUIDA" ? "CONCLUIDA" : "ABERTA",
      concluidaEm: t.concluidaEm ? new Date(t.concluidaEm).toISOString() : null,
      criadoEm: new Date(t.criadoEm).toISOString(),
      reuniaoId: t.reuniaoId || "",
      reuniaoDataStr,
      marcoId: t.marcoId,
      marcoTitulo: t.marcoId ? marcosMap[t.marcoId] || null : null,
      atrasada,
    };
  });

  // Agrupar tarefas por reunião e calcular comparativo entre reuniões sucessivas
  const reunioesComAtividades: ReuniaoComAtividades[] = [];

  for (let i = 0; i < reunioesDb.length; i++) {
    const r = reunioesDb[i];
    const dataObj = new Date(r.data);
    const dataStr = dataObj.toISOString().slice(0, 10);
    const horarioStr = dataObj.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const tarefasDestaReuniao = todasTarefasFormatadas.filter(
      (t) => t.reuniaoId === r.id
    );

    let comparativoComAnterior: ReuniaoComAtividades["comparativoComAnterior"] = null;

    if (i > 0) {
      const rAnterior = reunioesDb[i - 1];
      const dataAnteriorObj = new Date(rAnterior.data);
      const dataAnteriorStr = dataAnteriorObj.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const tarefasAnterior = todasTarefasFormatadas.filter(
        (t) => t.reuniaoId === rAnterior.id
      );

      // Evoluiu: tarefas da reunião anterior concluídas
      const evoluiuTarefas = tarefasAnterior.filter((t) => t.status === "CONCLUIDA");
      // Estagnou: tarefas da reunião anterior que ainda continuam abertas ou atrasadas
      const estagnouTarefas = tarefasAnterior.filter((t) => t.status === "ABERTA");

      comparativoComAnterior = {
        reuniaoAnteriorId: rAnterior.id,
        reuniaoAnteriorDataStr: dataAnteriorStr,
        evoluiuTarefas,
        estagnouTarefas,
      };
    }

    reunioesComAtividades.push({
      id: r.id,
      data: dataObj.toISOString(),
      dataStr,
      horarioStr,
      pauta: r.pauta,
      status: r.status as any,
      tarefas: tarefasDestaReuniao,
      comparativoComAnterior,
    });
  }

  // Ordenar reuniões da mais recente para a mais antiga para exibição
  reunioesComAtividades.reverse();

  // Calcular indicadores por período
  const agoraTimestamp = Date.now();
  const diaMs = 24 * 60 * 60 * 1000;

  function calcularIndicador(diasLimite?: number): IndicadorPeriodo {
    const filtradas = diasLimite
      ? todasTarefasFormatadas.filter((t) => {
          const diff = agoraTimestamp - new Date(t.criadoEm).getTime();
          return diff <= diasLimite * diaMs;
        })
      : todasTarefasFormatadas;

    const total = filtradas.length;
    const concluidas = filtradas.filter((t) => t.status === "CONCLUIDA").length;
    const atrasadas = filtradas.filter((t) => t.atrasada).length;
    const pendentes = total - concluidas;
    const taxaConclusao = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    return { total, concluidas, pendentes, atrasadas, taxaConclusao };
  }

  const indicadores = {
    ultimos30Dias: calcularIndicador(30),
    ultimos60Dias: calcularIndicador(60),
    semestre: calcularIndicador(180),
    geral: calcularIndicador(),
  };

  return {
    alunoId: aluno.id,
    alunoNome: aluno.nome,
    alunoEmail: aluno.email,
    orientadorNome: aluno.orientador?.nome,
    isAluno,
    reunioes: reunioesComAtividades,
    todasTarefas: todasTarefasFormatadas,
    indicadores,
    orientandos: usuario.alunosOrientados.map((a) => ({
      id: a.id,
      nome: a.nome,
      nivel: a.nivel,
    })),
  };
}

export async function criarTarefaReuniao(dados: {
  alunoId: string;
  reuniaoId: string;
  titulo: string;
  descricao?: string;
  responsavel?: string;
  responsavelTipo: ResponsavelTipo;
  prazo?: string;
  marcoId?: string;
}) {
  await garantirColunas();

  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");

  if (!dados.titulo.trim()) {
    throw new Error("O título da tarefa é obrigatório");
  }

  const prazoDate = dados.prazo ? new Date(`${dados.prazo}T12:00:00Z`) : null;

  const nova = await prisma.tarefa.create({
    data: {
      alunoId: dados.alunoId,
      reuniaoId: dados.reuniaoId || null,
      titulo: dados.titulo.trim(),
      descricao: dados.descricao?.trim() || null,
      responsavel: dados.responsavel?.trim() || null,
      prazo: prazoDate,
      status: "ABERTA",
    },
  });

  // Atualiza colunas customizadas
  await prisma.$executeRawUnsafe(
    `UPDATE tarefa SET "responsavelTipo" = $1, "marcoId" = $2 WHERE id = $3`,
    dados.responsavelTipo,
    dados.marcoId || null,
    nova.id
  );

  revalidatePath("/reunioes");
  revalidatePath(`/alunos/${dados.alunoId}`);
  return { ok: true, id: nova.id };
}

export async function atualizarStatusTarefaReuniao(
  tarefaId: string,
  novoStatus: "ABERTA" | "CONCLUIDA"
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");

  const concluidaEm = novoStatus === "CONCLUIDA" ? new Date() : null;

  await prisma.tarefa.update({
    where: { id: tarefaId },
    data: {
      status: novoStatus,
      concluidaEm,
    },
  });

  revalidatePath("/reunioes");
  return { ok: true };
}

export async function atualizarTarefaReuniao(
  tarefaId: string,
  dados: {
    titulo: string;
    descricao?: string;
    responsavel?: string;
    responsavelTipo: ResponsavelTipo;
    prazo?: string;
    status?: "ABERTA" | "CONCLUIDA";
    marcoId?: string;
  }
) {
  await garantirColunas();

  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");

  const prazoDate = dados.prazo ? new Date(`${dados.prazo}T12:00:00Z`) : null;
  const concluidaEm = dados.status === "CONCLUIDA" ? new Date() : null;

  await prisma.tarefa.update({
    where: { id: tarefaId },
    data: {
      titulo: dados.titulo.trim(),
      descricao: dados.descricao?.trim() || null,
      responsavel: dados.responsavel?.trim() || null,
      prazo: prazoDate,
      ...(dados.status ? { status: dados.status, concluidaEm } : {}),
    },
  });

  await prisma.$executeRawUnsafe(
    `UPDATE tarefa SET "responsavelTipo" = $1, "marcoId" = $2 WHERE id = $3`,
    dados.responsavelTipo,
    dados.marcoId || null,
    tarefaId
  );

  revalidatePath("/reunioes");
  return { ok: true };
}

export async function excluirTarefaReuniao(tarefaId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");

  await prisma.tarefa.delete({
    where: { id: tarefaId },
  });

  revalidatePath("/reunioes");
  return { ok: true };
}


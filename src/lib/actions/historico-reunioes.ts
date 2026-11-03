"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface ItemHistoricoReuniao {
  id: string;
  data: string; // ISO
  dataStr: string; // DD/MM/YYYY
  dataOrdenacao: string; // YYYY-MM-DD
  horarioStr: string;
  status: "AGENDADA" | "REALIZADA" | "CANCELADA" | "FALTA";
  pauta: string | null;
  meetLink: string | null;
  googleEventId: string | null;
  alunoId: string;
  alunoNome: string;
  alunoEmail: string;
  orientadorId: string;
  orientadorNome: string;
  orientadorEmail: string;
  // Ata / Resumo
  resumoId?: string | null;
  decisoes?: string | null;
  combinados?: string | null;
  duvidasAbertas?: string | null;
  proximosPassos?: string | null;
  // Tarefas geradas no encontro
  tarefasGeradas: Array<{
    id: string;
    titulo: string;
    responsavel?: string | null;
    responsavelTipo?: string | null;
    prazo?: string | null;
    status: "ABERTA" | "CONCLUIDA";
  }>;
  // Pendências da reunião anterior
  pendenciasAnterior: Array<{
    id: string;
    titulo: string;
    responsavel?: string | null;
    responsavelTipo?: string | null;
    prazo?: string | null;
    status: "ABERTA" | "CONCLUIDA";
    reuniaoOrigemDataStr: string;
  }>;
}

export interface HistoricoReunioesResponse {
  alunoId: string;
  alunoNome: string;
  alunoEmail: string;
  orientadorNome?: string;
  isAluno: boolean;
  reunioes: ItemHistoricoReuniao[];
  estatisticas: {
    total: number;
    realizadas: number;
    agendadas: number;
    canceladas: number;
    faltas: number;
  };
  orientandos?: Array<{ id: string; nome: string; nivel: string }>;
}

export async function obterHistoricoReunioes(
  alunoIdAlvo?: string
): Promise<HistoricoReunioesResponse> {
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
        estatisticas: {
          total: 0,
          realizadas: 0,
          agendadas: 0,
          canceladas: 0,
          faltas: 0,
        },
        orientandos: [],
      };
    }
  }

  const aluno = await prisma.aluno.findUnique({
    where: { id: targetAlunoId },
    include: {
      orientador: { select: { id: true, nome: true, email: true } },
    },
  });

  if (!aluno) {
    throw new Error("Aluno não encontrado");
  }

  // Buscar todas as reuniões do aluno ordenadas da mais antiga para a mais recente para vincular pendências anteriores
  const reunioesDb = await prisma.reuniao.findMany({
    where: { alunoId: targetAlunoId },
    include: {
      resumo: true,
      tarefas: {
        select: {
          id: true,
          titulo: true,
          responsavel: true,
          prazo: true,
          status: true,
          reuniaoId: true,
        },
      },
    },
    orderBy: { data: "asc" },
  });

  // Buscar também responsavelTipo para tarefas
  interface TarefaExtra {
    id: string;
    responsavelTipo?: string | null;
  }
  let extraTarefasMap: Record<string, string> = {};
  try {
    const extras = await prisma.$queryRawUnsafe<TarefaExtra[]>(
      `SELECT id, "responsavelTipo" FROM tarefa WHERE "alunoId" = $1`,
      targetAlunoId
    );
    for (const ex of extras) {
      if (ex.responsavelTipo) {
        extraTarefasMap[ex.id] = ex.responsavelTipo;
      }
    }
  } catch {}

  const itensHistorico: ItemHistoricoReuniao[] = [];

  for (let i = 0; i < reunioesDb.length; i++) {
    const r = reunioesDb[i];
    const dataObj = new Date(r.data);
    const dataStr = dataObj.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const dataOrdenacao = dataObj.toISOString().slice(0, 10);
    const horarioStr = dataObj.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const tarefasGeradas = r.tarefas.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      responsavel: t.responsavel,
      responsavelTipo: extraTarefasMap[t.id] || "ALUNO",
      prazo: t.prazo ? new Date(t.prazo).toISOString().slice(0, 10) : null,
      status: t.status as "ABERTA" | "CONCLUIDA",
    }));

    // Pendências da reunião anterior
    const pendenciasAnterior: ItemHistoricoReuniao["pendenciasAnterior"] = [];
    if (i > 0) {
      const rAnterior = reunioesDb[i - 1];
      const dataAntStr = new Date(rAnterior.data).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      for (const tAnt of rAnterior.tarefas) {
        if (tAnt.status === "ABERTA") {
          pendenciasAnterior.push({
            id: tAnt.id,
            titulo: tAnt.titulo,
            responsavel: tAnt.responsavel,
            responsavelTipo: extraTarefasMap[tAnt.id] || "ALUNO",
            prazo: tAnt.prazo ? new Date(tAnt.prazo).toISOString().slice(0, 10) : null,
            status: "ABERTA",
            reuniaoOrigemDataStr: dataAntStr,
          });
        }
      }
    }

    itensHistorico.push({
      id: r.id,
      data: dataObj.toISOString(),
      dataStr,
      dataOrdenacao,
      horarioStr,
      status: r.status as any,
      pauta: r.pauta,
      meetLink: r.meetLink,
      googleEventId: r.googleEventId,
      alunoId: aluno.id,
      alunoNome: aluno.nome,
      alunoEmail: aluno.email,
      orientadorId: aluno.orientadorId,
      orientadorNome: aluno.orientador?.nome || "Orientador",
      orientadorEmail: aluno.orientador?.email || "",
      resumoId: r.resumo?.id || null,
      decisoes: r.resumo?.decisoes || null,
      combinados: r.resumo?.combinados || null,
      duvidasAbertas: r.resumo?.duvidasAbertas || null,
      proximosPassos: r.resumo?.proximosPassos || null,
      tarefasGeradas,
      pendenciasAnterior,
    });
  }

  // Ordenar da mais recente para a mais antiga para exibição de timeline
  itensHistorico.reverse();

  const estatisticas = {
    total: itensHistorico.length,
    realizadas: itensHistorico.filter((r) => r.status === "REALIZADA").length,
    agendadas: itensHistorico.filter((r) => r.status === "AGENDADA").length,
    canceladas: itensHistorico.filter((r) => r.status === "CANCELADA").length,
    faltas: itensHistorico.filter((r) => r.status === "FALTA").length,
  };

  return {
    alunoId: aluno.id,
    alunoNome: aluno.nome,
    alunoEmail: aluno.email,
    orientadorNome: aluno.orientador?.nome,
    isAluno,
    reunioes: itensHistorico,
    estatisticas,
    orientandos: usuario.alunosOrientados.map((a) => ({
      id: a.id,
      nome: a.nome,
      nivel: a.nivel,
    })),
  };
}

export async function salvarAtaReuniao(
  reuniaoId: string,
  dados: {
    pauta?: string;
    decisoes?: string;
    combinados?: string;
    duvidasAbertas?: string;
    proximosPassos?: string;
  }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");

  const reuniao = await prisma.reuniao.findUnique({
    where: { id: reuniaoId },
    include: { resumo: true },
  });

  if (!reuniao) throw new Error("Reunião não encontrada");

  // Atualizar pauta na reunião se fornecido
  if (dados.pauta !== undefined) {
    await prisma.reuniao.update({
      where: { id: reuniaoId },
      data: { pauta: dados.pauta.trim() || null },
    });
  }

  // Upsert no Resumo
  if (reuniao.resumo) {
    await prisma.resumo.update({
      where: { id: reuniao.resumo.id },
      data: {
        decisoes: dados.decisoes?.trim() || null,
        combinados: dados.combinados?.trim() || null,
        duvidasAbertas: dados.duvidasAbertas?.trim() || null,
        proximosPassos: dados.proximosPassos?.trim() || null,
        publicadoEm: new Date(),
      },
    });
  } else {
    await prisma.resumo.create({
      data: {
        reuniaoId,
        autorId: session.user.id,
        decisoes: dados.decisoes?.trim() || null,
        combinados: dados.combinados?.trim() || null,
        duvidasAbertas: dados.duvidasAbertas?.trim() || null,
        proximosPassos: dados.proximosPassos?.trim() || null,
        publicadoEm: new Date(),
        status: "PUBLICADO",
      },
    });
  }

  revalidatePath("/reunioes");
  return { ok: true };
}

export async function atualizarStatusReuniao(
  reuniaoId: string,
  novoStatus: "AGENDADA" | "REALIZADA" | "CANCELADA" | "FALTA"
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");

  await prisma.reuniao.update({
    where: { id: reuniaoId },
    data: {
      status: novoStatus,
      falta: novoStatus === "FALTA",
    },
  });

  revalidatePath("/reunioes");
  return { ok: true };
}


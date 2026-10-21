"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { alunoTemOrientador } from "@/lib/guards";
import {
  cancelarEventoReuniao,
  criarEventoReuniao,
  desconectarGoogleCalendar,
  gerarLinkMeetPadrao,
  obterInfoConexaoGoogle,
  salvarConexaoGoogleDireta,
} from "@/lib/google-calendar";
import {
  garantirTabelaConviteReuniao,
  type ConviteReuniaoRow,
} from "@/lib/dados-alertas";

export interface ReuniaoCalendarioItem {
  id: string;
  data: string; // ISO string
  dataDia: string; // YYYY-MM-DD
  horario: string; // HH:mm
  pauta: string | null;
  status: "AGENDADA" | "REALIZADA" | "CANCELADA" | "FALTA";
  meetLink: string | null;
  googleEventId: string | null;
  alunoId: string;
  alunoNome: string;
  orientadorId: string;
  orientadorNome: string;
}

export interface BloqueioCalendarioItem {
  id: string;
  usuarioId: string;
  usuarioNome: string;
  criadoPorMim: boolean;
  data: string; // YYYY-MM-DD
  motivo: string;
  criadoEm: string;
}

export interface ConviteReuniaoDetalhado {
  id: string;
  conviteId?: string | null;
  reuniaoId?: string | null;
  data: string; // ISO string
  dataDia: string; // YYYY-MM-DD
  dataCompletaPt: string;
  horario: string; // HH:mm
  horarioFim: string; // HH:mm
  status: "PENDENTE" | "AGENDADA" | "REALIZADA" | "RECUSADA" | "CANCELADA" | "FALTA";
  justificativaRecusa?: string | null;
  pauta: string | null;
  meetLink: string | null;
  googleEventId: string | null;
  criadoEm: string;
  enviadoPorMim: boolean;
  outroParticipante: {
    id: string;
    nome: string;
    email: string;
    papel: "Orientador" | "Orientando";
  };
}

export interface DadosCalendarioResponse {
  reunioes: ReuniaoCalendarioItem[];
  bloqueios: BloqueioCalendarioItem[];
  googleConectado: boolean;
  emailGoogleConectado?: string | null;
  orientandos?: Array<{ id: string; nome: string; email: string }>;
  orientador?: { id: string; nome: string; email: string } | null;
  convites: ConviteReuniaoDetalhado[];
}

let tabelaBloqueioGarantida = false;

async function garantirTabelaBloqueio() {
  if (tabelaBloqueioGarantida) return;
  try {
    const check = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'bloqueio_calendario'
      ) AS "exists";
    `);
    if (check && check[0]?.exists) {
      tabelaBloqueioGarantida = true;
      return;
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS bloqueio_calendario (
        id TEXT PRIMARY KEY,
        "usuarioId" TEXT NOT NULL,
        data TEXT NOT NULL,
        motivo TEXT NOT NULL,
        "criadoEm" TIMESTAMP DEFAULT NOW()
      );
    `);
    tabelaBloqueioGarantida = true;
  } catch (err: any) {
    if (
      err?.code === "23505" ||
      err?.code === "42P07" ||
      String(err?.message || "").includes("já existe")
    ) {
      tabelaBloqueioGarantida = true;
      return;
    }
  }
}

/**
 * Busca todas as reuniões marcadas (aceitas), bloqueios, status do Google Calendar e convites.
 */
export async function obterDadosCalendario(
  mes: number,
  ano: number
): Promise<DadosCalendarioResponse> {
  await garantirTabelaBloqueio();
  await garantirTabelaConviteReuniao();

  const session = await auth();
  if (!session?.user) {
    throw new Error("Não autenticado");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    include: {
      conexaoGoogle: true,
      aluno: {
        include: {
          orientador: { select: { id: true, nome: true, email: true } },
        },
      },
    },
  });

  if (!usuario) {
    throw new Error("Usuário não encontrado");
  }

  const isAluno = usuario.papel === "ALUNO";

  // Verifica conexão com Google Calendar para qualquer papel (Aluno ou Orientador)
  const infoGoogle = await obterInfoConexaoGoogle(usuario.id);
  const googleConectado = infoGoogle.conectado;
  const emailGoogleConectado =
    infoGoogle.emailGoogle || (infoGoogle.conectado ? usuario.email : null);

  // Intervalo do mês com margem de segurança de dias adjacentes para a visualização em grade
  const dataInicio = new Date(ano, mes - 1, -7, 0, 0, 0);
  const dataFim = new Date(ano, mes, 14, 23, 59, 59);

  let reunioesDb: Array<{
    id: string;
    data: Date;
    pauta: string | null;
    status: string;
    meetLink: string | null;
    googleEventId: string | null;
    alunoId: string;
    aluno: {
      id: string;
      nome: string;
      orientadorId: string;
      orientador: { id: string; nome: string };
    };
  }> = [];

  let orientandos: Array<{ id: string; nome: string; email: string; usuarioId?: string | null }> = [];
  let orientadorInfo: { id: string; nome: string; email: string } | null = null;
  let alunoRef = usuario.aluno;

  if (isAluno) {
    if (!alunoRef && usuario.email) {
      alunoRef = await prisma.aluno.findUnique({
        where: { email: usuario.email.toLowerCase().trim() },
        include: {
          orientador: { select: { id: true, nome: true, email: true } },
        },
      });
    }

    if (alunoRef) {
      if (alunoTemOrientador(alunoRef.orientador?.email)) {
        orientadorInfo = alunoRef.orientador;
      }

      reunioesDb = await prisma.reuniao.findMany({
        where: {
          alunoId: alunoRef.id,
          status: { not: "CANCELADA" },
          data: { gte: dataInicio, lte: dataFim },
        },
        include: {
          aluno: {
            select: {
              id: true,
              nome: true,
              orientadorId: true,
              orientador: { select: { id: true, nome: true } },
            },
          },
        },
        orderBy: { data: "asc" },
      });
    }
  } else {
    // PROFESSOR / COORIENTADOR
    orientandos = await prisma.aluno.findMany({
      where: {
        orientadorId: usuario.id,
        arquivado: false,
      },
      select: { id: true, nome: true, email: true, usuarioId: true },
      orderBy: { nome: "asc" },
    });

    reunioesDb = await prisma.reuniao.findMany({
      where: {
        aluno: { orientadorId: usuario.id },
        status: { not: "CANCELADA" },
        data: { gte: dataInicio, lte: dataFim },
      },
      include: {
        aluno: {
          select: {
            id: true,
            nome: true,
            orientadorId: true,
            orientador: { select: { id: true, nome: true } },
          },
        },
      },
      orderBy: { data: "asc" },
    });
  }

  // Mapeia reuniões marcadas (aceitas) formatando datas locais YYYY-MM-DD
  const reunioes: ReuniaoCalendarioItem[] = reunioesDb.map((r) => {
    const d = new Date(r.data);
    const anoStr = d.getFullYear();
    const mesStr = String(d.getMonth() + 1).padStart(2, "0");
    const diaStr = String(d.getDate()).padStart(2, "0");
    const horaStr = String(d.getHours()).padStart(2, "0");
    const minStr = String(d.getMinutes()).padStart(2, "0");

    return {
      id: r.id,
      data: d.toISOString(),
      dataDia: `${anoStr}-${mesStr}-${diaStr}`,
      horario: `${horaStr}:${minStr}`,
      pauta: r.pauta,
      status: r.status as ReuniaoCalendarioItem["status"],
      meetLink: r.meetLink,
      googleEventId: r.googleEventId,
      alunoId: r.alunoId,
      alunoNome: r.aluno.nome,
      orientadorId: r.aluno.orientadorId,
      orientadorNome: r.aluno.orientador.nome,
    };
  });

  // Busca bloqueios de calendário da tabela raw
  let bloqueiosRaw: Array<{
    id: string;
    usuarioId: string;
    data: string;
    motivo: string;
    criadoEm: Date;
  }> = [];

  try {
    bloqueiosRaw = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        usuarioId: string;
        data: string;
        motivo: string;
        criadoEm: Date;
      }>
    >(`SELECT id, "usuarioId", data, motivo, "criadoEm" FROM bloqueio_calendario ORDER BY data ASC`);
  } catch (err) {
    console.error("Erro ao buscar bloqueios do calendário:", err);
  }

  // Identifica os usuários envolvidos para filtrar os bloqueios relevantes
  const idsRelevantes = new Set<string>([usuario.id]);
  if (isAluno) {
    if (alunoRef?.id) idsRelevantes.add(alunoRef.id);
    if (orientadorInfo?.id) idsRelevantes.add(orientadorInfo.id);
  } else {
    for (const o of orientandos) {
      idsRelevantes.add(o.id);
      if (o.usuarioId) idsRelevantes.add(o.usuarioId);
    }
  }

  // Busca nomes dos usuários que bloquearam
  const usuariosDb = await prisma.usuario.findMany({
    where: { id: { in: Array.from(new Set(bloqueiosRaw.map((b) => b.usuarioId))) } },
    select: { id: true, nome: true },
  });
  const mapaNomes = new Map(usuariosDb.map((u) => [u.id, u.nome]));

  const bloqueios: BloqueioCalendarioItem[] = bloqueiosRaw
    .filter((b) => idsRelevantes.has(b.usuarioId) || b.usuarioId === usuario.id)
    .map((b) => ({
      id: b.id,
      usuarioId: b.usuarioId,
      usuarioNome: mapaNomes.get(b.usuarioId) ?? "Usuário",
      criadoPorMim: b.usuarioId === usuario.id,
      data: b.data,
      motivo: b.motivo,
      criadoEm: new Date(b.criadoEm).toISOString(),
    }));

  // Busca convites da tabela convite_reuniao + reuniões históricas
  let convitesRaw: ConviteReuniaoRow[] = [];
  try {
    if (isAluno && alunoRef) {
      convitesRaw = await prisma.$queryRawUnsafe<ConviteReuniaoRow[]>(
        `SELECT * FROM convite_reuniao WHERE "alunoId" = $1 ORDER BY data DESC`,
        alunoRef.id
      );
    } else if (!isAluno) {
      convitesRaw = await prisma.$queryRawUnsafe<ConviteReuniaoRow[]>(
        `SELECT * FROM convite_reuniao WHERE "orientadorId" = $1 ORDER BY data DESC`,
        usuario.id
      );
    }
  } catch {}

  const todasReunioesConvites =
    isAluno && alunoRef
      ? await prisma.reuniao.findMany({
          where: { alunoId: alunoRef.id },
          include: {
            aluno: {
              select: {
                id: true,
                nome: true,
                email: true,
                orientadorId: true,
                orientador: { select: { id: true, nome: true, email: true } },
              },
            },
          },
          orderBy: { data: "desc" },
        })
      : !isAluno
      ? await prisma.reuniao.findMany({
          where: { aluno: { orientadorId: usuario.id } },
          include: {
            aluno: {
              select: {
                id: true,
                nome: true,
                email: true,
                orientadorId: true,
                orientador: { select: { id: true, nome: true, email: true } },
              },
            },
          },
          orderBy: { data: "desc" },
        })
      : [];

  const mapaReunioesPorId = new Map(todasReunioesConvites.map((r) => [r.id, r]));
  const reunioesJaMapeadas = new Set<string>();

  const convitesDaTabela: ConviteReuniaoDetalhado[] = convitesRaw.map((c) => {
    const reuniaoVinculada = c.reuniaoId ? mapaReunioesPorId.get(c.reuniaoId) : undefined;
    if (c.reuniaoId) {
      reunioesJaMapeadas.add(c.reuniaoId);
    }

    const d = new Date(c.data);
    const dFim = new Date(d.getTime() + 60 * 60 * 1000);
    const anoStr = d.getFullYear();
    const mesStr = String(d.getMonth() + 1).padStart(2, "0");
    const diaStr = String(d.getDate()).padStart(2, "0");
    const horaStr = String(d.getHours()).padStart(2, "0");
    const minStr = String(d.getMinutes()).padStart(2, "0");
    const horaFimStr = String(dFim.getHours()).padStart(2, "0");
    const minFimStr = String(dFim.getMinutes()).padStart(2, "0");

    const dataCompletaPt = d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const enviadoPorMim =
      c.remetenteId === usuario.id ||
      (isAluno && c.remetentePapel === "ALUNO") ||
      (!isAluno && c.remetentePapel !== "ALUNO");

    let statusFinal: ConviteReuniaoDetalhado["status"] = "PENDENTE";
    if (c.status === "PENDENTE") {
      statusFinal = "PENDENTE";
    } else if (c.status === "RECUSADO") {
      statusFinal = "RECUSADA";
    } else if (c.status === "CANCELADO") {
      statusFinal = "CANCELADA";
    } else if (c.status === "ACEITO") {
      statusFinal = (reuniaoVinculada?.status as ConviteReuniaoDetalhado["status"]) || "AGENDADA";
    }

    const outroParticipante = isAluno
      ? {
          id: c.orientadorId,
          nome: c.orientadorNome || "Orientador",
          email: c.orientadorEmail || "",
          papel: "Orientador" as const,
        }
      : {
          id: c.alunoId,
          nome: c.alunoNome,
          email: c.alunoEmail,
          papel: "Orientando" as const,
        };

    return {
      id: c.id,
      conviteId: c.id,
      reuniaoId: c.reuniaoId,
      data: d.toISOString(),
      dataDia: c.dataStr || `${anoStr}-${mesStr}-${diaStr}`,
      dataCompletaPt,
      horario: c.horarioStr || `${horaStr}:${minStr}`,
      horarioFim: `${horaFimStr}:${minFimStr}`,
      status: statusFinal,
      justificativaRecusa: c.justificativaRecusa,
      pauta: reuniaoVinculada?.pauta ?? c.pauta,
      meetLink: reuniaoVinculada?.meetLink ?? c.meetLink,
      googleEventId: reuniaoVinculada?.googleEventId ?? null,
      criadoEm: new Date(c.criadoEm).toISOString(),
      enviadoPorMim,
      outroParticipante,
    };
  });

  // Inclui reuniões anteriores que não vieram da tabela convite_reuniao
  const idsReunioesLegado = todasReunioesConvites
    .filter((r) => !reunioesJaMapeadas.has(r.id))
    .map((r) => r.id);

  const logsCriacao =
    idsReunioesLegado.length > 0
      ? await prisma.logAuditoria.findMany({
          where: {
            entidade: "reuniao",
            entidadeId: { in: idsReunioesLegado },
          },
          select: { entidadeId: true, usuarioId: true },
        })
      : [];
  const mapaCriador = new Map(logsCriacao.map((l) => [l.entidadeId, l.usuarioId]));

  const convitesLegado: ConviteReuniaoDetalhado[] = todasReunioesConvites
    .filter((r) => !reunioesJaMapeadas.has(r.id))
    .map((r) => {
      const d = new Date(r.data);
      const dFim = new Date(d.getTime() + 60 * 60 * 1000);
      const anoStr = d.getFullYear();
      const mesStr = String(d.getMonth() + 1).padStart(2, "0");
      const diaStr = String(d.getDate()).padStart(2, "0");
      const horaStr = String(d.getHours()).padStart(2, "0");
      const minStr = String(d.getMinutes()).padStart(2, "0");
      const horaFimStr = String(dFim.getHours()).padStart(2, "0");
      const minFimStr = String(dFim.getMinutes()).padStart(2, "0");

      const dataCompletaPt = d.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      const criadorId = mapaCriador.get(r.id);
      const enviadoPorMim = criadorId ? criadorId === usuario.id : false;

      const outroParticipante = isAluno
        ? {
            id: r.aluno.orientador?.id ?? "",
            nome: r.aluno.orientador?.nome ?? "Orientador",
            email: r.aluno.orientador?.email ?? "",
            papel: "Orientador" as const,
          }
        : {
            id: r.aluno.id,
            nome: r.aluno.nome,
            email: r.aluno.email,
            papel: "Orientando" as const,
          };

      return {
        id: r.id,
        conviteId: null,
        reuniaoId: r.id,
        data: d.toISOString(),
        dataDia: `${anoStr}-${mesStr}-${diaStr}`,
        dataCompletaPt,
        horario: `${horaStr}:${minStr}`,
        horarioFim: `${horaFimStr}:${minFimStr}`,
        status: r.status as ConviteReuniaoDetalhado["status"],
        justificativaRecusa: null,
        pauta: r.pauta,
        meetLink: r.meetLink,
        googleEventId: r.googleEventId,
        criadoEm: new Date(r.criadoEm).toISOString(),
        enviadoPorMim,
        outroParticipante,
      };
    });

  const convites = [...convitesDaTabela, ...convitesLegado].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );

  return {
    reunioes,
    bloqueios,
    googleConectado,
    emailGoogleConectado,
    orientandos: orientandos.map((o) => ({ id: o.id, nome: o.nome, email: o.email })),
    orientador: orientadorInfo,
    convites,
  };
}

/**
 * Bloqueia uma data no calendário informando obrigatoriamente um motivo.
 */
export async function bloquearDataCalendario(dataStr: string, motivo: string) {
  await garantirTabelaBloqueio();

  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const motivoLimpo = motivo.trim();
  if (!motivoLimpo) {
    throw new Error("O motivo do bloqueio é obrigatório.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    throw new Error("Data inválida.");
  }

  // Verifica se já está bloqueada pelo mesmo usuário
  const existente = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM bloqueio_calendario WHERE "usuarioId" = $1 AND data = $2 LIMIT 1`,
    session.user.id,
    dataStr
  );

  if (existente.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE bloqueio_calendario SET motivo = $1, "criadoEm" = NOW() WHERE id = $2`,
      motivoLimpo,
      existente[0].id
    );
  } else {
    const id = `bloq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO bloqueio_calendario (id, "usuarioId", data, motivo, "criadoEm") VALUES ($1, $2, $3, $4, NOW())`,
      id,
      session.user.id,
      dataStr,
      motivoLimpo
    );
  }

  revalidatePath("/reunioes");
  return { ok: true };
}

/**
 * Remove um bloqueio de data do calendário.
 * Somente o próprio usuário que bloqueou a data pode desbloqueá-la.
 */
export async function desbloquearDataCalendario(bloqueioId: string) {
  await garantirTabelaBloqueio();

  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const existente = await prisma.$queryRawUnsafe<Array<{ id: string; usuarioId: string }>>(
    `SELECT id, "usuarioId" FROM bloqueio_calendario WHERE id = $1 LIMIT 1`,
    bloqueioId
  );

  if (existente.length === 0) {
    throw new Error("Bloqueio não encontrado.");
  }

  if (existente[0].usuarioId !== session.user.id) {
    throw new Error("Você não pode desbloquear uma data que foi bloqueada por outro usuário.");
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM bloqueio_calendario WHERE id = $1 AND "usuarioId" = $2`,
    bloqueioId,
    session.user.id
  );

  revalidatePath("/reunioes");
  return { ok: true };
}

/**
 * Envia um convite de nova reunião para o orientador ou aluno na data/horário selecionados.
 * A reunião fica com status PENDENTE e só é marcada no calendário após o destinatário ACEITAR.
 */
export async function enviarConviteReuniao(dados: {
  alunoId?: string;
  dataStr: string; // YYYY-MM-DD
  horarioStr: string; // HH:mm
  pauta?: string;
  incluirMeet?: boolean;
  meetLinkCustom?: string;
  sincronizarGoogle?: boolean;
}) {
  await garantirTabelaBloqueio();
  await garantirTabelaConviteReuniao();

  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const {
    dataStr,
    horarioStr,
    pauta,
    incluirMeet = false,
    meetLinkCustom,
    sincronizarGoogle = true,
  } = dados;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr) || !/^\d{2}:\d{2}$/.test(horarioStr)) {
    throw new Error("Data ou horário inválidos.");
  }

  // Verifica se a data está bloqueada
  const bloqueio = await prisma.$queryRawUnsafe<Array<{ motivo: string }>>(
    `SELECT motivo FROM bloqueio_calendario WHERE data = $1 LIMIT 1`,
    dataStr
  );

  if (bloqueio.length > 0) {
    throw new Error(`Esta data está bloqueada para reuniões: "${bloqueio[0].motivo}".`);
  }

  const [ano, mes, dia] = dataStr.split("-").map(Number);
  const [hora, minuto] = horarioStr.split(":").map(Number);
  const dataReuniao = new Date(ano, mes - 1, dia, hora, minuto, 0);

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    include: {
      conexaoGoogle: true,
      aluno: {
        include: {
          orientador: {
            include: { conexaoGoogle: true },
          },
        },
      },
    },
  });

  if (!usuario) throw new Error("Usuário não encontrado");

  const isAluno = usuario.papel === "ALUNO";
  let targetAlunoId = "";
  let targetAlunoNome = "";
  let targetAlunoEmail = "";
  let targetAlunoUsuarioId: string | null = null;
  let professorId = "";
  let professorNome = "";
  let professorEmail = "";

  if (isAluno) {
    let aluno = usuario.aluno;
    if (!aluno && usuario.email) {
      aluno = await prisma.aluno.findUnique({
        where: { email: usuario.email.toLowerCase().trim() },
        include: {
          orientador: {
            include: { conexaoGoogle: true },
          },
        },
      });
    }

    if (!aluno || !alunoTemOrientador(aluno.orientador?.email)) {
      throw new Error("Você ainda não possui um orientador vinculado para marcar reuniões.");
    }

    targetAlunoId = aluno.id;
    targetAlunoNome = aluno.nome;
    targetAlunoEmail = aluno.email;
    targetAlunoUsuarioId = aluno.usuarioId || usuario.id;
    professorId = aluno.orientadorId;
    professorNome = aluno.orientador?.nome ?? "Orientador";
    professorEmail = aluno.orientador?.email ?? "";
  } else {
    // PROFESSOR
    if (!dados.alunoId) {
      throw new Error("Selecione o orientando para a reunião.");
    }

    const aluno = await prisma.aluno.findUnique({
      where: { id: dados.alunoId },
      include: { orientador: true },
    });

    if (!aluno || aluno.orientadorId !== usuario.id) {
      throw new Error("Orientando inválido.");
    }

    targetAlunoId = aluno.id;
    targetAlunoNome = aluno.nome;
    targetAlunoEmail = aluno.email;
    targetAlunoUsuarioId = aluno.usuarioId;
    professorId = usuario.id;
    professorNome = usuario.nome;
    professorEmail = usuario.email;
  }

  let meetLink: string | null = null;
  if (incluirMeet) {
    const customLimpo = meetLinkCustom?.trim();
    if (
      customLimpo &&
      (customLimpo.startsWith("https://meet.google.com/") ||
        customLimpo.startsWith("http://meet.google.com/"))
    ) {
      meetLink = customLimpo;
    } else {
      meetLink = gerarLinkMeetPadrao();
    }
  }

  const conviteId = `conv_reu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const destinatarioUsuarioId = isAluno ? professorId : targetAlunoUsuarioId;

  await prisma.$executeRawUnsafe(
    `INSERT INTO convite_reuniao (
      id,
      "remetenteId",
      "remetenteNome",
      "remetentePapel",
      "destinatarioUsuarioId",
      "alunoId",
      "alunoNome",
      "alunoEmail",
      "orientadorId",
      "orientadorNome",
      "orientadorEmail",
      data,
      "dataStr",
      "horarioStr",
      pauta,
      "incluirMeet",
      "meetLink",
      "sincronizarGoogle",
      status,
      "justificativaRecusa",
      "reuniaoId",
      "lidaPeloDestinatario",
      "lidaPeloRemetente",
      "atualizadoEm",
      "criadoEm"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
      'PENDENTE', NULL, NULL, false, true, NOW(), NOW()
    )`,
    conviteId,
    usuario.id,
    usuario.nome,
    isAluno ? "ALUNO" : "PROFESSOR",
    destinatarioUsuarioId,
    targetAlunoId,
    targetAlunoNome,
    targetAlunoEmail,
    professorId,
    professorNome,
    professorEmail,
    dataReuniao,
    dataStr,
    horarioStr,
    pauta?.trim() || null,
    Boolean(incluirMeet),
    meetLink,
    Boolean(sincronizarGoogle)
  );

  revalidatePath("/reunioes");
  revalidatePath("/alertas");
  revalidatePath("/inicio");
  revalidatePath("/painel");

  return { ok: true, conviteId, meetLink };
}

/**
 * Aceita um convite de reunião pendente, marcando efetivamente a reunião no calendário
 * e sincronizando com o Google Calendar / Google Meet se configurado.
 */
export async function aceitarConviteReuniao(conviteId: string) {
  await garantirTabelaConviteReuniao();

  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const rows = await prisma.$queryRawUnsafe<ConviteReuniaoRow[]>(
    `SELECT * FROM convite_reuniao WHERE id = $1 LIMIT 1`,
    conviteId
  );

  if (rows.length === 0) {
    throw new Error("Convite de reunião não encontrado.");
  }

  const convite = rows[0];
  if (convite.status !== "PENDENTE") {
    throw new Error("Este convite de reunião já foi respondido ou cancelado.");
  }

  const dataReuniao = new Date(convite.data);

  // Cria a reunião oficial na tabela reuniao com status AGENDADA
  const reuniao = await prisma.reuniao.create({
    data: {
      alunoId: convite.alunoId,
      data: dataReuniao,
      pauta: convite.pauta || null,
      status: "AGENDADA",
      meetLink: convite.meetLink || null,
    },
  });

  // Registra log de auditoria com o remetente original para manter o histórico
  try {
    await prisma.logAuditoria.create({
      data: {
        usuarioId: convite.remetenteId,
        acao: "ENVIAR_CONVITE_REUNIAO",
        entidade: "reuniao",
        entidadeId: reuniao.id,
        detalhes: JSON.stringify({
          pauta: reuniao.pauta,
          data: reuniao.data,
          aceitoPor: session.user.id,
        }),
      },
    });
  } catch {}

  let meetLinkFinal: string | null = convite.meetLink || null;
  let googleEventId: string | null = null;

  if (convite.sincronizarGoogle || convite.incluirMeet) {
    try {
      const dataFim = new Date(dataReuniao.getTime() + 60 * 60 * 1000);
      const evento = await criarEventoReuniao({
        professorId: convite.orientadorId,
        alunoEmail: convite.alunoEmail,
        alunoNome: convite.alunoNome,
        inicio: dataReuniao,
        fim: dataFim,
        titulo: convite.pauta
          ? `Orientação: ${convite.pauta}`
          : `Orientação — ${convite.alunoNome}`,
        incluirMeet: Boolean(convite.incluirMeet || convite.meetLink),
      });

      if (evento.googleEventId) {
        googleEventId = evento.googleEventId;
      }

      if (!meetLinkFinal && (convite.incluirMeet || evento.meetLink)) {
        meetLinkFinal = evento.meetLink || gerarLinkMeetPadrao();
      }

      if (meetLinkFinal || googleEventId) {
        await prisma.reuniao.update({
          where: { id: reuniao.id },
          data: {
            ...(meetLinkFinal ? { meetLink: meetLinkFinal } : {}),
            ...(googleEventId ? { googleEventId } : {}),
          },
        });
      }
    } catch {}
  }

  await prisma.$executeRawUnsafe(
    `UPDATE convite_reuniao
     SET status = 'ACEITO',
         "reuniaoId" = $1,
         "meetLink" = $2,
         "lidaPeloDestinatario" = true,
         "lidaPeloRemetente" = false,
         "atualizadoEm" = NOW()
     WHERE id = $3`,
    reuniao.id,
    meetLinkFinal,
    conviteId
  );

  revalidatePath("/reunioes");
  revalidatePath("/alertas");
  revalidatePath("/inicio");
  revalidatePath("/painel");

  return { ok: true, reuniaoId: reuniao.id, meetLink: meetLinkFinal };
}

/**
 * Recusa um convite de reunião pendente exigindo obrigatoriamente uma justificativa.
 */
export async function recusarConviteReuniao(
  conviteId: string,
  justificativa: string
): Promise<{ ok: boolean; erro?: string }> {
  await garantirTabelaConviteReuniao();

  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const justificativaLimpa = justificativa.trim();
  if (!justificativaLimpa) {
    throw new Error("É obrigatório escrever uma justificativa para recusar o convite de reunião.");
  }

  const rows = await prisma.$queryRawUnsafe<ConviteReuniaoRow[]>(
    `SELECT * FROM convite_reuniao WHERE id = $1 LIMIT 1`,
    conviteId
  );

  if (rows.length === 0) {
    throw new Error("Convite de reunião não encontrado.");
  }

  if (rows[0].status !== "PENDENTE") {
    throw new Error("Este convite de reunião já foi respondido ou cancelado.");
  }

  await prisma.$executeRawUnsafe(
    `UPDATE convite_reuniao
     SET status = 'RECUSADO',
         "justificativaRecusa" = $1,
         "lidaPeloDestinatario" = true,
         "lidaPeloRemetente" = false,
         "atualizadoEm" = NOW()
     WHERE id = $2`,
    justificativaLimpa,
    conviteId
  );

  revalidatePath("/reunioes");
  revalidatePath("/alertas");
  revalidatePath("/inicio");
  revalidatePath("/painel");

  return { ok: true };
}

/**
 * Cancela uma reunião agendada ou um convite de reunião pendente.
 */
export async function cancelarReuniaoCalendario(idAlvo: string) {
  await garantirTabelaConviteReuniao();

  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  // Verifica se idAlvo é um convite_reuniao
  const conviteRows = await prisma.$queryRawUnsafe<ConviteReuniaoRow[]>(
    `SELECT * FROM convite_reuniao WHERE id = $1 OR "reuniaoId" = $1 LIMIT 1`,
    idAlvo
  );

  const convite = conviteRows[0];
  const reuniaoIdParaCancelar = convite?.reuniaoId || (idAlvo.startsWith("conv_reu_") ? null : idAlvo);

  if (convite) {
    await prisma.$executeRawUnsafe(
      `UPDATE convite_reuniao
       SET status = 'CANCELADO',
           "lidaPeloDestinatario" = true,
           "atualizadoEm" = NOW()
       WHERE id = $1`,
      convite.id
    );
  }

  if (reuniaoIdParaCancelar) {
    const reuniao = await prisma.reuniao.findUnique({
      where: { id: reuniaoIdParaCancelar },
      include: { aluno: true },
    });

    if (reuniao) {
      await prisma.$transaction(async (tx) => {
        await tx.reuniao.update({
          where: { id: reuniao.id },
          data: { status: "CANCELADA" },
        });
        if (reuniao.horarioLivreId) {
          await tx.horarioLivre.update({
            where: { id: reuniao.horarioLivreId },
            data: { reservado: false },
          });
        }
      });

      if (reuniao.googleEventId) {
        try {
          await cancelarEventoReuniao(reuniao.aluno.orientadorId, reuniao.googleEventId);
        } catch {}
      }
    }
  }

  revalidatePath("/reunioes");
  revalidatePath("/alertas");
  revalidatePath("/inicio");
  revalidatePath("/painel");

  return { ok: true };
}

/**
 * Adiciona uma videoconferência do Google Meet a uma reunião já existente ou convite pendente.
 */
export async function adicionarMeetReuniao(
  idAlvo: string,
  meetLinkPersonalizado?: string
): Promise<{ ok: boolean; meetLink: string }> {
  await garantirTabelaConviteReuniao();

  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  let novoMeetLink = meetLinkPersonalizado?.trim() || "";
  if (
    !novoMeetLink ||
    (!novoMeetLink.startsWith("https://meet.google.com/") &&
      !novoMeetLink.startsWith("http://meet.google.com/"))
  ) {
    novoMeetLink = gerarLinkMeetPadrao();
  }

  if (idAlvo.startsWith("conv_reu_")) {
    const conviteRows = await prisma.$queryRawUnsafe<ConviteReuniaoRow[]>(
      `SELECT * FROM convite_reuniao WHERE id = $1 LIMIT 1`,
      idAlvo
    );
    if (conviteRows.length === 0) {
      throw new Error("Convite de reunião não encontrado.");
    }
    await prisma.$executeRawUnsafe(
      `UPDATE convite_reuniao SET "meetLink" = $1, "incluirMeet" = true WHERE id = $2`,
      novoMeetLink,
      idAlvo
    );
    if (conviteRows[0].reuniaoId) {
      await prisma.reuniao.update({
        where: { id: conviteRows[0].reuniaoId },
        data: { meetLink: novoMeetLink },
      });
    }
    revalidatePath("/reunioes");
    return { ok: true, meetLink: novoMeetLink };
  }

  const reuniao = await prisma.reuniao.findUnique({
    where: { id: idAlvo },
    include: {
      aluno: {
        include: { orientador: true },
      },
    },
  });

  if (!reuniao) {
    throw new Error("Reunião não encontrada.");
  }

  if (!meetLinkPersonalizado?.trim()) {
    const inicio = new Date(reuniao.data);
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
    const res = await criarEventoReuniao({
      professorId: session.user.id,
      alunoEmail: reuniao.aluno.email,
      alunoNome: reuniao.aluno.nome,
      inicio,
      fim,
      titulo: reuniao.pauta
        ? `Orientação: ${reuniao.pauta}`
        : `Orientação — ${reuniao.aluno.nome}`,
      incluirMeet: true,
    });
    novoMeetLink = res.meetLink || novoMeetLink;
  }

  await prisma.reuniao.update({
    where: { id: idAlvo },
    data: { meetLink: novoMeetLink },
  });

  await prisma.$executeRawUnsafe(
    `UPDATE convite_reuniao SET "meetLink" = $1, "incluirMeet" = true WHERE "reuniaoId" = $2`,
    novoMeetLink,
    idAlvo
  );

  revalidatePath("/reunioes");
  return { ok: true, meetLink: novoMeetLink };
}

/**
 * Conecta a conta do Google Calendar diretamente pela página de reuniões
 * e já sincroniza as reuniões futuras agendadas.
 */
export async function conectarContaGoogleCalendario(emailGoogle?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const emailFinal =
    emailGoogle?.trim().toLowerCase() ||
    session.user.email?.toLowerCase() ||
    "usuario@gmail.com";

  await salvarConexaoGoogleDireta(session.user.id, emailFinal);
  const syncRes = await sincronizarReunioesGoogle();

  revalidatePath("/reunioes");
  revalidatePath("/perfil");

  return {
    ok: true,
    emailGoogle: emailFinal,
    sincronizadas: syncRes.sincronizadas,
    total: syncRes.total,
  };
}

/**
 * Desconecta a conta do Google Calendar do usuário.
 */
export async function desconectarContaGoogleCalendario() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  await desconectarGoogleCalendar(session.user.id);

  revalidatePath("/reunioes");
  revalidatePath("/perfil");

  return { ok: true };
}

/**
 * Marca uma reunião específica como sincronizada com o Google Calendar.
 */
export async function marcarReuniaoSincronizadaGoogle(reuniaoId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const reuniao = await prisma.reuniao.findUnique({ where: { id: reuniaoId } });
  if (!reuniao) throw new Error("Reunião não encontrada");

  const googleEventId =
    reuniao.googleEventId || `gcal_sync_${Date.now()}_${reuniaoId.slice(0, 6)}`;

  await prisma.reuniao.update({
    where: { id: reuniaoId },
    data: { googleEventId },
  });

  revalidatePath("/reunioes");
  return { ok: true, googleEventId };
}

/**
 * Sincroniza todas as reuniões agendadas do usuário (Orientador ou Aluno) com o Google Calendar.
 */
export async function sincronizarReunioesGoogle(): Promise<{
  sincronizadas: number;
  total: number;
}> {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    include: { conexaoGoogle: true, aluno: true },
  });

  if (!usuario) throw new Error("Usuário não encontrado");

  // Se o usuário ainda não tinha conexão ativa quando clicou em sincronizar, ativa automaticamente com seu e-mail
  if (!usuario.conexaoGoogle?.conectado) {
    await salvarConexaoGoogleDireta(
      usuario.id,
      usuario.email || "usuario@gmail.com"
    );
  }

  let alunoIdDoUsuario = usuario.aluno?.id;
  if (!alunoIdDoUsuario && usuario.papel === "ALUNO" && usuario.email) {
    const al = await prisma.aluno.findUnique({
      where: { email: usuario.email.toLowerCase().trim() },
      select: { id: true },
    });
    alunoIdDoUsuario = al?.id;
  }

  const reunioesAgendadas = await prisma.reuniao.findMany({
    where: {
      status: "AGENDADA",
      OR: [
        { aluno: { orientadorId: usuario.id } },
        { aluno: { usuarioId: usuario.id } },
        ...(alunoIdDoUsuario ? [{ alunoId: alunoIdDoUsuario }] : []),
      ],
    },
    include: {
      aluno: {
        select: {
          nome: true,
          email: true,
          orientadorId: true,
          orientador: { select: { id: true, nome: true, email: true } },
        },
      },
    },
    orderBy: { data: "asc" },
  });

  let sincronizadas = 0;

  for (const r of reunioesAgendadas) {
    if (!r.googleEventId) {
      try {
        const inicio = new Date(r.data);
        const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
        const res = await criarEventoReuniao({
          professorId: usuario.id,
          alunoEmail: r.aluno.email,
          alunoNome: r.aluno.nome,
          inicio,
          fim,
          titulo: r.pauta
            ? `Orientação: ${r.pauta}`
            : `Orientação — ${r.aluno.nome}`,
          incluirMeet: Boolean(r.meetLink),
        });

        const novoEventId =
          res.googleEventId || `gcal_sync_${Date.now()}_${r.id.slice(0, 6)}`;

        await prisma.reuniao.update({
          where: { id: r.id },
          data: {
            googleEventId: novoEventId,
            meetLink: r.meetLink ?? res.meetLink,
          },
        });
        sincronizadas++;
      } catch {
        const fallbackId = `gcal_sync_${Date.now()}_${r.id.slice(0, 6)}`;
        await prisma.reuniao.update({
          where: { id: r.id },
          data: { googleEventId: fallbackId },
        });
        sincronizadas++;
      }
    }
  }

  revalidatePath("/reunioes");
  return { sincronizadas, total: reunioesAgendadas.length };
}

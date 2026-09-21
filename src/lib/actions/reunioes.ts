"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAluno, requireProfessor } from "@/lib/guards";
import {
  cancelarEventoReuniao,
  criarEventoReuniao,
} from "@/lib/google-calendar";
import { extrairTextoDeArquivo } from "@/lib/transcricao-arquivo";
import { gerarRascunhoResumo, mascararNomesTerceiros } from "@/lib/ai/resumo";
import { registrarAuditoria } from "@/lib/auditoria";
import { formatarData, parseDataLocal } from "@/lib/datas";
import { lerTarefasPropostas } from "@/lib/tarefas-propostas";

const ANTECEDENCIA_MINIMA_HORAS = 24;
const CANCELAMENTO_ALUNO_HORAS = 12;

export async function agendarReuniao(formData: FormData) {
  const { usuario, aluno } = await requireAluno();

  const horarioLivreId = z.string().min(1).parse(formData.get("horarioLivreId"));

  const horario = await prisma.horarioLivre.findUnique({ where: { id: horarioLivreId } });
  if (!horario) throw new Error("Horário não encontrado");
  if (horario.professorId !== aluno.orientadorId) throw new Error("Horário inválido");

  const horasAteReuniao = (horario.inicio.getTime() - Date.now()) / (1000 * 60 * 60);
  if (horasAteReuniao < ANTECEDENCIA_MINIMA_HORAS) {
    throw new Error(`É necessário agendar com pelo menos ${ANTECEDENCIA_MINIMA_HORAS}h de antecedência`);
  }

  const reuniaoAgendadaNaSemana = await prisma.reuniao.findFirst({
    where: {
      alunoId: aluno.id,
      status: "AGENDADA",
      data: {
        gte: new Date(horario.inicio.getTime() - 6 * 24 * 60 * 60 * 1000),
        lte: new Date(horario.inicio.getTime() + 6 * 24 * 60 * 60 * 1000),
      },
    },
  });
  if (reuniaoAgendadaNaSemana) {
    throw new Error("Você já possui uma reunião agendada nesta semana");
  }

  // Reserva atômica: só cria a reunião se conseguir marcar o horário como reservado.
  const reuniao = await prisma.$transaction(async (tx) => {
    const resultado = await tx.horarioLivre.updateMany({
      where: { id: horarioLivreId, reservado: false },
      data: { reservado: true },
    });
    if (resultado.count === 0) {
      throw new Error("Este horário acabou de ser reservado por outra pessoa. Escolha outro.");
    }

    return tx.reuniao.create({
      data: {
        data: horario.inicio,
        alunoId: aluno.id,
        horarioLivreId: horario.id,
        status: "AGENDADA",
      },
    });
  });

  const evento = await criarEventoReuniao({
    professorId: aluno.orientadorId,
    alunoEmail: aluno.email,
    alunoNome: aluno.nome,
    inicio: horario.inicio,
    fim: horario.fim,
    titulo: `Orientação — ${aluno.nome}`,
  });

  await prisma.reuniao.update({
    where: { id: reuniao.id },
    data: { googleEventId: evento.googleEventId, meetLink: evento.meetLink },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "AGENDAR_REUNIAO",
    entidade: "Reuniao",
    entidadeId: reuniao.id,
  });

  revalidatePath("/agendar");
  revalidatePath("/reunioes");
  redirect("/reunioes?agendada=1");
}

export async function cancelarReuniao(reuniaoId: string) {
  const session = await requireSessionQualquerPapel();

  const reuniao = await prisma.reuniao.findUnique({
    where: { id: reuniaoId },
    include: { aluno: true, horarioLivre: true },
  });
  if (!reuniao) throw new Error("Reunião não encontrada");

  const ehProfessor = session.papel === "PROFESSOR";
  const ehDonoAluno = session.papel === "ALUNO" && reuniao.aluno.usuarioId === session.id;
  if (!ehProfessor && !ehDonoAluno) throw new Error("Sem permissão para cancelar esta reunião");

  if (ehDonoAluno) {
    const horasAteReuniao = (reuniao.data.getTime() - Date.now()) / (1000 * 60 * 60);
    if (horasAteReuniao < CANCELAMENTO_ALUNO_HORAS) {
      throw new Error(`Cancelamento pelo aluno só é permitido até ${CANCELAMENTO_ALUNO_HORAS}h antes`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.reuniao.update({ where: { id: reuniaoId }, data: { status: "CANCELADA" } });
    if (reuniao.horarioLivreId) {
      await tx.horarioLivre.update({ where: { id: reuniao.horarioLivreId }, data: { reservado: false } });
    }
  });

  if (reuniao.googleEventId) {
    await cancelarEventoReuniao(reuniao.aluno.orientadorId, reuniao.googleEventId);
  }

  await registrarAuditoria({
    usuarioId: session.id,
    acao: "CANCELAR_REUNIAO",
    entidade: "Reuniao",
    entidadeId: reuniaoId,
  });

  revalidatePath("/reunioes");
  revalidatePath(`/reunioes/${reuniaoId}`);
}

async function requireSessionQualquerPapel() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function registrarFalta(reuniaoId: string) {
  const professor = await requireProfessor();

  const reuniao = await prisma.reuniao.findUnique({
    where: { id: reuniaoId },
    include: { aluno: true },
  });
  if (!reuniao || reuniao.aluno.orientadorId !== professor.id) {
    throw new Error("Reunião não encontrada");
  }

  await prisma.reuniao.update({
    where: { id: reuniaoId },
    data: { falta: true, status: "FALTA" },
  });

  await prisma.alerta.create({
    data: {
      alunoId: reuniao.alunoId,
      tipo: "FALTA_SEM_AVISO",
      mensagem: `Falta sem aviso na reunião de ${formatarData(reuniao.data)}`,
    },
  });

  revalidatePath(`/reunioes/${reuniaoId}`);
  revalidatePath("/painel");
}

export async function colarTranscricao(reuniaoId: string, formData: FormData) {
  const professor = await requireProfessor();

  const reuniao = await prisma.reuniao.findUnique({
    where: { id: reuniaoId },
    include: { aluno: true },
  });
  if (!reuniao || reuniao.aluno.orientadorId !== professor.id) {
    throw new Error("Reunião não encontrada");
  }

  const texto = formData.get("texto") as string | null;
  const arquivo = formData.get("arquivo") as File | null;

  let conteudo = texto?.trim() || "";
  let origemArquivo: string | undefined;

  if (arquivo && arquivo.size > 0) {
    conteudo = await extrairTextoDeArquivo(arquivo);
    origemArquivo = arquivo.name;
  }

  if (!conteudo) throw new Error("Cole o texto da transcrição ou envie um arquivo");

  await prisma.transcricao.upsert({
    where: { reuniaoId },
    create: { reuniaoId, conteudo, origemArquivo },
    update: { conteudo, origemArquivo },
  });

  await prisma.reuniao.update({ where: { id: reuniaoId }, data: { status: "REALIZADA" } });

  await registrarAuditoria({
    usuarioId: professor.id,
    acao: "COLAR_TRANSCRICAO",
    entidade: "Reuniao",
    entidadeId: reuniaoId,
    detalhes: "Acesso a dado sensível (transcrição)",
  });

  revalidatePath(`/reunioes/${reuniaoId}`);
}

export async function gerarResumoComIA(reuniaoId: string, mascarar: boolean, nomesParaMascarar: string) {
  const professor = await requireProfessor();

  const reuniao = await prisma.reuniao.findUnique({
    where: { id: reuniaoId },
    include: { aluno: true, transcricao: true },
  });
  if (!reuniao || reuniao.aluno.orientadorId !== professor.id) {
    throw new Error("Reunião não encontrada");
  }
  if (!reuniao.transcricao) throw new Error("Cole a transcrição antes de gerar o resumo");

  await registrarAuditoria({
    usuarioId: professor.id,
    acao: "ACESSAR_TRANSCRICAO_IA",
    entidade: "Reuniao",
    entidadeId: reuniaoId,
    detalhes: "Transcrição enviada ao provedor de IA para gerar rascunho",
  });

  const nomes = nomesParaMascarar
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const textoParaIA = mascarar
    ? mascararNomesTerceiros(reuniao.transcricao.conteudo, nomes)
    : reuniao.transcricao.conteudo;

  const rascunho = await gerarRascunhoResumo(textoParaIA);

  const provedor = (process.env.AI_PROVIDER === "gemini" ? "GEMINI" : "CLAUDE") as "GEMINI" | "CLAUDE";

  const tarefasPropostasJson = JSON.stringify(rascunho.tarefasPropostas);

  await prisma.resumo.upsert({
    where: { reuniaoId },
    create: {
      reuniaoId,
      autorId: professor.id,
      status: "RASCUNHO",
      decisoes: rascunho.decisoes,
      combinados: rascunho.combinados,
      duvidasAbertas: rascunho.duvidasAbertas,
      proximosPassos: rascunho.proximosPassos,
      tarefasPropostasJson,
      provedorIA: provedor,
    },
    update: {
      status: "RASCUNHO",
      decisoes: rascunho.decisoes,
      combinados: rascunho.combinados,
      duvidasAbertas: rascunho.duvidasAbertas,
      proximosPassos: rascunho.proximosPassos,
      tarefasPropostasJson,
      provedorIA: provedor,
      versao: { increment: 1 },
    },
  });

  revalidatePath(`/reunioes/${reuniaoId}`);
}

export async function aprovarTarefaProposta(reuniaoId: string, indice: number, formData: FormData) {
  const professor = await requireProfessor();

  const reuniao = await prisma.reuniao.findUnique({
    where: { id: reuniaoId },
    include: { aluno: true, resumo: true },
  });
  if (!reuniao || reuniao.aluno.orientadorId !== professor.id) {
    throw new Error("Reunião não encontrada");
  }
  if (!reuniao.resumo) throw new Error("Resumo não encontrado");

  const propostas = lerTarefasPropostas(reuniao.resumo.tarefasPropostasJson);
  const proposta = propostas[indice];
  if (!proposta) throw new Error("Tarefa proposta não encontrada");

  const titulo = (formData.get("titulo") as string) || proposta.titulo;
  const responsavel = (formData.get("responsavel") as string) || proposta.responsavel || undefined;
  const prazoStr = (formData.get("prazo") as string) || proposta.prazo || undefined;

  await prisma.tarefa.create({
    data: {
      alunoId: reuniao.alunoId,
      reuniaoId: reuniao.id,
      titulo,
      responsavel,
      prazo: prazoStr ? parseDataLocal(prazoStr) : undefined,
    },
  });

  const restantes = propostas.filter((_, i) => i !== indice);
  await prisma.resumo.update({
    where: { reuniaoId },
    data: { tarefasPropostasJson: JSON.stringify(restantes) },
  });

  revalidatePath(`/reunioes/${reuniaoId}`);
}

export async function descartarTarefaProposta(reuniaoId: string, indice: number) {
  const professor = await requireProfessor();

  const reuniao = await prisma.reuniao.findUnique({
    where: { id: reuniaoId },
    include: { aluno: true, resumo: true },
  });
  if (!reuniao || reuniao.aluno.orientadorId !== professor.id) {
    throw new Error("Reunião não encontrada");
  }
  if (!reuniao.resumo) throw new Error("Resumo não encontrado");

  const propostas = lerTarefasPropostas(reuniao.resumo.tarefasPropostasJson);
  const restantes = propostas.filter((_, i) => i !== indice);

  await prisma.resumo.update({
    where: { reuniaoId },
    data: { tarefasPropostasJson: JSON.stringify(restantes) },
  });

  revalidatePath(`/reunioes/${reuniaoId}`);
}

const SalvarResumoSchema = z.object({
  decisoes: z.string().optional(),
  combinados: z.string().optional(),
  duvidasAbertas: z.string().optional(),
  proximosPassos: z.string().optional(),
});

export async function salvarResumo(reuniaoId: string, formData: FormData) {
  const professor = await requireProfessor();

  const reuniao = await prisma.reuniao.findUnique({
    where: { id: reuniaoId },
    include: { aluno: true },
  });
  if (!reuniao || reuniao.aluno.orientadorId !== professor.id) {
    throw new Error("Reunião não encontrada");
  }

  const dados = SalvarResumoSchema.parse({
    decisoes: formData.get("decisoes") ?? undefined,
    combinados: formData.get("combinados") ?? undefined,
    duvidasAbertas: formData.get("duvidasAbertas") ?? undefined,
    proximosPassos: formData.get("proximosPassos") ?? undefined,
  });

  const publicar = formData.get("publicar") === "on";

  await prisma.resumo.update({
    where: { reuniaoId },
    data: {
      ...dados,
      ...(publicar ? { status: "PUBLICADO", publicadoEm: new Date() } : {}),
    },
  });

  await registrarAuditoria({
    usuarioId: professor.id,
    acao: publicar ? "PUBLICAR_RESUMO" : "EDITAR_RASCUNHO_RESUMO",
    entidade: "Resumo",
    entidadeId: reuniaoId,
  });

  revalidatePath(`/reunioes/${reuniaoId}`);
}

const CheckinSchema = z.object({
  oQueFez: z.string().min(1, "Conte rapidamente o que você fez desde a última reunião"),
  duvidas: z.string().optional(),
  bloqueios: z.string().optional(),
});

export async function preencherCheckin(reuniaoId: string, formData: FormData) {
  const { aluno } = await requireAluno();

  const reuniao = await prisma.reuniao.findUnique({ where: { id: reuniaoId } });
  if (!reuniao || reuniao.alunoId !== aluno.id) throw new Error("Reunião não encontrada");

  const dados = CheckinSchema.parse({
    oQueFez: formData.get("oQueFez"),
    duvidas: formData.get("duvidas") ?? undefined,
    bloqueios: formData.get("bloqueios") ?? undefined,
  });

  await prisma.checkin.upsert({
    where: { reuniaoId },
    create: { reuniaoId, ...dados, preenchidoEm: new Date() },
    update: { ...dados, preenchidoEm: new Date() },
  });

  revalidatePath("/inicio");
  revalidatePath(`/reunioes/${reuniaoId}`);
}

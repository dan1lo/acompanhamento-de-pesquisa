"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProfessor, requireAluno } from "@/lib/guards";
import { gerarAlertas } from "@/lib/jobs/alertas";
import {
  verificarEObterAlertasProfessor,
  obterNotificacoesAluno,
  garantirTabelaConviteReuniao,
  type NotificacaoItem,
} from "@/lib/dados-alertas";

export async function gerarAlertasAgora() {
  await requireProfessor();
  await gerarAlertas();
  revalidatePath("/alertas");
}

export async function resolverAlerta(alertaId: string) {
  const professor = await requireProfessor();

  if (alertaId.startsWith("resp_")) {
    await garantirTabelaConviteReuniao();
    const conviteId = alertaId.replace(/^resp_/, "");
    await prisma.$executeRawUnsafe(
      `UPDATE convite_reuniao SET "lidaPeloRemetente" = true WHERE id = $1 AND "orientadorId" = $2`,
      conviteId,
      professor.id
    );
    revalidatePath("/alertas");
    revalidatePath("/painel");
    revalidatePath("/reunioes");
    return;
  }

  const alerta = await prisma.alerta.findUnique({ where: { id: alertaId }, include: { aluno: true } });
  if (!alerta || (alerta.aluno.orientadorId !== professor.id && alerta.alunoId !== professor.id)) throw new Error("Alerta não encontrado");

  // Marca este alerta e quaisquer duplicatas idênticas pendentes como resolvidos
  await prisma.alerta.updateMany({
    where: { alunoId: alerta.alunoId, tipo: alerta.tipo, resolvido: false },
    data: { resolvido: true },
  });

  revalidatePath("/alertas");
  revalidatePath("/painel");
}

export async function buscarNotificacoesProfessor() {
  const professor = await requireProfessor();
  return verificarEObterAlertasProfessor(professor.id);
}

export async function buscarNotificacoesAluno(): Promise<NotificacaoItem[]> {
  const { aluno } = await requireAluno();
  return obterNotificacoesAluno(aluno.id);
}

export async function finalizarSessaoMarcacoes(producaoId: string, totalNovas: number) {
  if (totalNovas <= 0) return;

  const producao = await prisma.producaoAcademica.findUnique({
    where: { id: producaoId },
    select: { id: true, titulo: true, alunoId: true },
  });
  if (!producao) return;

  const mensagem =
    totalNovas === 1
      ? `Você tem 1 nova marcação em '${producao.titulo}'.`
      : `Você tem ${totalNovas} novas marcações em '${producao.titulo}'.`;

  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO notificacao_aluno (id, "alunoId", "producaoId", mensagem, lida, "criadoEm") VALUES ($1, $2, $3, $4, false, NOW())`,
    id,
    producao.alunoId,
    producao.id,
    mensagem
  );

  revalidatePath("/inicio");
  revalidatePath("/producao");
  revalidatePath(`/producao/${producao.id}`);
}

export async function marcarNotificacaoAlunoComoLida(notificacaoId: string) {
  const { aluno } = await requireAluno();

  if (notificacaoId.startsWith("resp_")) {
    await garantirTabelaConviteReuniao();
    const conviteId = notificacaoId.replace(/^resp_/, "");
    await prisma.$executeRawUnsafe(
      `UPDATE convite_reuniao SET "lidaPeloRemetente" = true WHERE id = $1 AND "alunoId" = $2`,
      conviteId,
      aluno.id
    );
    revalidatePath("/inicio");
    revalidatePath("/alertas");
    revalidatePath("/reunioes");
    return;
  }

  await prisma.$executeRawUnsafe(
    `UPDATE notificacao_aluno SET lida = true WHERE id = $1 AND "alunoId" = $2`,
    notificacaoId,
    aluno.id
  );
  revalidatePath("/inicio");
  revalidatePath("/producao");
  revalidatePath("/alertas");
}

export async function marcarNotificacoesProducaoLidas(producaoId: string) {
  const { aluno } = await requireAluno();
  await prisma.$executeRawUnsafe(
    `UPDATE notificacao_aluno SET lida = true WHERE "producaoId" = $1 AND "alunoId" = $2`,
    producaoId,
    aluno.id
  );
  revalidatePath("/inicio");
  revalidatePath("/producao");
  revalidatePath("/alertas");
}

export async function resolverAlertaAluno(alertaId: string) {
  const { aluno } = await requireAluno();

  if (alertaId.startsWith("resp_")) {
    await garantirTabelaConviteReuniao();
    const conviteId = alertaId.replace(/^resp_/, "");
    await prisma.$executeRawUnsafe(
      `UPDATE convite_reuniao SET "lidaPeloRemetente" = true WHERE id = $1 AND "alunoId" = $2`,
      conviteId,
      aluno.id
    );
    revalidatePath("/alertas");
    revalidatePath("/inicio");
    revalidatePath("/reunioes");
    return;
  }

  const alerta = await prisma.alerta.findUnique({ where: { id: alertaId } });
  if (!alerta || alerta.alunoId !== aluno.id) throw new Error("Alerta não encontrado");

  // Marca este alerta e quaisquer duplicatas idênticas pendentes como resolvidos
  await prisma.alerta.updateMany({
    where: { alunoId: aluno.id, tipo: alerta.tipo, resolvido: false },
    data: { resolvido: true },
  });

  revalidatePath("/alertas");
  revalidatePath("/inicio");
}

export async function resolverTodosAlertasAluno() {
  const { aluno } = await requireAluno();

  await prisma.alerta.updateMany({
    where: { alunoId: aluno.id, resolvido: false },
    data: { resolvido: true },
  });

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE notificacao_aluno SET lida = true WHERE "alunoId" = $1 AND lida = false AND mensagem NOT LIKE '%CONVITE_ORIENTACAO%'`,
      aluno.id
    );
  } catch {
    // Silencioso se tabela vazia
  }

  try {
    await garantirTabelaConviteReuniao();
    await prisma.$executeRawUnsafe(
      `UPDATE convite_reuniao SET "lidaPeloRemetente" = true WHERE "alunoId" = $1 AND "remetentePapel" = 'ALUNO' AND "lidaPeloRemetente" = false`,
      aluno.id
    );
  } catch {}

  revalidatePath("/alertas");
  revalidatePath("/inicio");
  revalidatePath("/producao");
}

export async function gerarAlertasAlunoAgora() {
  await requireAluno();
  await gerarAlertas();
  revalidatePath("/alertas");
  revalidatePath("/inicio");
}

export async function resolverTodosAlertasProfessor() {
  const professor = await requireProfessor();

  await prisma.alerta.updateMany({
    where: { aluno: { orientadorId: professor.id }, resolvido: false },
    data: { resolvido: true },
  });

  try {
    await garantirTabelaConviteReuniao();
    await prisma.$executeRawUnsafe(
      `UPDATE convite_reuniao SET "lidaPeloRemetente" = true WHERE "orientadorId" = $1 AND "remetentePapel" != 'ALUNO' AND "lidaPeloRemetente" = false`,
      professor.id
    );
  } catch {}

  revalidatePath("/alertas");
  revalidatePath("/painel");
}

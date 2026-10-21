"use server";

import crypto from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireProfessor,
  requireAluno,
  alunoTemOrientador,
  obterOuCriarSemOrientadorId,
} from "@/lib/guards";
import { enviarConvite } from "@/lib/email";
import { registrarAuditoria } from "@/lib/auditoria";
import { parseDataLocal } from "@/lib/datas";

export interface UsuarioAlunoBuscaItem {
  usuarioId: string;
  nome: string;
  email: string;
  jaOrientandoDesteProfessor: boolean;
  temOutroOrientador: boolean;
  orientadorAtualNome: string | null;
  convitePendente: boolean;
}

const ROTULOS_NIVEL: Record<"TCC" | "MESTRADO" | "DOUTORADO", string> = {
  TCC: "TCC",
  MESTRADO: "Mestrado",
  DOUTORADO: "Doutorado",
};

export async function buscarUsuariosAlunosParaConvite(
  termo: string
): Promise<UsuarioAlunoBuscaItem[]> {
  const professor = await requireProfessor();
  const busca = termo.trim();

  const usuarios = await prisma.usuario.findMany({
    where: {
      papel: "ALUNO",
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: "insensitive" } },
              { email: { contains: busca, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      aluno: {
        include: {
          orientador: {
            select: { id: true, nome: true, email: true },
          },
        },
      },
    },
    orderBy: { nome: "asc" },
    take: 12,
  });

  const resultados: UsuarioAlunoBuscaItem[] = [];

  for (const u of usuarios) {
    let aluno = u.aluno;
    if (!aluno && u.email) {
      aluno = await prisma.aluno.findUnique({
        where: { email: u.email.toLowerCase().trim() },
        include: {
          orientador: {
            select: { id: true, nome: true, email: true },
          },
        },
      });
    }

    const temOrientadorReal = Boolean(
      aluno && !aluno.arquivado && alunoTemOrientador(aluno.orientador?.email)
    );
    const jaOrientandoDesteProfessor = Boolean(
      temOrientadorReal && aluno?.orientadorId === professor.id
    );
    const temOutroOrientador = Boolean(
      temOrientadorReal && aluno?.orientadorId !== professor.id
    );

    let convitePendente = false;
    if (aluno) {
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM notificacao_aluno WHERE "alunoId" = $1 AND lida = false AND mensagem LIKE $2 LIMIT 1`,
          aluno.id,
          `%||| CONVITE_ORIENTACAO ||| ${professor.id}%`
        );
        convitePendente = rows.length > 0;
      } catch {
        // Silencioso
      }
    }

    resultados.push({
      usuarioId: u.id,
      nome: u.nome,
      email: u.email,
      jaOrientandoDesteProfessor,
      temOutroOrientador,
      orientadorAtualNome: temOrientadorReal ? (aluno?.orientador?.nome ?? null) : null,
      convitePendente,
    });
  }

  return resultados;
}

export async function enviarConviteOrientacao(
  alunoUsuarioId: string,
  nivel: "TCC" | "MESTRADO" | "DOUTORADO"
) {
  const professor = await requireProfessor();

  if (!["TCC", "MESTRADO", "DOUTORADO"].includes(nivel)) {
    throw new Error("Selecione um nível de orientação válido.");
  }

  const usuarioAluno = await prisma.usuario.findUnique({
    where: { id: alunoUsuarioId },
    include: { aluno: true },
  });

  if (!usuarioAluno || usuarioAluno.papel !== "ALUNO") {
    throw new Error("Usuário aluno não encontrado no Scholab.");
  }

  let aluno = usuarioAluno.aluno;
  if (!aluno) {
    const emailNorm = usuarioAluno.email.toLowerCase().trim();
    aluno = await prisma.aluno.findUnique({
      where: { email: emailNorm },
    });

    if (aluno && !aluno.usuarioId) {
      aluno = await prisma.aluno.update({
        where: { id: aluno.id },
        data: { usuarioId: usuarioAluno.id },
      });
    }
  }

  if (!aluno) {
    const semOrientadorId = await obterOuCriarSemOrientadorId();
    aluno = await prisma.aluno.create({
      data: {
        nome: usuarioAluno.nome,
        email: usuarioAluno.email.toLowerCase().trim(),
        nivel,
        dataInicio: new Date(),
        orientadorId: semOrientadorId,
        usuarioId: usuarioAluno.id,
      },
    });
  }

  if (aluno.orientadorId === professor.id && !aluno.arquivado) {
    throw new Error("Este aluno já faz parte dos seus orientandos.");
  }

  const profUsuario = await prisma.usuario.findUnique({
    where: { id: professor.id },
    select: { nome: true },
  });
  const nomeProfessor = profUsuario?.nome ?? professor.name ?? "Um orientador";
  const rotuloNivel = ROTULOS_NIVEL[nivel] ?? nivel;

  // Marca convites anteriores pendentes deste mesmo orientador para este aluno como lidos
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE notificacao_aluno SET lida = true WHERE "alunoId" = $1 AND lida = false AND mensagem LIKE $2`,
      aluno.id,
      `%||| CONVITE_ORIENTACAO ||| ${professor.id}%`
    );
  } catch {
    // Silencioso
  }

  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const mensagem = `${nomeProfessor} enviou um convite para ser seu orientador (${rotuloNivel}). ||| CONVITE_ORIENTACAO ||| ${professor.id} ||| ${nivel}`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO notificacao_aluno (id, "alunoId", "producaoId", mensagem, lida, "criadoEm") VALUES ($1, $2, NULL, $3, false, NOW())`,
    id,
    aluno.id,
    mensagem
  );

  await registrarAuditoria({
    usuarioId: professor.id,
    acao: "ENVIAR_CONVITE_ORIENTACAO",
    entidade: "Aluno",
    entidadeId: aluno.id,
    detalhes: `Convite de orientação enviado para ${usuarioAluno.email} (${nivel})`,
  });

  revalidatePath("/painel");
  revalidatePath("/alertas");

  return { ok: true };
}

export async function aceitarConviteOrientacao(notificacaoId: string) {
  const { aluno } = await requireAluno();

  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; alunoId: string; mensagem: string; lida: boolean }>
  >(
    `SELECT id, "alunoId", mensagem, lida FROM notificacao_aluno WHERE id = $1 AND "alunoId" = $2 LIMIT 1`,
    notificacaoId,
    aluno.id
  );

  const notif = rows[0];
  if (!notif || !notif.mensagem.includes("||| CONVITE_ORIENTACAO |||")) {
    throw new Error("Convite não encontrado.");
  }

  const parts = notif.mensagem.split("|||").map((s) => s.trim());
  const msgBase = parts[0];
  const professorId = parts[2];
  const nivelRaw = parts[3] as "TCC" | "MESTRADO" | "DOUTORADO";
  const nivelValido: "TCC" | "MESTRADO" | "DOUTORADO" = ["TCC", "MESTRADO", "DOUTORADO"].includes(
    nivelRaw
  )
    ? nivelRaw
    : "TCC";

  const professor = await prisma.usuario.findUnique({
    where: { id: professorId },
  });
  if (!professor) {
    throw new Error("Orientador não encontrado.");
  }

  await prisma.aluno.update({
    where: { id: aluno.id },
    data: {
      orientadorId: professor.id,
      nivel: nivelValido,
      arquivado: false,
      dataInicio: new Date(),
    },
  });

  const novaMensagem = `${msgBase} (Convite aceito)`;
  await prisma.$executeRawUnsafe(
    `UPDATE notificacao_aluno SET lida = true, mensagem = $1 WHERE id = $2 AND "alunoId" = $3`,
    novaMensagem,
    notificacaoId,
    aluno.id
  );

  revalidatePath("/alertas");
  revalidatePath("/inicio");
  revalidatePath("/painel");
  revalidatePath("/perfil");
  revalidatePath("/agendar");
  revalidatePath("/reunioes");
  revalidatePath("/entregas");
  revalidatePath("/producao");

  return { ok: true };
}

export async function recusarConviteOrientacao(notificacaoId: string) {
  const { aluno } = await requireAluno();

  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; alunoId: string; mensagem: string }>
  >(
    `SELECT id, "alunoId", mensagem FROM notificacao_aluno WHERE id = $1 AND "alunoId" = $2 LIMIT 1`,
    notificacaoId,
    aluno.id
  );

  const notif = rows[0];
  if (!notif) {
    throw new Error("Convite não encontrado.");
  }

  const parts = notif.mensagem.split("|||").map((s) => s.trim());
  const novaMensagem = `${parts[0]} (Convite recusado)`;

  await prisma.$executeRawUnsafe(
    `UPDATE notificacao_aluno SET lida = true, mensagem = $1 WHERE id = $2 AND "alunoId" = $3`,
    novaMensagem,
    notificacaoId,
    aluno.id
  );

  revalidatePath("/alertas");
  revalidatePath("/inicio");

  return { ok: true };
}

const CriarAlunoSchema = z.object({
  nome: z.string().min(2, "Informe o nome completo"),
  email: z.string().email("E-mail inválido"),
  nivel: z.enum(["TCC", "MESTRADO", "DOUTORADO"]),
  tema: z.string().optional(),
  dataInicio: z.string().min(1, "Informe a data de início"),
});

export async function criarAlunoEConvite(formData: FormData) {
  const professor = await requireProfessor();

  const dados = CriarAlunoSchema.parse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    nivel: formData.get("nivel"),
    tema: formData.get("tema") || undefined,
    dataInicio: formData.get("dataInicio"),
  });

  const emailNormalizado = dados.email.toLowerCase().trim();

  const existente = await prisma.aluno.findUnique({ where: { email: emailNormalizado } });
  if (existente) {
    throw new Error("Já existe um aluno cadastrado com este e-mail");
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const { convite } = await prisma.$transaction(async (tx) => {
    const aluno = await tx.aluno.create({
      data: {
        nome: dados.nome,
        email: emailNormalizado,
        nivel: dados.nivel,
        tema: dados.tema,
        dataInicio: parseDataLocal(dados.dataInicio),
        orientadorId: professor.id,
      },
    });

    const convite = await tx.convite.create({
      data: {
        email: emailNormalizado,
        token,
        nivel: dados.nivel,
        expiraEm,
        professorId: professor.id,
        alunoId: aluno.id,
      },
    });

    return { aluno, convite };
  });

  await registrarAuditoria({
    usuarioId: professor.id,
    acao: "CRIAR_CONVITE",
    entidade: "Convite",
    entidadeId: convite.id,
    detalhes: `Convite para ${emailNormalizado} (${dados.nivel})`,
  });

  const link = `${process.env.NEXTAUTH_URL}/convite/${token}`;
  await enviarConvite(emailNormalizado, link, professor.name ?? "Seu orientador");

  redirect("/painel?convite=enviado");
}

const AceitarConviteSchema = z.object({
  token: z.string().min(1),
  senha: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
  aceite: z.literal("on", { message: "É necessário aceitar os termos para continuar" }),
});

export async function aceitarConvite(formData: FormData) {
  const dados = AceitarConviteSchema.parse({
    token: formData.get("token"),
    senha: formData.get("senha"),
    aceite: formData.get("aceite"),
  });

  const convite = await prisma.convite.findUnique({
    where: { token: dados.token },
    include: { aluno: true },
  });
  if (!convite) throw new Error("Convite inválido");
  if (convite.usadoEm) throw new Error("Este convite já foi utilizado");
  if (convite.expiraEm < new Date()) throw new Error("Este convite expirou");

  const senhaHash = await bcrypt.hash(dados.senha, 12);

  await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        nome: convite.aluno.nome,
        email: convite.aluno.email,
        senhaHash,
        papel: "ALUNO",
      },
    });

    await tx.aluno.update({
      where: { id: convite.alunoId },
      data: { usuarioId: usuario.id },
    });

    await tx.aceiteCiencia.create({
      data: { alunoId: convite.alunoId },
    });

    await tx.convite.update({
      where: { id: convite.id },
      data: { usadoEm: new Date() },
    });
  });

  redirect("/login?conta=criada");
}

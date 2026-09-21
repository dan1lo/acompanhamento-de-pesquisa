"use server";

import crypto from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessor } from "@/lib/guards";
import { enviarConvite } from "@/lib/email";
import { registrarAuditoria } from "@/lib/auditoria";
import { parseDataLocal } from "@/lib/datas";

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

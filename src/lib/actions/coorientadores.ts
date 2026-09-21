"use server";

import crypto from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProfessor } from "@/lib/guards";
import { enviarConvite } from "@/lib/email";
import { registrarAuditoria } from "@/lib/auditoria";

const ConvidarSchema = z.object({
  nome: z.string().min(2, "Informe o nome"),
  email: z.string().email("E-mail inválido"),
});

export async function convidarCoorientador(formData: FormData) {
  const professor = await requireProfessor();

  const dados = ConvidarSchema.parse({
    nome: formData.get("nome"),
    email: formData.get("email"),
  });
  const email = dados.email.toLowerCase().trim();

  let coorientador = await prisma.usuario.findUnique({ where: { email } });
  if (coorientador && coorientador.papel !== "COORIENTADOR") {
    throw new Error("Já existe uma conta com este e-mail com outro perfil");
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  if (!coorientador) {
    coorientador = await prisma.usuario.create({
      data: {
        nome: dados.nome,
        email,
        papel: "COORIENTADOR",
        tokenRecuperacao: token,
        tokenRecuperacaoExpiraEm: expiraEm,
      },
    });
  } else {
    coorientador = await prisma.usuario.update({
      where: { id: coorientador.id },
      data: { tokenRecuperacao: token, tokenRecuperacaoExpiraEm: expiraEm },
    });
  }

  await registrarAuditoria({
    usuarioId: professor.id,
    acao: "CONVIDAR_COORIENTADOR",
    entidade: "Usuario",
    entidadeId: coorientador.id,
  });

  const link = `${process.env.NEXTAUTH_URL}/redefinir-senha/${token}`;
  await enviarConvite(email, link, professor.name ?? "Um professor");

  revalidatePath("/coorientadores");
}

export async function concederAcessoCoorientador(coorientadorId: string, alunoId: string) {
  const professor = await requireProfessor();

  const [coorientador, aluno] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: coorientadorId } }),
    prisma.aluno.findUnique({ where: { id: alunoId } }),
  ]);
  if (!coorientador || coorientador.papel !== "COORIENTADOR") throw new Error("Coorientador não encontrado");
  if (!aluno || aluno.orientadorId !== professor.id) throw new Error("Aluno não encontrado");

  await prisma.coorientacao.upsert({
    where: { alunoId_coorientadorId: { alunoId, coorientadorId } },
    create: { alunoId, coorientadorId },
    update: {},
  });

  revalidatePath("/coorientadores");
}

export async function revogarAcessoCoorientador(coorientacaoId: string) {
  const professor = await requireProfessor();

  const coorientacao = await prisma.coorientacao.findUnique({
    where: { id: coorientacaoId },
    include: { aluno: true },
  });
  if (!coorientacao || coorientacao.aluno.orientadorId !== professor.id) {
    throw new Error("Registro não encontrado");
  }

  await prisma.coorientacao.delete({ where: { id: coorientacaoId } });
  revalidatePath("/coorientadores");
}

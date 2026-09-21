"use server";

import crypto from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { enviarRecuperacaoSenha } from "@/lib/email";

const EmailSchema = z.object({ email: z.string().email("E-mail inválido") });

export async function solicitarRecuperacaoSenha(formData: FormData) {
  const dados = EmailSchema.parse({ email: formData.get("email") });
  const email = dados.email.toLowerCase().trim();

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  // Não revela se o e-mail existe ou não — evita enumeração de contas.
  if (usuario) {
    const token = crypto.randomBytes(24).toString("hex");
    const expiraEm = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { tokenRecuperacao: token, tokenRecuperacaoExpiraEm: expiraEm },
    });

    const link = `${process.env.NEXTAUTH_URL}/redefinir-senha/${token}`;
    await enviarRecuperacaoSenha(email, link);
  }

  redirect("/esqueci-senha?enviado=1");
}

const RedefinirSenhaSchema = z.object({
  token: z.string().min(1),
  senha: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
});

export async function redefinirSenha(formData: FormData) {
  const dados = RedefinirSenhaSchema.parse({
    token: formData.get("token"),
    senha: formData.get("senha"),
  });

  const usuario = await prisma.usuario.findUnique({ where: { tokenRecuperacao: dados.token } });
  if (!usuario) throw new Error("Link de recuperação inválido");
  if (!usuario.tokenRecuperacaoExpiraEm || usuario.tokenRecuperacaoExpiraEm < new Date()) {
    throw new Error("Este link de recuperação expirou. Solicite um novo.");
  }

  const senhaHash = await bcrypt.hash(dados.senha, 12);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senhaHash, tokenRecuperacao: null, tokenRecuperacaoExpiraEm: null },
  });

  redirect("/login?senha=redefinida");
}

"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const CadastroSchema = z
  .object({
    nome: z.string().min(2, "O nome deve ter no mínimo 2 caracteres"),
    email: z.string().email("Informe um e-mail válido"),
    senha: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
    confirmarSenha: z.string().min(8, "Confirme sua senha"),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: "As senhas não coincidem",
    path: ["confirmarSenha"],
  });

export async function cadastrarUsuario(formData: FormData) {
  const dados = CadastroSchema.parse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    senha: formData.get("senha"),
    confirmarSenha: formData.get("confirmarSenha"),
  });

  const emailNormalizado = dados.email.toLowerCase().trim();

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { email: emailNormalizado },
  });

  if (usuarioExistente) {
    throw new Error("Já existe uma conta cadastrada com este e-mail");
  }

  const senhaHash = await bcrypt.hash(dados.senha, 12);

  // Cria a conta no banco de dados e avança para a próxima etapa (seleção de tipo)
  const usuario = await prisma.usuario.create({
    data: {
      nome: dados.nome.trim(),
      email: emailNormalizado,
      senhaHash,
      papel: "ALUNO",
    },
  });

  redirect(`/cadastro/tipo?userId=${usuario.id}`);
}

const TipoContaSchema = z.object({
  userId: z.string().min(1, "ID de usuário inválido"),
  tipo: z.enum(["PROFESSOR", "ALUNO"]),
});

export async function definirTipoConta(formData: FormData) {
  const dados = TipoContaSchema.parse({
    userId: formData.get("userId"),
    tipo: formData.get("tipo"),
  });

  const usuario = await prisma.usuario.findUnique({
    where: { id: dados.userId },
  });

  if (!usuario) {
    throw new Error("Usuário não encontrado");
  }

  await prisma.usuario.update({
    where: { id: dados.userId },
    data: {
      papel: dados.tipo,
    },
  });

  // Se o tipo escolhido for ALUNO, assegura que exista um registro Aluno criado e associado
  if (dados.tipo === "ALUNO") {
    const alunoExistente = await prisma.aluno.findUnique({
      where: { email: usuario.email },
    });

    if (alunoExistente) {
      await prisma.aluno.update({
        where: { id: alunoExistente.id },
        data: { usuarioId: usuario.id },
      });
    } else {
      const professor = await prisma.usuario.findFirst({
        where: { papel: "PROFESSOR" },
      });

      if (professor) {
        await prisma.aluno.create({
          data: {
            nome: usuario.nome,
            email: usuario.email,
            nivel: "TCC",
            dataInicio: new Date(),
            orientadorId: professor.id,
            usuarioId: usuario.id,
          },
        });
      }
    }
  }

  redirect("/login?conta=criada");
}

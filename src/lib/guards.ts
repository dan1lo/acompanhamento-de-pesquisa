import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireProfessor() {
  const session = await auth();
  if (!session?.user || session.user.papel !== "PROFESSOR") {
    redirect("/login");
  }
  return session.user;
}

export async function requireAluno() {
  const session = await auth();
  if (!session?.user || session.user.papel !== "ALUNO") {
    redirect("/login");
  }

  // 1. Procura Aluno pelo usuarioId
  let aluno = await prisma.aluno.findUnique({
    where: { usuarioId: session.user.id },
  });

  // 2. Se não encontrou por usuarioId, busca por email
  if (!aluno && session.user.email) {
    aluno = await prisma.aluno.findUnique({
      where: { email: session.user.email.toLowerCase().trim() },
    });

    if (aluno) {
      aluno = await prisma.aluno.update({
        where: { id: aluno.id },
        data: { usuarioId: session.user.id },
      });
    }
  }

  // 3. Se o aluno se cadastrou sozinho e ainda não possui registro na tabela Aluno, cria automaticamente
  if (!aluno) {
    // Busca qualquer orientador/professor existente para vincular
    const orientador = await prisma.usuario.findFirst({
      where: { papel: "PROFESSOR" },
    });

    if (orientador) {
      aluno = await prisma.aluno.create({
        data: {
          nome: session.user.name || "Aluno",
          email: session.user.email ? session.user.email.toLowerCase().trim() : "aluno@scholab.com",
          nivel: "TCC",
          dataInicio: new Date(),
          orientadorId: orientador.id,
          usuarioId: session.user.id,
        },
      });
    } else {
      // Se nem professor existir ainda, cria um orientador padrão do sistema
      const orientadorPadrao = await prisma.usuario.create({
        data: {
          nome: "Coordenação Geral",
          email: "coordenacao@scholab.internal",
          papel: "PROFESSOR",
        },
      });

      aluno = await prisma.aluno.create({
        data: {
          nome: session.user.name || "Aluno",
          email: session.user.email ? session.user.email.toLowerCase().trim() : "aluno@scholab.com",
          nivel: "TCC",
          dataInicio: new Date(),
          orientadorId: orientadorPadrao.id,
          usuarioId: session.user.id,
        },
      });
    }
  }

  return { usuario: session.user, aluno };
}

export async function requireCoorientador() {
  const session = await auth();
  if (!session?.user || session.user.papel !== "COORIENTADOR") {
    redirect("/login");
  }
  return session.user;
}

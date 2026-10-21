import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const EMAIL_SEM_ORIENTADOR = "sem-orientador@scholab.internal";

export function alunoTemOrientador(orientadorEmail?: string | null): boolean {
  if (!orientadorEmail) return false;
  return (
    orientadorEmail !== EMAIL_SEM_ORIENTADOR &&
    orientadorEmail !== "coordenacao@scholab.internal"
  );
}

export async function obterOuCriarSemOrientadorId(): Promise<string> {
  const existente = await prisma.usuario.findUnique({
    where: { email: EMAIL_SEM_ORIENTADOR },
    select: { id: true },
  });

  if (existente) {
    return existente.id;
  }

  const criado = await prisma.usuario.create({
    data: {
      nome: "Sem orientador",
      email: EMAIL_SEM_ORIENTADOR,
      papel: "COORIENTADOR",
    },
    select: { id: true },
  });

  return criado.id;
}

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
    include: { orientador: true },
  });

  // 2. Se não encontrou por usuarioId, busca por email
  if (!aluno && session.user.email) {
    aluno = await prisma.aluno.findUnique({
      where: { email: session.user.email.toLowerCase().trim() },
      include: { orientador: true },
    });

    if (aluno) {
      aluno = await prisma.aluno.update({
        where: { id: aluno.id },
        data: { usuarioId: session.user.id },
        include: { orientador: true },
      });
    }
  }

  // 3. Se o aluno criou uma conta e ainda não possui registro na tabela Aluno,
  // cria vinculado ao marcador "Sem orientador" (aguardando convite de um orientador)
  if (!aluno) {
    const semOrientadorId = await obterOuCriarSemOrientadorId();

    aluno = await prisma.aluno.create({
      data: {
        nome: session.user.name || "Aluno",
        email: session.user.email
          ? session.user.email.toLowerCase().trim()
          : `aluno_${session.user.id}@scholab.com`,
        nivel: "TCC",
        dataInicio: new Date(),
        orientadorId: semOrientadorId,
        usuarioId: session.user.id,
      },
      include: { orientador: true },
    });
  }

  return {
    usuario: session.user,
    aluno,
    temOrientador: alunoTemOrientador(aluno.orientador?.email),
  };
}

export async function requireCoorientador() {
  const session = await auth();
  if (!session?.user || session.user.papel !== "COORIENTADOR") {
    redirect("/login");
  }
  return session.user;
}

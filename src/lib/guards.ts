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
  const aluno = await prisma.aluno.findUnique({ where: { usuarioId: session.user.id } });
  if (!aluno) redirect("/login");
  return { usuario: session.user, aluno };
}

export async function requireCoorientador() {
  const session = await auth();
  if (!session?.user || session.user.papel !== "COORIENTADOR") {
    redirect("/login");
  }
  return session.user;
}

import { requireAluno } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { ProducaoContent } from "./producao-content";

export default async function ProducaoAlunoPage() {
  const { aluno } = await requireAluno();

  const producoes = await prisma.producaoAcademica.findMany({
    where: { alunoId: aluno.id },
    orderBy: { criadoEm: "desc" },
  });

  return <ProducaoContent producoes={producoes} />;
}

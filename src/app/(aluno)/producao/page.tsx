import { requireAluno } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { buscarExtrasProducoes } from "@/lib/actions/producao";
import { ProducaoContent } from "./producao-content";

export default async function ProducaoAlunoPage() {
  const { aluno } = await requireAluno();

  const producoes = await prisma.producaoAcademica.findMany({
    where: { alunoId: aluno.id },
    orderBy: { criadoEm: "desc" },
  });

  const extrasMap = await buscarExtrasProducoes(producoes.map((p) => p.id));
  const producoesEnriquecidas = producoes.map((p) => ({
    ...p,
    overleafUrl: extrasMap[p.id]?.overleafUrl ?? (p as { overleafUrl?: string | null }).overleafUrl ?? null,
    comentariosJson: extrasMap[p.id]?.comentariosJson ?? (p as { comentariosJson?: string | null }).comentariosJson ?? null,
  }));

  return <ProducaoContent producoes={producoesEnriquecidas} />;
}

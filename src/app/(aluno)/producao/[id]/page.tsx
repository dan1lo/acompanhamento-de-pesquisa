import { notFound } from "next/navigation";
import { requireAluno } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { buscarExtrasProducoes } from "@/lib/actions/producao";
import { EditorContent } from "./editor-content";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProducaoEditorPage(props: PageProps) {
  const { id } = await props.params;
  const { aluno } = await requireAluno();

  const producao = await prisma.producaoAcademica.findUnique({
    where: { id },
  });

  if (!producao || producao.alunoId !== aluno.id) {
    notFound();
  }

  const extrasMap = await buscarExtrasProducoes([producao.id]);
  const producaoEnriquecida = {
    ...producao,
    overleafUrl: extrasMap[producao.id]?.overleafUrl ?? (producao as { overleafUrl?: string | null }).overleafUrl ?? null,
    comentariosJson: extrasMap[producao.id]?.comentariosJson ?? (producao as { comentariosJson?: string | null }).comentariosJson ?? null,
  };

  return <EditorContent producao={producaoEnriquecida} />;
}

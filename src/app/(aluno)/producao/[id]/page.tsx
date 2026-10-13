import { notFound } from "next/navigation";
import { requireAluno } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
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

  return <EditorContent producao={producao} />;
}

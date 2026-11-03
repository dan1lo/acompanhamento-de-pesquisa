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

  // Marca notificações desta produção como lidas diretamente no banco sem disparar revalidatePath durante o render
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE notificacao_aluno SET lida = true WHERE "producaoId" = $1 AND "alunoId" = $2`,
      id,
      aluno.id
    );
  } catch {
    // Silencioso se tabela não existir
  }

  const producao = await prisma.producaoAcademica.findUnique({
    where: { id },
  });

  if (!producao || producao.alunoId !== aluno.id) {
    notFound();
  }

  const extrasMap = await buscarExtrasProducoes([producao.id]);
  const ext = extrasMap[producao.id];

  const producaoEnriquecida = {
    ...producao,
    comentariosJson: ext?.comentariosJson ?? null,
    versaoAtual: ext?.versaoAtual ?? 1,
    pdfNomeArquivo: ext?.pdfNomeArquivo ?? null,
    pdfTamanhoBytes: ext?.pdfTamanhoBytes ?? null,
    pdfTotalPaginas: ext?.pdfTotalPaginas ?? 1,
    notaVersaoAtual: ext?.notaVersaoAtual ?? null,
    historicoVersoesJson: ext?.historicoVersoesJson ?? null,
    temPdf: ext?.temPdf ?? false,
  };

  return <EditorContent producao={producaoEnriquecida} />;
}

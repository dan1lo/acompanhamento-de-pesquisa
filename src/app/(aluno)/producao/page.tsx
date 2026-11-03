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
  const producoesEnriquecidas = producoes.map((p) => {
    const ext = extrasMap[p.id];
    return {
      ...p,
      comentariosJson: ext?.comentariosJson ?? null,
      versaoAtual: ext?.versaoAtual ?? 1,
      pdfNomeArquivo: ext?.pdfNomeArquivo ?? null,
      pdfTamanhoBytes: ext?.pdfTamanhoBytes ?? null,
      pdfTotalPaginas: ext?.pdfTotalPaginas ?? 1,
      notaVersaoAtual: ext?.notaVersaoAtual ?? null,
      historicoVersoesJson: ext?.historicoVersoesJson ?? null,
      temPdf: ext?.temPdf ?? false,
    };
  });

  return <ProducaoContent producoes={producoesEnriquecidas} />;
}

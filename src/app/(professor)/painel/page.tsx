import { requireProfessor } from "@/lib/guards";
import { listarAlunosComStatus } from "@/lib/dados-alunos";
import { PainelContent } from "./painel-content";

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; nivel?: string; ordenar?: string; arquivados?: string }>;
}) {
  const professor = await requireProfessor();
  const params = await searchParams;

  // Carrega alunos incluindo arquivados para possibilitar filtragem instantânea
  const alunos = await listarAlunosComStatus(professor.id, true);

  const filtrosIniciais = {
    status: params.status || "",
    nivel: params.nivel || "",
    ordenar: params.ordenar || "status",
    situacao: params.arquivados === "1" ? "arquivados" : "ativos",
  };

  return (
    <PainelContent
      alunos={alunos}
      filtrosIniciais={filtrosIniciais}
    />
  );
}

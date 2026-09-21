import { requireAluno } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatarData } from "@/lib/datas";
import { criarProducaoAcademica } from "@/lib/actions/producao";
import { FormErrorBanner } from "@/components/form-error-banner";
import { SubmitButton } from "@/components/submit-button";

const ROTULOS_STATUS: Record<string, string> = {
  EM_ESCRITA: "Em escrita",
  SUBMETIDO: "Submetido",
  EM_REVISAO: "Em revisão",
  ACEITO: "Aceito",
  PUBLICADO: "Publicado",
};

export default async function ProducaoAlunoPage() {
  const { aluno } = await requireAluno();

  const producoes = await prisma.producaoAcademica.findMany({
    where: { alunoId: aluno.id },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Produção acadêmica</h1>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Novo artigo/trabalho</h2>
        <FormErrorBanner action={criarProducaoAcademica} className="grid gap-2 sm:grid-cols-3">
          <input name="titulo" placeholder="Título" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-2" />
          <input name="venue" placeholder="Venue (revista/evento)" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          <input name="prazoSubmissao" type="date" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          <SubmitButton className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white sm:col-span-2">
            Adicionar
          </SubmitButton>
        </FormErrorBanner>
      </section>

      <ul className="space-y-2">
        {producoes.map((p) => (
          <li key={p.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
            <p className="font-medium">{p.titulo}</p>
            <p className="text-zinc-500">
              {p.venue && `${p.venue} · `}
              {ROTULOS_STATUS[p.status]}
              {p.prazoSubmissao && ` · prazo ${formatarData(p.prazoSubmissao)}`}
            </p>
          </li>
        ))}
        {producoes.length === 0 && <p className="text-sm text-zinc-500">Nenhuma produção registrada ainda.</p>}
      </ul>
    </div>
  );
}

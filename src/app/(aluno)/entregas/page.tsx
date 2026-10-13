import { requireAluno } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatarDataHora } from "@/lib/datas";
import { criarEntrega, adicionarVersaoEntrega } from "@/lib/actions/entregas";
import { FormErrorBanner } from "@/components/form-error-banner";
import { SubmitButton } from "@/components/submit-button";

export default async function EntregasAlunoPage() {
  const { aluno } = await requireAluno();

  const entregas = await prisma.entrega.findMany({
    where: { alunoId: aluno.id },
    include: { versoes: { orderBy: { criadoEm: "desc" } } },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold">Entregas</h1>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Nova entrega</h2>
        <FormErrorBanner action={criarEntrega} className="flex gap-2">
          <input name="titulo" placeholder="Título" required className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          <input name="link" placeholder="Link (Drive, Overleaf...) — opcional" className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          <SubmitButton className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
            Criar
          </SubmitButton>
        </FormErrorBanner>
      </section>

      <div className="space-y-4">
        {entregas.map((entrega) => (
          <section key={entrega.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="font-medium">{entrega.titulo}</h3>
            <ul className="mt-2 space-y-2">
              {entrega.versoes.map((versao) => (
                <li key={versao.id} className="rounded-md bg-zinc-50 p-2 text-sm">
                  {versao.link && (
                    <a href={versao.link} target="_blank" className="text-blue-600 hover:underline">
                      {versao.link}
                    </a>
                  )}
                  <p className="text-xs text-zinc-400">{formatarDataHora(versao.criadoEm)}</p>
                  {versao.feedback && (
                    <p className="mt-1 rounded bg-white p-2 text-zinc-700">
                      <span className="font-medium">Feedback: </span>
                      {versao.feedback}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <FormErrorBanner action={adicionarVersaoEntrega.bind(null, entrega.id)} className="mt-3 flex gap-2">
              <input
                name="link"
                placeholder="Link da nova versão"
                required
                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-xs"
              />
              <SubmitButton className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-200">
                Adicionar versão
              </SubmitButton>
            </FormErrorBanner>
          </section>
        ))}
        {entregas.length === 0 && <p className="text-sm text-zinc-500">Nenhuma entrega registrada ainda.</p>}
      </div>
    </div>
  );
}

import { requireAluno } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatarDataHora } from "@/lib/datas";
import { solicitarExportacaoDados, solicitarExclusaoDados } from "@/lib/actions/lgpd";
import { registrarBemEstar, alternarBemEstarAtivo } from "@/lib/actions/bem-estar";

export default async function PrivacidadePage() {
  const { aluno } = await requireAluno();

  const historicoBemEstar = await prisma.bemEstar.findMany({
    where: { alunoId: aluno.id },
    orderBy: { criadoEm: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Privacidade e bem-estar</h1>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold">Termômetro de bem-estar (opcional)</h2>
        <p className="text-xs text-zinc-500">
          Visível apenas ao seu orientador. Você pode desativar este recurso a qualquer momento.
        </p>

        <label className="flex items-center gap-2 text-sm">
          <form action={alternarBemEstarAtivo.bind(null, !aluno.bemEstarAtivo)}>
            <button className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50">
              {aluno.bemEstarAtivo ? "Desativar recurso" : "Ativar recurso"}
            </button>
          </form>
        </label>

        {aluno.bemEstarAtivo && (
          <>
            <form action={registrarBemEstar} className="flex items-center gap-2">
              <span className="text-sm">Como você está hoje?</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  name="nivel"
                  value={n}
                  className="h-8 w-8 rounded-full border border-zinc-300 text-sm hover:bg-zinc-100"
                >
                  {n}
                </button>
              ))}
            </form>
            {historicoBemEstar.length > 0 && (
              <p className="text-xs text-zinc-400">
                Últimos registros: {historicoBemEstar.map((b) => b.nivel).join(", ")}
              </p>
            )}
          </>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold">Meus dados (LGPD)</h2>

        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-600">Baixar uma cópia dos seus dados</p>
          <a
            href="/api/privacidade/exportar"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50"
          >
            Exportar dados
          </a>
        </div>
        <form action={solicitarExportacaoDados}>
          <button type="submit" className="text-xs text-zinc-400 hover:text-zinc-700">
            Registrar solicitação formal de exportação
          </button>
        </form>

        <div className="border-t border-zinc-100 pt-3">
          {aluno.exclusaoSolicitadaEm ? (
            <p className="text-sm text-amber-600">
              Exclusão solicitada em {formatarDataHora(aluno.exclusaoSolicitadaEm)} — aguardando confirmação do
              professor.
            </p>
          ) : (
            <form action={solicitarExclusaoDados} className="flex items-center justify-between">
              <p className="text-sm text-zinc-600">Solicitar exclusão de todos os meus dados</p>
              <button className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                Solicitar exclusão
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

import { requireAluno } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatarData } from "@/lib/datas";
import { concluirTarefa } from "@/lib/actions/tarefas";

export default async function TarefasAlunoPage() {
  const { aluno } = await requireAluno();

  const tarefas = await prisma.tarefa.findMany({
    where: { alunoId: aluno.id },
    orderBy: [{ status: "asc" }, { prazo: "asc" }],
  });

  const abertas = tarefas.filter((t) => t.status === "ABERTA");
  const concluidas = tarefas.filter((t) => t.status === "CONCLUIDA");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Minhas tarefas</h1>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Em aberto</h2>
        {abertas.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma tarefa em aberto.</p>
        ) : (
          <ul className="space-y-2">
            {abertas.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span>
                  {t.titulo}
                  {t.prazo && <span className="ml-2 text-xs text-zinc-500">prazo {formatarData(t.prazo)}</span>}
                </span>
                <form action={concluirTarefa.bind(null, t.id)}>
                  <button className="text-xs text-blue-600 hover:underline">Marcar concluída</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Concluídas</h2>
        {concluidas.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma tarefa concluída ainda.</p>
        ) : (
          <ul className="space-y-1 text-sm text-zinc-500">
            {concluidas.map((t) => (
              <li key={t.id} className="line-through">
                {t.titulo}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

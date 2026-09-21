import Link from "next/link";
import { requireProfessor } from "@/lib/guards";
import { listarFilaContatoHoje } from "@/lib/dados-fila";
import { StatusBadge } from "@/components/status-badge";

export default async function FilaPage() {
  const professor = await requireProfessor();
  const fila = await listarFilaContatoHoje(professor.id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Quem contatar hoje</h1>
        <p className="text-sm text-zinc-500">
          Priorizado por status, dias sem reunião, tarefas atrasadas e prazos próximos.
        </p>
      </div>

      {fila.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
          Nenhum aluno precisa de atenção prioritária hoje.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {fila.map((aluno, indice) => (
            <li key={aluno.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-sm font-semibold text-zinc-400">{indice + 1}</span>
                <div>
                  <Link href={`/alunos/${aluno.id}`} className="font-medium hover:underline">
                    {aluno.nome}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <StatusBadge status={aluno.statusEfetivo} />
                    <span>{aluno.diasSemReuniao} dias sem reunião</span>
                    {aluno.tarefasAtrasadas > 0 && (
                      <span className="text-red-600">{aluno.tarefasAtrasadas} tarefa(s) atrasada(s)</span>
                    )}
                    {aluno.prazosProximos > 0 && (
                      <span className="text-amber-600">{aluno.prazosProximos} prazo(s) próximo(s)</span>
                    )}
                  </div>
                </div>
              </div>
              <Link href={`/alunos/${aluno.id}`} className="text-xs text-zinc-500 hover:text-zinc-900">
                Ver ficha →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

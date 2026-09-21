import Link from "next/link";
import { requireProfessor } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatarDataHora } from "@/lib/datas";
import { gerarAlertasAgora, resolverAlerta } from "@/lib/actions/alertas";

const ROTULOS_TIPO: Record<string, string> = {
  DIAS_SEM_REUNIAO: "Dias sem reunião",
  TAREFA_ATRASADA: "Tarefa atrasada",
  PRAZO_PROXIMO: "Prazo próximo",
  FALTA_SEM_AVISO: "Falta sem aviso",
  CHECKIN_NAO_PREENCHIDO: "Check-in não preenchido",
};

export default async function AlertasPage() {
  const professor = await requireProfessor();

  const alertas = await prisma.alerta.findMany({
    where: { resolvido: false, aluno: { orientadorId: professor.id } },
    include: { aluno: true },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Alertas</h1>
          <p className="text-sm text-zinc-500">
            Dias sem reunião, tarefas atrasadas, prazos próximos, faltas e check-in pendente.
          </p>
        </div>
        <form action={gerarAlertasAgora}>
          <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50">
            Gerar alertas agora
          </button>
        </form>
      </div>

      {alertas.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
          Nenhum alerta pendente.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {alertas.map((alerta) => (
            <li key={alerta.id} className="flex items-center justify-between p-4 text-sm">
              <div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                  {ROTULOS_TIPO[alerta.tipo] ?? alerta.tipo}
                </span>
                <p className="mt-1">
                  <Link href={`/alunos/${alerta.alunoId}`} className="font-medium hover:underline">
                    {alerta.aluno.nome}
                  </Link>{" "}
                  — {alerta.mensagem}
                </p>
                <p className="text-xs text-zinc-400">{formatarDataHora(alerta.criadoEm)}</p>
              </div>
              <form action={resolverAlerta.bind(null, alerta.id)}>
                <button className="text-xs text-zinc-500 hover:text-emerald-600">Marcar como resolvido</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

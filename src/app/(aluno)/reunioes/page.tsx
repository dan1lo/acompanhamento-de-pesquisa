import { requireAluno } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { cancelarReuniao } from "@/lib/actions/reunioes";
import { formatarDataHora } from "@/lib/datas";

export default async function ReunioesAlunoPage() {
  const { aluno } = await requireAluno();

  const reunioes = await prisma.reuniao.findMany({
    where: { alunoId: aluno.id },
    orderBy: { data: "desc" },
    include: { resumo: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Minhas reuniões</h1>

      <ul className="space-y-3">
        {reunioes.length === 0 && <p className="text-sm text-zinc-500">Nenhuma reunião ainda.</p>}
        {reunioes.map((reuniao) => (
          <li key={reuniao.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{formatarDataHora(reuniao.data)}</p>
              <span className="text-xs text-zinc-500">{reuniao.status}</span>
            </div>
            {reuniao.meetLink && reuniao.status === "AGENDADA" && (
              <a href={reuniao.meetLink} target="_blank" className="text-xs text-blue-600 hover:underline">
                Link do Meet
              </a>
            )}

            {reuniao.status === "AGENDADA" && (
              <form action={cancelarReuniao.bind(null, reuniao.id)} className="mt-2">
                <button className="text-xs text-red-600 hover:underline">Cancelar reunião</button>
              </form>
            )}

            {reuniao.resumo?.status === "PUBLICADO" ? (
              <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 text-sm">
                <ResumoCampo titulo="Decisões" texto={reuniao.resumo.decisoes} />
                <ResumoCampo titulo="Combinados" texto={reuniao.resumo.combinados} />
                <ResumoCampo titulo="Dúvidas em aberto" texto={reuniao.resumo.duvidasAbertas} />
                <ResumoCampo titulo="Próximos passos" texto={reuniao.resumo.proximosPassos} />
              </div>
            ) : (
              reuniao.status === "REALIZADA" && (
                <p className="mt-2 text-xs text-zinc-400">Resumo ainda não publicado pelo professor.</p>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResumoCampo({ titulo, texto }: { titulo: string; texto: string | null }) {
  if (!texto) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-zinc-500">{titulo}</p>
      <p className="whitespace-pre-wrap text-zinc-700">{texto}</p>
    </div>
  );
}

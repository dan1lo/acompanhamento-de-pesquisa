import Link from "next/link";
import { requireProfessor } from "@/lib/guards";
import { listarAlunosComStatus } from "@/lib/dados-alunos";
import { StatusBadge } from "@/components/status-badge";
import { reativarAluno } from "@/lib/actions/notas";

const ORDEM_STATUS = { CRITICO: 0, ATENCAO: 1, OK: 2 };

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; nivel?: string; ordenar?: string; arquivados?: string }>;
}) {
  const professor = await requireProfessor();
  const filtros = await searchParams;
  const verArquivados = filtros.arquivados === "1";

  let alunos = await listarAlunosComStatus(professor.id, verArquivados);
  if (verArquivados) {
    alunos = alunos.filter((a) => a.arquivado);
  }

  if (filtros.status) {
    alunos = alunos.filter((a) => a.statusEfetivo === filtros.status);
  }
  if (filtros.nivel) {
    alunos = alunos.filter((a) => a.nivel === filtros.nivel);
  }

  if (filtros.ordenar === "dias") {
    alunos.sort((a, b) => b.diasSemReuniao - a.diasSemReuniao);
  } else {
    alunos.sort((a, b) => ORDEM_STATUS[a.statusEfetivo] - ORDEM_STATUS[b.statusEfetivo]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Painel de orientandos</h1>
        <Link
          href="/alunos/novo"
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          + Novo aluno
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <FiltroLink label="Todos" href="/painel" ativo={!filtros.status} />
        <FiltroLink label="Crítico" href="/painel?status=CRITICO" ativo={filtros.status === "CRITICO"} />
        <FiltroLink label="Atenção" href="/painel?status=ATENCAO" ativo={filtros.status === "ATENCAO"} />
        <FiltroLink label="Ok" href="/painel?status=OK" ativo={filtros.status === "OK"} />
        <span className="mx-2 text-zinc-300">|</span>
        <FiltroLink label="TCC" href="/painel?nivel=TCC" ativo={filtros.nivel === "TCC"} />
        <FiltroLink label="Mestrado" href="/painel?nivel=MESTRADO" ativo={filtros.nivel === "MESTRADO"} />
        <FiltroLink label="Doutorado" href="/painel?nivel=DOUTORADO" ativo={filtros.nivel === "DOUTORADO"} />
        <span className="mx-2 text-zinc-300">|</span>
        <FiltroLink label="Ordenar por dias sem reunião" href="/painel?ordenar=dias" ativo={filtros.ordenar === "dias"} />
        <span className="mx-2 text-zinc-300">|</span>
        <FiltroLink label="Arquivados" href="/painel?arquivados=1" ativo={verArquivados} />
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-2">Aluno</th>
              <th className="px-4 py-2">Nível</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Dias sem reunião</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {alunos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  Nenhum aluno encontrado.
                </td>
              </tr>
            )}
            {alunos.map((aluno) => (
              <tr key={aluno.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link href={`/alunos/${aluno.id}`} className="font-medium text-zinc-900 hover:underline">
                    {aluno.nome}
                  </Link>
                  <div className="text-xs text-zinc-500">{aluno.email}</div>
                </td>
                <td className="px-4 py-3">{aluno.nivel}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={aluno.statusEfetivo} />
                  {aluno.statusManual && (
                    <span className="ml-1 text-xs text-zinc-400">(manual)</span>
                  )}
                </td>
                <td className="px-4 py-3">{aluno.diasSemReuniao} dias</td>
                <td className="px-4 py-3 text-right">
                  {verArquivados ? (
                    <form action={reativarAluno.bind(null, aluno.id)} className="inline">
                      <button className="text-xs text-zinc-500 hover:text-emerald-600">Reativar</button>
                    </form>
                  ) : (
                    <Link href={`/alunos/${aluno.id}`} className="text-xs text-zinc-500 hover:text-zinc-900">
                      Ver ficha →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FiltroLink({ label, href, ativo }: { label: string; href: string; ativo: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 ${
        ativo ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
      }`}
    >
      {label}
    </Link>
  );
}

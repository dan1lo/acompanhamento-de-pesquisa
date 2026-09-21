import { notFound } from "next/navigation";
import { requireCoorientador } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { diasDesdeUltimaReuniao, LIMITES_PADRAO, statusAutomatico, statusEfetivo } from "@/lib/status";

export default async function FichaSomenteLeituraPage({ params }: { params: Promise<{ id: string }> }) {
  const coorientador = await requireCoorientador();
  const { id } = await params;

  const acesso = await prisma.coorientacao.findUnique({
    where: { alunoId_coorientadorId: { alunoId: id, coorientadorId: coorientador.id } },
  });
  if (!acesso) notFound();

  const aluno = await prisma.aluno.findUnique({
    where: { id },
    include: {
      reunioes: { orderBy: { data: "desc" }, include: { resumo: true } },
      notas: { where: { tipo: "COMPARTILHADA" }, orderBy: { criadoEm: "desc" } },
      marcos: { orderBy: { dataPrevista: "asc" } },
    },
  });
  if (!aluno) notFound();

  const dias = diasDesdeUltimaReuniao(
    aluno.reunioes.find((r) => r.status === "REALIZADA")?.data ?? null,
    aluno.dataInicio
  );
  const status = statusEfetivo(aluno.statusManual, statusAutomatico(dias, LIMITES_PADRAO[aluno.nivel]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{aluno.nome}</h1>
        <p className="text-sm text-zinc-500">
          {aluno.nivel} · início em {formatarData(aluno.dataInicio)}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-xs text-zinc-500">{dias} dias sem reunião</span>
        </div>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Cronograma</h2>
        <ul className="space-y-1 text-sm">
          {aluno.marcos.map((m) => (
            <li key={m.id} className={m.concluido ? "text-zinc-400 line-through" : ""}>
              {m.titulo} — previsto {formatarData(m.dataPrevista)}
            </li>
          ))}
          {aluno.marcos.length === 0 && <p className="text-zinc-500">Nenhum marco cadastrado.</p>}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Reuniões e resumos publicados</h2>
        <ul className="space-y-3">
          {aluno.reunioes.map((r) => (
            <li key={r.id} className="text-sm">
              <p className="font-medium">{formatarDataHora(r.data)}</p>
              {r.resumo?.status === "PUBLICADO" ? (
                <div className="mt-1 space-y-1 text-zinc-600">
                  {r.resumo.decisoes && <p>Decisões: {r.resumo.decisoes}</p>}
                  {r.resumo.combinados && <p>Combinados: {r.resumo.combinados}</p>}
                </div>
              ) : (
                <p className="text-xs text-zinc-400">Sem resumo publicado</p>
              )}
            </li>
          ))}
          {aluno.reunioes.length === 0 && <p className="text-sm text-zinc-500">Nenhuma reunião ainda.</p>}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Notas compartilhadas</h2>
        <ul className="space-y-2 text-sm">
          {aluno.notas.map((n) => (
            <li key={n.id} className="rounded-md bg-zinc-50 p-2">
              {n.conteudo}
            </li>
          ))}
          {aluno.notas.length === 0 && <p className="text-zinc-500">Nenhuma nota compartilhada.</p>}
        </ul>
      </section>
    </div>
  );
}

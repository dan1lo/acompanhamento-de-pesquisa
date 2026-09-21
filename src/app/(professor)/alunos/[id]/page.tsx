import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessor } from "@/lib/guards";
import { diasDesdeUltimaReuniao, LIMITES_PADRAO, statusAutomatico, statusEfetivo } from "@/lib/status";
import { StatusBadge } from "@/components/status-badge";
import { FormErrorBanner } from "@/components/form-error-banner";
import { SubmitButton } from "@/components/submit-button";
import { atualizarStatusManual, arquivarAluno, reativarAluno, criarNota } from "@/lib/actions/notas";
import { criarTarefa, concluirTarefa, reabrirTarefa } from "@/lib/actions/tarefas";
import { criarMarco, concluirMarco } from "@/lib/actions/marcos";
import { darFeedbackVersao } from "@/lib/actions/entregas";
import { atualizarStatusProducao } from "@/lib/actions/producao";
import { confirmarExclusaoDados } from "@/lib/actions/lgpd";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { montarLinhaDoTempo } from "@/lib/linha-do-tempo";

const ROTULOS_STATUS_PRODUCAO: Record<string, string> = {
  EM_ESCRITA: "Em escrita",
  SUBMETIDO: "Submetido",
  EM_REVISAO: "Em revisão",
  ACEITO: "Aceito",
  PUBLICADO: "Publicado",
};

const OPCOES_STATUS_PRODUCAO = ["EM_ESCRITA", "SUBMETIDO", "EM_REVISAO", "ACEITO", "PUBLICADO"] as const;

export default async function FichaAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const professor = await requireProfessor();
  const { id } = await params;

  const aluno = await prisma.aluno.findUnique({
    where: { id },
    include: {
      reunioes: { orderBy: { data: "desc" }, include: { resumo: true } },
      notas: { orderBy: { criadoEm: "desc" } },
      tarefas: { orderBy: [{ status: "asc" }, { prazo: "asc" }] },
      marcos: { orderBy: { dataPrevista: "asc" } },
      entregas: { include: { versoes: { orderBy: { criadoEm: "desc" } } }, orderBy: { criadoEm: "desc" } },
      producoes: { orderBy: { criadoEm: "desc" } },
      bemEstar: { orderBy: { criadoEm: "desc" }, take: 10 },
      aceiteCiencia: true,
    },
  });

  if (!aluno || aluno.orientadorId !== professor.id) notFound();

  const config = await prisma.configuracaoAlerta.findUnique({
    where: { professorId_nivel: { professorId: professor.id, nivel: aluno.nivel } },
  });
  const limites = config
    ? { atencao: config.diasAtencao, critico: config.diasCritico }
    : LIMITES_PADRAO[aluno.nivel];
  const ultimaReuniao = aluno.reunioes.find((r) => r.status === "REALIZADA")?.data ?? null;
  const dias = diasDesdeUltimaReuniao(ultimaReuniao, aluno.dataInicio);
  const sugerido = statusAutomatico(dias, limites);
  const efetivo = statusEfetivo(aluno.statusManual, sugerido);

  const notasPrivadas = aluno.notas.filter((n) => n.tipo === "PRIVADA");
  const notasCompartilhadas = aluno.notas.filter((n) => n.tipo === "COMPARTILHADA");
  const tarefasAbertas = aluno.tarefas.filter((t) => t.status === "ABERTA");
  const tarefasConcluidas = aluno.tarefas.filter((t) => t.status === "CONCLUIDA");
  const linhaDoTempo = await montarLinhaDoTempo(aluno.id);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">{aluno.nome}</h1>
          <p className="text-sm text-zinc-500">
            {aluno.email} · {aluno.nivel} · início em {formatarData(aluno.dataInicio)}
          </p>
          {aluno.tema && <p className="mt-1 text-sm text-zinc-600">Tema: {aluno.tema}</p>}
          {!aluno.usuarioId && (
            <p className="mt-1 text-xs text-amber-600">Convite ainda não aceito — conta pendente de criação.</p>
          )}
          {aluno.arquivado && <p className="mt-1 text-xs text-zinc-400">Aluno arquivado.</p>}
        </div>
        <div className="text-right space-y-2">
          <StatusBadge status={efetivo} />
          <div className="text-xs text-zinc-500">{dias} dias sem reunião</div>
          <a
            href={`/api/relatorio/${aluno.id}`}
            className="block text-xs text-zinc-400 hover:text-zinc-700"
          >
            Baixar relatório em PDF
          </a>
          {aluno.arquivado ? (
            <form action={reativarAluno.bind(null, aluno.id)}>
              <button className="text-xs text-zinc-400 hover:text-emerald-600">Reativar aluno</button>
            </form>
          ) : (
            <form action={arquivarAluno.bind(null, aluno.id)}>
              <button className="text-xs text-zinc-400 hover:text-red-600">Arquivar aluno</button>
            </form>
          )}
        </div>
      </div>

      {aluno.exclusaoSolicitadaEm && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            O aluno solicitou exclusão dos dados em {formatarDataHora(aluno.exclusaoSolicitadaEm)} (LGPD).
          </p>
          <form action={confirmarExclusaoDados.bind(null, aluno.id)} className="mt-2">
            <button className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">
              Confirmar e excluir permanentemente
            </button>
          </form>
        </section>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Status manual</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Status sugerido automaticamente: <StatusBadge status={sugerido} /> — o professor pode sobrescrever.
        </p>
        <div className="flex gap-2">
          {(["AUTOMATICO", "OK", "ATENCAO", "CRITICO"] as const).map((opcao) => (
            <form key={opcao} action={atualizarStatusManual.bind(null, aluno.id, opcao)}>
              <button
                className={`rounded-full border px-3 py-1 text-xs ${
                  (opcao === "AUTOMATICO" && !aluno.statusManual) || aluno.statusManual === opcao
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {opcao === "AUTOMATICO" ? "Automático" : opcao}
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Reuniões</h2>
        </div>
        {aluno.reunioes.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhuma reunião registrada ainda.</p>
        )}
        <ul className="divide-y divide-zinc-100">
          {aluno.reunioes.map((reuniao) => (
            <li key={reuniao.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <Link href={`/reunioes/${reuniao.id}`} className="font-medium hover:underline">
                  {formatarDataHora(reuniao.data)}
                </Link>
                <span className="ml-2 text-xs text-zinc-500">{reuniao.status}</span>
                {reuniao.resumo?.status === "PUBLICADO" && (
                  <span className="ml-2 text-xs text-emerald-600">resumo publicado</span>
                )}
              </div>
              <Link href={`/reunioes/${reuniao.id}`} className="text-xs text-zinc-500 hover:text-zinc-900">
                Abrir →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Tarefas</h2>
        <FormErrorBanner action={criarTarefa.bind(null, aluno.id)} className="mb-4 flex gap-2">
          <input name="titulo" placeholder="Nova tarefa" required className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-xs" />
          <input name="responsavel" placeholder="responsável" className="w-28 rounded-md border border-zinc-300 px-2 py-1.5 text-xs" />
          <input name="prazo" type="date" className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs" />
          <SubmitButton className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">
            Adicionar
          </SubmitButton>
        </FormErrorBanner>
        <ul className="space-y-1">
          {tarefasAbertas.map((t) => (
            <li key={t.id} className="flex items-center justify-between text-sm">
              <span>
                {t.titulo}
                {t.responsavel && <span className="ml-2 text-xs text-zinc-400">({t.responsavel})</span>}
                {t.prazo && <span className="ml-2 text-xs text-zinc-500">prazo {formatarData(t.prazo)}</span>}
              </span>
              <form action={concluirTarefa.bind(null, t.id)}>
                <button className="text-xs text-blue-600 hover:underline">Concluir</button>
              </form>
            </li>
          ))}
          {tarefasAbertas.length === 0 && <p className="text-sm text-zinc-500">Nenhuma tarefa em aberto.</p>}
        </ul>
        {tarefasConcluidas.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-zinc-400">
              {tarefasConcluidas.length} concluída(s)
            </summary>
            <ul className="mt-2 space-y-1">
              {tarefasConcluidas.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm text-zinc-400 line-through">
                  <span>{t.titulo}</span>
                  <form action={reabrirTarefa.bind(null, t.id)}>
                    <button className="text-xs text-zinc-400 no-underline hover:text-zinc-700">Reabrir</button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Cronograma (marcos)</h2>
        <FormErrorBanner action={criarMarco.bind(null, aluno.id)} className="mb-4 flex gap-2">
          <input name="titulo" placeholder="Ex.: Qualificação" required className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-xs" />
          <input name="dataPrevista" type="date" required className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs" />
          <SubmitButton className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">
            Adicionar marco
          </SubmitButton>
        </FormErrorBanner>
        <ul className="space-y-1">
          {aluno.marcos.map((m) => (
            <li key={m.id} className="flex items-center justify-between text-sm">
              <span className={m.concluido ? "text-zinc-400 line-through" : ""}>
                {m.titulo} — previsto {formatarData(m.dataPrevista)}
              </span>
              {!m.concluido && (
                <form action={concluirMarco.bind(null, m.id)}>
                  <button className="text-xs text-blue-600 hover:underline">Concluir</button>
                </form>
              )}
            </li>
          ))}
          {aluno.marcos.length === 0 && <p className="text-sm text-zinc-500">Nenhum marco cadastrado.</p>}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Entregas com versões</h2>
        {aluno.entregas.length === 0 && <p className="text-sm text-zinc-500">Nenhuma entrega registrada.</p>}
        <div className="space-y-3">
          {aluno.entregas.map((entrega) => (
            <div key={entrega.id} className="rounded-md border border-zinc-100 p-3">
              <p className="text-sm font-medium">{entrega.titulo}</p>
              {entrega.versoes.map((versao) => (
                <div key={versao.id} className="mt-2 rounded bg-zinc-50 p-2 text-xs">
                  {versao.link && (
                    <a href={versao.link} target="_blank" className="text-blue-600 hover:underline">
                      {versao.link}
                    </a>
                  )}
                  <p className="text-zinc-400">{formatarDataHora(versao.criadoEm)}</p>
                  {versao.feedback ? (
                    <p className="mt-1 text-zinc-700">Feedback: {versao.feedback}</p>
                  ) : (
                    <FormErrorBanner action={darFeedbackVersao.bind(null, versao.id)} className="mt-1 flex gap-1">
                      <input name="feedback" placeholder="Dar feedback..." required className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs" />
                      <SubmitButton className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white">
                        Enviar
                      </SubmitButton>
                    </FormErrorBanner>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Produção acadêmica</h2>
        <ul className="space-y-2">
          {aluno.producoes.map((p) => (
            <li key={p.id} className="text-sm">
              <p className="font-medium">
                {p.titulo}
                {p.venue && <span className="ml-1 text-zinc-500">— {p.venue}</span>}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {OPCOES_STATUS_PRODUCAO.map((s) => (
                  <form key={s} action={atualizarStatusProducao.bind(null, p.id, s)}>
                    <button
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        p.status === s ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-500 hover:bg-zinc-50"
                      }`}
                    >
                      {ROTULOS_STATUS_PRODUCAO[s]}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          ))}
          {aluno.producoes.length === 0 && <p className="text-sm text-zinc-500">Nenhuma produção registrada.</p>}
        </ul>
      </section>

      {aluno.bemEstarAtivo && aluno.bemEstar.length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold">Bem-estar (tendência recente)</h2>
          <div className="flex items-end gap-1">
            {[...aluno.bemEstar].reverse().map((b) => (
              <div
                key={b.id}
                title={`${b.nivel} em ${formatarData(b.criadoEm)}`}
                className="w-6 rounded-t bg-blue-400"
                style={{ height: `${b.nivel * 12}px` }}
              />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Linha do tempo</h2>
        {linhaDoTempo.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum evento ainda.</p>
        ) : (
          <ul className="space-y-2 border-l border-zinc-200 pl-4">
            {linhaDoTempo.map((evento, i) => (
              <li key={i} className="text-sm">
                <p className="text-xs text-zinc-400">{formatarDataHora(evento.data)}</p>
                {evento.link ? (
                  <Link href={evento.link} className="hover:underline">
                    {evento.titulo}
                  </Link>
                ) : (
                  <span>{evento.titulo}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Notas privadas (só você vê)</h2>
          <NotaForm alunoId={aluno.id} tipo="PRIVADA" />
          <ul className="mt-4 space-y-2">
            {notasPrivadas.map((nota) => (
              <li key={nota.id} className="rounded-md bg-zinc-50 p-2 text-sm text-zinc-700">
                <p>{nota.conteudo}</p>
                <p className="mt-1 text-xs text-zinc-400">{formatarDataHora(nota.criadoEm)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Notas compartilhadas (o aluno vê)</h2>
          <NotaForm alunoId={aluno.id} tipo="COMPARTILHADA" />
          <ul className="mt-4 space-y-2">
            {notasCompartilhadas.map((nota) => (
              <li key={nota.id} className="rounded-md bg-zinc-50 p-2 text-sm text-zinc-700">
                <p>{nota.conteudo}</p>
                <p className="mt-1 text-xs text-zinc-400">{formatarDataHora(nota.criadoEm)}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function NotaForm({ alunoId, tipo }: { alunoId: string; tipo: "PRIVADA" | "COMPARTILHADA" }) {
  const acao = criarNota.bind(null, alunoId, null);

  return (
    <FormErrorBanner action={acao} className="space-y-2">
      <input type="hidden" name="tipo" value={tipo} />
      <textarea
        name="conteudo"
        rows={2}
        required
        placeholder="Escreva uma nota..."
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <SubmitButton className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200">
        Salvar nota
      </SubmitButton>
    </FormErrorBanner>
  );
}

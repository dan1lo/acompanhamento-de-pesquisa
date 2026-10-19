import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessor } from "@/lib/guards";
import { diasDesdeUltimaReuniao, LIMITES_PADRAO, statusAutomatico, statusEfetivo } from "@/lib/status";
import { FormErrorBanner } from "@/components/form-error-banner";
import { SubmitButton } from "@/components/submit-button";
import { arquivarAluno, reativarAluno } from "@/lib/actions/notas";
import { criarTarefa, concluirTarefa, reabrirTarefa } from "@/lib/actions/tarefas";
import { criarMarco, concluirMarco } from "@/lib/actions/marcos";
import { confirmarExclusaoDados } from "@/lib/actions/lgpd";
import { buscarExtrasProducoes } from "@/lib/actions/producao";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { montarLinhaDoTempo } from "@/lib/linha-do-tempo";
import { CardPerfilAluno, CardProducoesAluno } from "./ficha-aluno-client";

export default async function FichaAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const professor = await requireProfessor();
  const { id } = await params;

  const aluno = await prisma.aluno.findUnique({
    where: { id },
    include: {
      reunioes: { orderBy: { data: "desc" }, include: { resumo: true } },
      tarefas: { orderBy: [{ status: "asc" }, { prazo: "asc" }] },
      marcos: { orderBy: { dataPrevista: "asc" } },
      producoes: { orderBy: { criadoEm: "desc" } },
      bemEstar: { orderBy: { criadoEm: "desc" }, take: 10 },
      aceiteCiencia: true,
    },
  });

  if (!aluno || aluno.orientadorId !== professor.id) notFound();

  const extrasMap = await buscarExtrasProducoes(aluno.producoes.map((p) => p.id));
  const producoesEnriquecidas = aluno.producoes.map((p) => ({
    ...p,
    overleafUrl: extrasMap[p.id]?.overleafUrl ?? (p as { overleafUrl?: string | null }).overleafUrl ?? null,
    comentariosJson: extrasMap[p.id]?.comentariosJson ?? (p as { comentariosJson?: string | null }).comentariosJson ?? null,
  }));

  const config = await prisma.configuracaoAlerta.findUnique({
    where: { professorId_nivel: { professorId: professor.id, nivel: aluno.nivel } },
  });
  const limites = config
    ? { atencao: config.diasAtencao, critico: config.diasCritico }
    : LIMITES_PADRAO[aluno.nivel];
  const ultimaReuniao = aluno.reunioes.find((r) => r.status === "REALIZADA")?.data ?? null;
  const dataReferencia = (ultimaReuniao ?? aluno.dataInicio).toISOString();
  const dias = diasDesdeUltimaReuniao(ultimaReuniao, aluno.dataInicio);
  const sugerido = statusAutomatico(dias, limites);
  const efetivo = statusEfetivo(aluno.statusManual, sugerido);

  const tarefasAbertas = aluno.tarefas.filter((t) => t.status === "ABERTA");
  const tarefasConcluidas = aluno.tarefas.filter((t) => t.status === "CONCLUIDA");
  const marcosConcluidos = aluno.marcos.filter((m) => m.concluido).length;
  const linhaDoTempo = await montarLinhaDoTempo(aluno.id);

  return (
    <div className="relative min-h-[calc(100vh-12rem)] flex flex-col pb-16 text-left">
      {/* Descrição da página alinhada à esquerda logo abaixo da topbar */}
      <div className="mb-6 sm:mb-8 text-left w-full">
        <p className="text-sm sm:text-base text-zinc-600 font-spectral leading-relaxed text-left">
          Acompanhe e gerencie com mais detalhes a situação dos seus alunos/orientandos.
        </p>
      </div>

      {/* Container centralizado para os cards */}
      <div className="w-full max-w-5xl mx-auto space-y-6">
        {/* 1º Card: Perfil do Aluno + Dias sem reunião + Status clicável */}
        <CardPerfilAluno
          alunoId={aluno.id}
          nome={aluno.nome}
          email={aluno.email}
          nivel={aluno.nivel}
          tema={aluno.tema}
          diasIniciais={dias}
          dataReferencia={dataReferencia}
          statusInicial={efetivo}
          contaPendente={!aluno.usuarioId}
          arquivado={aluno.arquivado}
        />

        {aluno.exclusaoSolicitadaEm && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-xs">
            <p className="text-sm text-red-800 font-spectral">
              O aluno solicitou exclusão dos dados em {formatarDataHora(aluno.exclusaoSolicitadaEm)} (LGPD).
            </p>
            <form action={confirmarExclusaoDados.bind(null, aluno.id)} className="mt-3">
              <button className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors font-karla cursor-pointer">
                Confirmar e excluir permanentemente
              </button>
            </form>
          </section>
        )}

        {/* 2º Card: Reuniões (largura total do container, antes de Produções Acadêmicas) */}
        <section className="w-full rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 pb-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 font-karla">
                Reuniões
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 font-spectral">
                Histórico de encontros de orientação, pautas e resumos publicados.
              </p>
            </div>
            <span className="inline-flex items-center self-start sm:self-auto rounded-full bg-[#133C1B]/10 px-3 py-1 text-xs font-bold text-[#133C1B] font-karla">
              {aluno.reunioes.length} {aluno.reunioes.length === 1 ? "reunião" : "reuniões"}
            </span>
          </div>

          {aluno.reunioes.length === 0 ? (
            <p className="text-sm text-zinc-500 font-spectral py-3">
              Nenhuma reunião registrada ainda.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {aluno.reunioes.map((reuniao) => (
                <li
                  key={reuniao.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 text-sm hover:bg-zinc-50/60 rounded-xl px-2 -mx-2 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      href={`/reunioes/${reuniao.id}`}
                      className="font-bold text-zinc-900 hover:text-[#133C1B] hover:underline font-karla"
                    >
                      {formatarDataHora(reuniao.data)}
                    </Link>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 border border-zinc-200/80 font-karla">
                      {reuniao.status}
                    </span>
                    {reuniao.resumo?.status === "PUBLICADO" && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/80 font-karla">
                        Resumo publicado
                      </span>
                    )}
                    {reuniao.pauta && (
                      <span className="text-xs text-zinc-500 font-spectral truncate max-w-md">
                        — {reuniao.pauta}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/reunioes/${reuniao.id}`}
                    className="inline-flex items-center gap-1 self-start sm:self-auto rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#133C1B] hover:bg-zinc-50 transition-colors font-karla shrink-0"
                  >
                    <span>Abrir</span>
                    <span>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 3º Card: Produções Acadêmicas (Mini versão da página de produções + visualização e marcação de texto) */}
        <CardProducoesAluno producoesIniciais={producoesEnriquecidas} />

        {/* 4º Card: Tarefas (largura total do container) */}
        <section className="w-full rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 pb-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 font-karla">
                Tarefas
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 font-spectral">
                Gerencie as atividades, prazos e entregas combinadas com o orientando.
              </p>
            </div>
            <span className="inline-flex items-center self-start sm:self-auto rounded-full bg-[#133C1B]/10 px-3 py-1 text-xs font-bold text-[#133C1B] font-karla">
              {tarefasAbertas.length} {tarefasAbertas.length === 1 ? "aberta" : "abertas"}
            </span>
          </div>

          <FormErrorBanner
            action={criarTarefa.bind(null, aluno.id)}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 rounded-xl bg-zinc-50/70 border border-zinc-200/70 p-3"
          >
            <input
              name="titulo"
              placeholder="Descrição da nova tarefa..."
              required
              className="flex-1 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs sm:text-sm focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 font-spectral"
            />
            <input
              name="responsavel"
              placeholder="Responsável (opcional)"
              className="sm:w-44 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs sm:text-sm focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 font-spectral"
            />
            <input
              name="prazo"
              type="date"
              className="sm:w-40 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs sm:text-sm focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 font-spectral"
            />
            <SubmitButton className="rounded-xl bg-[#133C1B] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#1a4f24] transition-colors font-karla cursor-pointer shrink-0">
              Adicionar tarefa
            </SubmitButton>
          </FormErrorBanner>

          <ul className="space-y-2">
            {tarefasAbertas.map((t) => (
              <li
                key={t.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl bg-zinc-50/80 border border-zinc-200/60 px-4 py-2.5 text-sm hover:bg-zinc-50 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-spectral font-medium text-zinc-900">{t.titulo}</span>
                  {t.responsavel && (
                    <span className="rounded-md bg-zinc-200/70 px-2 py-0.5 text-xs font-medium text-zinc-600 font-karla">
                      {t.responsavel}
                    </span>
                  )}
                  {t.prazo && (
                    <span className="rounded-md bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-xs font-medium text-amber-800 font-karla">
                      Prazo: {formatarData(t.prazo)}
                    </span>
                  )}
                </div>
                <form action={concluirTarefa.bind(null, t.id)} className="self-end sm:self-auto">
                  <button className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1 text-xs font-semibold text-[#133C1B] hover:bg-emerald-100 transition-colors font-karla cursor-pointer">
                    ✓ Concluir
                  </button>
                </form>
              </li>
            ))}
            {tarefasAbertas.length === 0 && (
              <p className="text-sm text-zinc-500 font-spectral py-2">Nenhuma tarefa em aberto.</p>
            )}
          </ul>

          {tarefasConcluidas.length > 0 && (
            <details className="pt-2 border-t border-zinc-100">
              <summary className="cursor-pointer text-xs font-semibold text-zinc-500 hover:text-zinc-800 font-karla">
                Ver {tarefasConcluidas.length} tarefa(s) concluída(s)
              </summary>
              <ul className="mt-2.5 space-y-1.5">
                {tarefasConcluidas.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-xl bg-zinc-50/50 px-3.5 py-2 text-sm text-zinc-400 line-through"
                  >
                    <span className="font-spectral">{t.titulo}</span>
                    <form action={reabrirTarefa.bind(null, t.id)}>
                      <button className="text-xs font-semibold text-zinc-500 no-underline hover:text-zinc-800 font-karla cursor-pointer">
                        Reabrir
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {/* 5º Card: Cronograma (Marcos) (largura total do container) */}
        <section className="w-full rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 pb-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 font-karla">
                Cronograma (Marcos)
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 font-spectral">
                Defina e acompanhe as etapas principais da pesquisa (qualificação, entrega parcial, defesa, etc.).
              </p>
            </div>
            <span className="inline-flex items-center self-start sm:self-auto rounded-full bg-[#133C1B]/10 px-3 py-1 text-xs font-bold text-[#133C1B] font-karla">
              {marcosConcluidos}/{aluno.marcos.length} concluídos
            </span>
          </div>

          <FormErrorBanner
            action={criarMarco.bind(null, aluno.id)}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 rounded-xl bg-zinc-50/70 border border-zinc-200/70 p-3"
          >
            <input
              name="titulo"
              placeholder="Ex.: Entrega da Qualificação / Submissão do Artigo..."
              required
              className="flex-1 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs sm:text-sm focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 font-spectral"
            />
            <input
              name="dataPrevista"
              type="date"
              required
              className="sm:w-44 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs sm:text-sm focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 font-spectral"
            />
            <SubmitButton className="rounded-xl bg-[#133C1B] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#1a4f24] transition-colors font-karla cursor-pointer shrink-0">
              Adicionar marco
            </SubmitButton>
          </FormErrorBanner>

          <ul className="space-y-2">
            {aluno.marcos.map((m) => (
              <li
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl bg-zinc-50/80 border border-zinc-200/60 px-4 py-2.5 text-sm hover:bg-zinc-50 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={
                      m.concluido
                        ? "text-zinc-400 line-through font-spectral"
                        : "text-zinc-900 font-medium font-spectral"
                    }
                  >
                    {m.titulo}
                  </span>
                  <span className="rounded-md bg-zinc-100 border border-zinc-200/80 px-2 py-0.5 text-xs font-medium text-zinc-600 font-karla">
                    Previsto: {formatarData(m.dataPrevista)}
                  </span>
                  {m.concluido && (
                    <span className="rounded-md bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-xs font-semibold text-emerald-700 font-karla">
                      Concluído
                    </span>
                  )}
                </div>
                {!m.concluido && (
                  <form action={concluirMarco.bind(null, m.id)} className="self-end sm:self-auto">
                    <button className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1 text-xs font-semibold text-[#133C1B] hover:bg-emerald-100 transition-colors font-karla cursor-pointer">
                      ✓ Concluir
                    </button>
                  </form>
                )}
              </li>
            ))}
            {aluno.marcos.length === 0 && (
              <p className="text-sm text-zinc-500 font-spectral py-2">Nenhum marco cadastrado.</p>
            )}
          </ul>
        </section>

        {/* Bem-estar (se ativo) */}
        {aluno.bemEstarAtivo && aluno.bemEstar.length > 0 && (
          <section className="w-full rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs">
            <h2 className="mb-3 text-base font-bold text-zinc-900 font-karla">
              Bem-estar (Tendência Recente)
            </h2>
            <div className="flex items-end gap-1.5 pt-2">
              {[...aluno.bemEstar].reverse().map((b) => (
                <div
                  key={b.id}
                  title={`${b.nivel} em ${formatarData(b.criadoEm)}`}
                  className="w-7 rounded-t-md bg-[#133C1B]/80 hover:bg-[#133C1B] transition-colors"
                  style={{ height: `${b.nivel * 14}px` }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Linha do tempo */}
        <section className="w-full rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs">
          <h2 className="mb-4 text-base font-bold text-zinc-900 font-karla border-b border-zinc-100 pb-2.5">
            Linha do Tempo
          </h2>
          {linhaDoTempo.length === 0 ? (
            <p className="text-sm text-zinc-500 font-spectral">Nenhum evento ainda.</p>
          ) : (
            <ul className="space-y-3 border-l-2 border-[#133C1B]/25 pl-4">
              {linhaDoTempo.map((evento, i) => (
                <li key={i} className="text-sm font-spectral">
                  <p className="text-xs text-zinc-400">{formatarDataHora(evento.data)}</p>
                  {evento.link ? (
                    <Link href={evento.link} className="font-medium text-zinc-800 hover:text-[#133C1B] hover:underline">
                      {evento.titulo}
                    </Link>
                  ) : (
                    <span className="text-zinc-800">{evento.titulo}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Botões maiores no final da página: Baixar relatório em PDF e Arquivar/Reativar aluno */}
        <div className="pt-4 border-t border-zinc-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <a
            href={`/api/relatorio/${aluno.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#133C1B] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#1a4f24] active:scale-[0.99] transition-all font-karla cursor-pointer"
          >
            <svg className="h-4.5 w-4.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            <span>Baixar relatório em PDF</span>
          </a>

          {aluno.arquivado ? (
            <form action={reativarAluno.bind(null, aluno.id)} className="flex">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-100 active:scale-[0.99] transition-all font-karla cursor-pointer"
              >
                <svg className="h-4.5 w-4.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Reativar aluno</span>
              </button>
            </form>
          ) : (
            <form action={arquivarAluno.bind(null, aluno.id)} className="flex">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 shadow-2xs hover:bg-red-100 active:scale-[0.99] transition-all font-karla cursor-pointer"
              >
                <svg className="h-4.5 w-4.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                  />
                </svg>
                <span>Arquivar aluno</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

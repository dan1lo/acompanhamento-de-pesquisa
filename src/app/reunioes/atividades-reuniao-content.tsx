"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  GestaoAtividadesResponse,
  TarefaReuniaoItem,
  ResponsavelTipo,
  ReuniaoComAtividades,
} from "@/lib/actions/atividades-reuniao";
import {
  criarTarefaReuniao,
  atualizarStatusTarefaReuniao,
  atualizarTarefaReuniao,
  excluirTarefaReuniao,
} from "@/lib/actions/atividades-reuniao";

interface AtividadesReuniaoContentProps {
  gestaoInicial: GestaoAtividadesResponse;
  alunoSelecionadoId?: string;
}

export function AtividadesReuniaoContent({
  gestaoInicial,
  alunoSelecionadoId,
}: AtividadesReuniaoContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [filtroResp, setFiltroResp] = useState<string>("TODOS");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");
  const [periodoAtivo, setPeriodoAtivo] = useState<
    "30" | "60" | "180" | "geral"
  >("30");

  // Modais
  const [modalNovaTarefaReuniaoId, setModalNovaTarefaReuniaoId] = useState<
    string | null
  >(null);
  const [modalEditarTarefa, setModalEditarTarefa] =
    useState<TarefaReuniaoItem | null>(null);

  // Form Nova Tarefa
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavelTipo, setResponsavelTipo] =
    useState<ResponsavelTipo>("ALUNO");
  const [prazo, setPrazo] = useState("");

  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const isAluno = gestaoInicial.isAluno;
  const orientandos = gestaoInicial.orientandos || [];

  const handleMudarAluno = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    router.push(`/reunioes?aba=atividades&alunoId=${id}`);
  };

  const handleToggleStatus = (t: TarefaReuniaoItem) => {
    const novo = t.status === "CONCLUIDA" ? "ABERTA" : "CONCLUIDA";
    startTransition(async () => {
      const res = await atualizarStatusTarefaReuniao(t.id, novo);
      if (res.ok) {
        router.refresh();
      } else {
        setErro("Erro ao alterar status da tarefa");
      }
    });
  };

  const handleCriarTarefa = () => {
    if (!titulo.trim()) {
      setErro("Informe o título da atividade.");
      return;
    }

    startTransition(async () => {
      const res = await criarTarefaReuniao({
        alunoId: gestaoInicial.alunoId,
        reuniaoId: modalNovaTarefaReuniaoId || "",
        titulo,
        descricao,
        responsavelTipo,
        prazo: prazo || undefined,
      });

      if (res.ok) {
        setSucesso("Atividade adicionada com sucesso!");
        setModalNovaTarefaReuniaoId(null);
        setTitulo("");
        setDescricao("");
        setPrazo("");
        router.refresh();
      } else {
        setErro("Erro ao criar atividade");
      }
    });
  };

  const handleSalvarEdicao = () => {
    if (!modalEditarTarefa) return;

    startTransition(async () => {
      const res = await atualizarTarefaReuniao(modalEditarTarefa.id, {
        titulo: modalEditarTarefa.titulo,
        descricao: modalEditarTarefa.descricao || undefined,
        responsavelTipo: modalEditarTarefa.responsavelTipo,
        prazo: modalEditarTarefa.prazo || undefined,
        status: modalEditarTarefa.status,
      });

      if (res.ok) {
        setSucesso("Atividade atualizada!");
        setModalEditarTarefa(null);
        router.refresh();
      } else {
        setErro("Erro ao salvar atividade");
      }
    });
  };

  const handleExcluir = (id: string) => {
    if (!confirm("Deseja realmente excluir esta atividade?")) return;

    startTransition(async () => {
      const res = await excluirTarefaReuniao(id);
      if (res.ok) {
        setSucesso("Atividade excluída!");
        router.refresh();
      } else {
        setErro("Erro ao excluir atividade");
      }
    });
  };

  const renderBadgeResp = (tipo: ResponsavelTipo) => {
    switch (tipo) {
      case "PROFESSOR":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
            Professor
          </span>
        );
      case "AMBOS":
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
            Ambos
          </span>
        );
      case "ALUNO":
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
            Aluno
          </span>
        );
    }
  };

  const indicadorSelecionado =
    periodoAtivo === "30"
      ? gestaoInicial.indicadores.ultimos30Dias
      : periodoAtivo === "60"
      ? gestaoInicial.indicadores.ultimos60Dias
      : periodoAtivo === "180"
      ? gestaoInicial.indicadores.semestre
      : gestaoInicial.indicadores.geral;

  return (
    <div className="w-full space-y-6">
      {/* Barra de Filtros e Seleção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200/90 shadow-xs print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {!isAluno && orientandos.length > 0 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="select-aluno-ativ"
                className="text-xs font-bold font-karla text-zinc-500 uppercase tracking-wider"
              >
                Orientando:
              </label>
              <select
                id="select-aluno-ativ"
                value={alunoSelecionadoId || gestaoInicial.alunoId}
                onChange={handleMudarAluno}
                className="text-xs sm:text-sm font-spectral border border-zinc-300 rounded-xl px-3 py-1.5 bg-white text-zinc-800 shadow-xs focus:outline-none focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20"
              >
                {orientandos.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome} ({o.nivel})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-karla text-zinc-500 uppercase">
              Responsável:
            </span>
            <select
              value={filtroResp}
              onChange={(e) => setFiltroResp(e.target.value)}
              className="text-xs sm:text-sm font-spectral border border-zinc-300 rounded-xl px-2.5 py-1.5 bg-white text-zinc-800 shadow-xs focus:outline-none focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20"
            >
              <option value="TODOS">Todos os responsáveis</option>
              <option value="ALUNO">Apenas Aluno</option>
              <option value="PROFESSOR">Apenas Professor</option>
              <option value="AMBOS">Ambos</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-karla text-zinc-500 uppercase">
              Status:
            </span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="text-xs sm:text-sm font-spectral border border-zinc-300 rounded-xl px-2.5 py-1.5 bg-white text-zinc-800 shadow-xs focus:outline-none focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20"
            >
              <option value="TODOS">Todos os status</option>
              <option value="ABERTA">Abertas</option>
              <option value="CONCLUIDA">Concluídas</option>
            </select>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setModalNovaTarefaReuniaoId("")}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold font-karla text-white bg-[#133C1B] hover:bg-[#133C1B]/90 rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            + Nova Atividade Avulsa
          </button>
        </div>
      </div>

      {/* Alertas */}
      {sucesso && (
        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 text-emerald-900 rounded-xl text-sm font-spectral flex items-center justify-between shadow-2xs">
          <span>✓ {sucesso}</span>
          <button
            onClick={() => setSucesso(null)}
            className="text-emerald-700 font-bold hover:text-emerald-900 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {erro && (
        <div className="p-3.5 bg-red-50/80 border border-red-200 text-red-900 rounded-xl text-sm font-spectral flex items-center justify-between shadow-2xs">
          <span className="inline-flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {erro}
          </span>
          <button
            onClick={() => setErro(null)}
            className="text-red-700 font-bold hover:text-red-900 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* INDICADORES DE % DE CONCLUSÃO POR PERÍODO */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-zinc-200/90 shadow-xs space-y-4 font-spectral">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold font-karla text-[#133C1B] uppercase tracking-wide">
              Taxa de Resolução de Atividades
            </span>
            <h3 className="text-lg font-bold font-karla text-zinc-900">
              Desempenho por Período
            </h3>
          </div>

          {/* Seletor de período */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl font-karla">
            <button
              type="button"
              onClick={() => setPeriodoAtivo("30")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                periodoAtivo === "30"
                  ? "bg-white text-[#133C1B] shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900 font-medium"
              }`}
            >
              Últimos 30 dias
            </button>
            <button
              type="button"
              onClick={() => setPeriodoAtivo("60")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                periodoAtivo === "60"
                  ? "bg-white text-[#133C1B] shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900 font-medium"
              }`}
            >
              Últimos 60 dias
            </button>
            <button
              type="button"
              onClick={() => setPeriodoAtivo("180")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                periodoAtivo === "180"
                  ? "bg-white text-[#133C1B] shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900 font-medium"
              }`}
            >
              Semestre
            </button>
            <button
              type="button"
              onClick={() => setPeriodoAtivo("geral")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                periodoAtivo === "geral"
                  ? "bg-white text-[#133C1B] shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900 font-medium"
              }`}
            >
              Total Geral
            </button>
          </div>
        </div>

        {/* Barra de Progresso e Métricas do Período Ativo */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="text-zinc-700">
              Taxa de Conclusão:{" "}
              <strong className="text-[#133C1B] font-karla font-bold">
                {indicadorSelecionado.taxaConclusao}%
              </strong>
            </span>
            <span className="text-xs text-zinc-500 font-spectral">
              {indicadorSelecionado.concluidas} de {indicadorSelecionado.total} atividades concluídas
            </span>
          </div>

          <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-[#133C1B] h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${indicadorSelecionado.taxaConclusao}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-zinc-100 text-center">
          <div className="p-3 bg-zinc-50/70 border border-zinc-200/80 rounded-xl shadow-2xs">
            <div className="text-base font-bold font-karla text-zinc-900">
              {indicadorSelecionado.total}
            </div>
            <div className="text-[11px] text-zinc-500 font-spectral">Atividades no Período</div>
          </div>
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl shadow-2xs">
            <div className="text-base font-bold font-karla text-emerald-800">
              {indicadorSelecionado.concluidas}
            </div>
            <div className="text-[11px] text-emerald-700 font-spectral">Concluídas</div>
          </div>
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl shadow-2xs">
            <div className="text-base font-bold font-karla text-amber-800">
              {indicadorSelecionado.pendentes}
            </div>
            <div className="text-[11px] text-amber-700 font-spectral">Pendentes</div>
          </div>
          <div className="p-3 bg-red-50/70 border border-red-200/80 rounded-xl shadow-2xs">
            <div className="text-base font-bold font-karla text-red-800">
              {indicadorSelecionado.atrasadas}
            </div>
            <div className="text-[11px] text-red-700 font-spectral">Atrasadas</div>
          </div>
        </div>
      </div>

      {/* GESTÃO POR REUNIÃO E COMPARATIVO (O QUE EVOLUIU vs O QUE ESTAGNOU) */}
      <div className="space-y-6">
        {gestaoInicial.reunioes.length === 0 ? (
          <div className="p-12 text-center bg-white border border-zinc-200/90 rounded-2xl text-zinc-500 text-sm font-spectral shadow-xs">
            Nenhuma reunião com atividades registradas para este orientando.
          </div>
        ) : (
          gestaoInicial.reunioes.map((r) => {
            const tarefasVisiveis = r.tarefas.filter((t) => {
              if (filtroResp !== "TODOS" && t.responsavelTipo !== filtroResp)
                return false;
              if (filtroStatus !== "TODOS" && t.status !== filtroStatus)
                return false;
              return true;
            });

            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-5 sm:p-6 space-y-5 hover:border-[#133C1B]/30 transition-all font-spectral"
              >
                {/* Topo da Reunião */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#133C1B]"></span>
                    <h3 className="font-bold font-karla text-base text-zinc-900">
                      Reunião de {new Date(`${r.dataStr}T12:00:00Z`).toLocaleDateString("pt-BR")} às {r.horarioStr}
                    </h3>
                    <span className="text-xs bg-zinc-100 text-zinc-700 px-2.5 py-0.5 rounded-lg font-karla font-semibold">
                      {r.tarefas.length} atividades
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModalNovaTarefaReuniaoId(r.id)}
                    className="text-xs font-bold font-karla px-3.5 py-1.5 bg-[#133C1B]/10 text-[#133C1B] hover:bg-[#133C1B]/20 border border-[#133C1B]/20 rounded-xl self-end sm:self-auto transition-colors shadow-2xs cursor-pointer"
                  >
                    + Adicionar Atividade neste Encontro
                  </button>
                </div>

                {/* Lista de Atividades Vinculadas a este Encontro */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
                    Atividades do Encontro:
                  </span>

                  {tarefasVisiveis.length === 0 ? (
                    <div className="text-xs text-zinc-400 italic py-2">
                      Nenhuma atividade com os filtros selecionados.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tarefasVisiveis.map((t) => (
                        <div
                          key={t.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200/80 bg-zinc-50/50 hover:bg-white transition-all text-sm font-spectral"
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={t.status === "CONCLUIDA"}
                              onChange={() => handleToggleStatus(t)}
                              className="mt-1 h-4 w-4 rounded border-zinc-300 accent-[#133C1B] text-[#133C1B] focus:ring-[#133C1B] cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`font-semibold ${
                                    t.status === "CONCLUIDA"
                                      ? "line-through text-zinc-400"
                                      : "text-zinc-800"
                                  }`}
                                >
                                  {t.titulo}
                                </span>
                                {renderBadgeResp(t.responsavelTipo)}
                                {t.atrasada && (
                                  <span className="text-[10px] font-bold font-karla px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                                    Atrasada
                                  </span>
                                )}
                              </div>
                              {t.descricao && (
                                <p className="text-xs text-zinc-500 font-spectral mt-0.5">
                                  {t.descricao}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-auto text-xs text-zinc-500 font-spectral">
                            {t.prazo && (
                              <span>
                                Prazo:{" "}
                                <strong className="text-zinc-700 font-karla">
                                  {new Date(`${t.prazo}T12:00:00Z`).toLocaleDateString("pt-BR")}
                                </strong>
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => setModalEditarTarefa(t)}
                              className="text-zinc-600 hover:text-zinc-900 font-semibold font-karla cursor-pointer transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluir(t.id)}
                              className="text-red-600 hover:text-red-800 font-semibold font-karla cursor-pointer transition-colors"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* QUADRO COMPARATIVO COM A REUNIÃO ANTERIOR */}
                {r.comparativoComAnterior && (
                  <div className="p-4 sm:p-5 bg-zinc-50/70 rounded-2xl border border-zinc-200/80 space-y-3 font-spectral">
                    <div className="flex items-center justify-between border-b border-zinc-200/80 pb-2">
                      <span className="text-xs font-bold font-karla text-zinc-800 uppercase tracking-wide inline-flex items-center gap-1.5">
                        <svg className="h-4 w-4 text-[#133C1B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Comparativo com a Reunião Anterior ({r.comparativoComAnterior.reuniaoAnteriorDataStr})
                      </span>
                      <span className="text-[11px] text-zinc-500 font-spectral">
                        Evolução no intervalo entre encontros
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* O que evoluiu */}
                      <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2 font-spectral">
                        <span className="text-xs font-bold font-karla text-emerald-800 flex items-center gap-1">
                          <span>✓</span> O Que Evoluiu ({r.comparativoComAnterior.evoluiuTarefas.length}):
                        </span>
                        {r.comparativoComAnterior.evoluiuTarefas.length === 0 ? (
                          <p className="text-xs text-zinc-500 italic">
                            Nenhuma tarefa da reunião anterior foi concluída neste intervalo.
                          </p>
                        ) : (
                          <ul className="text-xs text-zinc-700 space-y-1">
                            {r.comparativoComAnterior.evoluiuTarefas.map((et) => (
                              <li key={et.id} className="flex items-center gap-1.5">
                                <span className="text-[#133C1B] font-bold">•</span>
                                <span className="line-through text-zinc-500">
                                  {et.titulo}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* O que estagnou */}
                      <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2 font-spectral">
                        <span className="text-xs font-bold font-karla text-amber-800 flex items-center gap-1.5">
                          <svg className="h-3.5 w-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          O Que Estagnou ({r.comparativoComAnterior.estagnouTarefas.length}):
                        </span>
                        {r.comparativoComAnterior.estagnouTarefas.length === 0 ? (
                          <p className="text-xs text-emerald-800 font-medium italic">
                            Excelente! Nenhuma pendência estagnada da reunião anterior.
                          </p>
                        ) : (
                          <ul className="text-xs text-zinc-700 space-y-1">
                            {r.comparativoComAnterior.estagnouTarefas.map((st) => (
                              <li key={st.id} className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-amber-600 font-bold">•</span>
                                  <span className="font-medium">{st.titulo}</span>
                                </div>
                                <span className="text-[10px] bg-white border border-amber-200 px-1.5 py-0.5 rounded-md font-karla font-semibold text-amber-800">
                                  Pendente
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL NOVA TAREFA */}
      {modalNovaTarefaReuniaoId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-4 text-left font-spectral">
            <h3 className="text-lg font-bold font-karla text-zinc-900">
              {modalNovaTarefaReuniaoId
                ? "Adicionar Atividade da Reunião"
                : "Adicionar Atividade Avulsa"}
            </h3>

            <div>
              <label
                htmlFor="modal-ativ-titulo"
                className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
              >
                Título da Atividade:
              </label>
              <input
                id="modal-ativ-titulo"
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Revisar Seção 3 e enviar nova versão"
                className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="modal-ativ-resp"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Responsável:
                </label>
                <select
                  id="modal-ativ-resp"
                  value={responsavelTipo}
                  onChange={(e) =>
                    setResponsavelTipo(e.target.value as ResponsavelTipo)
                  }
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none bg-white shadow-xs"
                >
                  <option value="ALUNO">Aluno</option>
                  <option value="PROFESSOR">Professor</option>
                  <option value="AMBOS">Ambos</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="modal-ativ-prazo"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Prazo:
                </label>
                <input
                  id="modal-ativ-prazo"
                  type="date"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="modal-ativ-desc"
                className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
              >
                Instruções / Detalhes:
              </label>
              <textarea
                id="modal-ativ-desc"
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Detalhes ou orientações adicionais..."
                className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setModalNovaTarefaReuniaoId(null)}
                className="px-4 py-2 text-sm font-semibold font-karla text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCriarTarefa}
                disabled={isPending}
                className="px-4 py-2 text-sm font-bold font-karla text-white bg-[#133C1B] hover:bg-[#133C1B]/90 rounded-xl disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                Salvar Atividade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR TAREFA */}
      {modalEditarTarefa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-4 text-left font-spectral">
            <h3 className="text-lg font-bold font-karla text-zinc-900">
              Editar Atividade
            </h3>

            <div>
              <label
                htmlFor="modal-edit-ativ-titulo"
                className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
              >
                Título:
              </label>
              <input
                id="modal-edit-ativ-titulo"
                type="text"
                value={modalEditarTarefa.titulo}
                onChange={(e) =>
                  setModalEditarTarefa({
                    ...modalEditarTarefa,
                    titulo: e.target.value,
                  })
                }
                className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="modal-edit-ativ-resp"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Responsável:
                </label>
                <select
                  id="modal-edit-ativ-resp"
                  value={modalEditarTarefa.responsavelTipo}
                  onChange={(e) =>
                    setModalEditarTarefa({
                      ...modalEditarTarefa,
                      responsavelTipo: e.target.value as ResponsavelTipo,
                    })
                  }
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none bg-white shadow-xs"
                >
                  <option value="ALUNO">Aluno</option>
                  <option value="PROFESSOR">Professor</option>
                  <option value="AMBOS">Ambos</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="modal-edit-ativ-status"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Status:
                </label>
                <select
                  id="modal-edit-ativ-status"
                  value={modalEditarTarefa.status}
                  onChange={(e) =>
                    setModalEditarTarefa({
                      ...modalEditarTarefa,
                      status: e.target.value as "ABERTA" | "CONCLUIDA",
                    })
                  }
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none bg-white shadow-xs"
                >
                  <option value="ABERTA">Aberta</option>
                  <option value="CONCLUIDA">Concluída</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="modal-edit-ativ-prazo"
                className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
              >
                Prazo:
              </label>
              <input
                id="modal-edit-ativ-prazo"
                type="date"
                value={modalEditarTarefa.prazo || ""}
                onChange={(e) =>
                  setModalEditarTarefa({
                    ...modalEditarTarefa,
                    prazo: e.target.value || null,
                  })
                }
                className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
              />
            </div>

            <div>
              <label
                htmlFor="modal-edit-ativ-desc"
                className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
              >
                Descrição:
              </label>
              <textarea
                id="modal-edit-ativ-desc"
                rows={2}
                value={modalEditarTarefa.descricao || ""}
                onChange={(e) =>
                  setModalEditarTarefa({
                    ...modalEditarTarefa,
                    descricao: e.target.value || null,
                  })
                }
                className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setModalEditarTarefa(null)}
                className="px-4 py-2 text-sm font-semibold font-karla text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarEdicao}
                disabled={isPending}
                className="px-4 py-2 text-sm font-bold font-karla text-white bg-[#133C1B] hover:bg-[#133C1B]/90 rounded-xl disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


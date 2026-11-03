"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  RoadmapResponse,
  MarcoRoadmapItem,
  StatusMarco,
  TarefaVinculadaMarco,
} from "@/lib/actions/roadmap";
import {
  criarMarcoRoadmap,
  atualizarMarcoRoadmap,
  excluirMarcoRoadmap,
  aplicarTemplateRoadmap,
  alternarStatusTarefaMarco,
  atualizarStatusRapidoMarco,
} from "@/lib/actions/roadmap";
import { criarTarefaReuniao } from "@/lib/actions/atividades-reuniao";

interface RoadmapContentProps {
  roadmapInicial: RoadmapResponse;
  alunoSelecionadoId?: string;
}

export function RoadmapContent({
  roadmapInicial,
  alunoSelecionadoId,
}: RoadmapContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [roadmap, setRoadmap] = useState<RoadmapResponse>(roadmapInicial);
  const [visualizacao, setVisualizacao] = useState<"QUADRO" | "GRADE" | "GANTT">(
    "QUADRO"
  );

  // Filtros de busca e visualização
  const [filtroStatus, setFiltroStatus] = useState<string>("TODAS");
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("TODOS");
  const [buscaTexto, setBuscaTexto] = useState("");

  // Modais
  const [modalNovoMarcoAberto, setModalNovoMarcoAberto] = useState(false);
  const [modalEditarMarco, setModalEditarMarco] = useState<MarcoRoadmapItem | null>(null);
  const [modalTemplateAberto, setModalTemplateAberto] = useState(false);
  const [modalNovaTarefaMarco, setModalNovaTarefaMarco] = useState<string | null>(null);
  const [modalAlunosAberto, setModalAlunosAberto] = useState(false);
  const [buscaAluno, setBuscaAluno] = useState("");

  // Formulário Nova Atividade
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novaEstimativaPaginas, setNovaEstimativaPaginas] = useState("");
  const [novoResponsavel, setNovoResponsavel] = useState<"ALUNO" | "PROFESSOR" | "AMBOS">("AMBOS");
  const [novoPrazo, setNovoPrazo] = useState("");

  // Formulário Nova Subtarefa
  const [tarefaTitulo, setTarefaTitulo] = useState("");
  const [tarefaRespTipo, setTarefaRespTipo] = useState<"ALUNO" | "PROFESSOR" | "AMBOS">("ALUNO");
  const [tarefaPrazo, setTarefaPrazo] = useState("");

  // Mensagens
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const isAluno = roadmap.isAluno;

  // Atualiza estado local quando roadmapInicial muda
  if (roadmapInicial !== roadmap && roadmapInicial.alunoId !== roadmap.alunoId) {
    setRoadmap(roadmapInicial);
  }

  const orientandosFiltrados = useMemo(() => {
    if (!roadmap.orientandos) return [];
    if (!buscaAluno.trim()) return roadmap.orientandos;
    const q = buscaAluno.toLowerCase();
    return roadmap.orientandos.filter(
      (o) => o.nome.toLowerCase().includes(q) || o.nivel.toLowerCase().includes(q)
    );
  }, [roadmap.orientandos, buscaAluno]);

  const handleCriarAtividade = () => {
    if (!novoTitulo.trim() || !novoPrazo) {
      setErro("Informe o título e o prazo planejado para a atividade.");
      return;
    }

    startTransition(async () => {
      const res = await criarMarcoRoadmap({
        alunoId: roadmap.alunoId,
        titulo: novoTitulo,
        descricao: novaDescricao,
        estimativaPaginas: novaEstimativaPaginas,
        responsavelTipo: novoResponsavel,
        prazoPlanejado: novoPrazo,
      });

      if (res.ok) {
        setSucesso("Nova atividade adicionada com sucesso!");
        setModalNovoMarcoAberto(false);
        setNovoTitulo("");
        setNovaDescricao("");
        setNovaEstimativaPaginas("");
        setNovoResponsavel("AMBOS");
        setNovoPrazo("");
        router.refresh();
      } else {
        setErro(res.erro || "Erro ao criar atividade");
      }
    });
  };

  const handleSalvarEdicaoAtividade = () => {
    if (!modalEditarMarco) return;

    startTransition(async () => {
      const res = await atualizarMarcoRoadmap(modalEditarMarco.id, {
        titulo: modalEditarMarco.titulo,
        descricao: modalEditarMarco.descricao ?? undefined,
        estimativaPaginas: modalEditarMarco.estimativaPaginas ?? undefined,
        fase: modalEditarMarco.fase,
        responsavelTipo: modalEditarMarco.responsavelTipo ?? "AMBOS",
        prazoPlanejado: modalEditarMarco.prazoPlanejado,
        prazoRealizado: modalEditarMarco.prazoRealizado,
        status: modalEditarMarco.status,
        porcentagem: modalEditarMarco.porcentagem,
      });

      if (res.ok) {
        setSucesso("Atividade atualizada com sucesso!");
        setModalEditarMarco(null);
        router.refresh();
      } else {
        setErro(res.erro || "Erro ao atualizar atividade");
      }
    });
  };

  const handleExcluirAtividade = (id: string, titulo: string) => {
    if (!confirm(`Tem certeza que deseja excluir a atividade "${titulo}"?`)) return;

    startTransition(async () => {
      const res = await excluirMarcoRoadmap(id);
      if (res.ok) {
        setSucesso("Atividade excluída com sucesso!");
        router.refresh();
      } else {
        setErro(res.erro || "Erro ao excluir atividade");
      }
    });
  };

  const handleMudarStatusRapido = (marcoId: string, novoStatus: StatusMarco) => {
    // Atualização otimista
    setRoadmap((prev) => ({
      ...prev,
      marcos: prev.marcos.map((m) =>
        m.id === marcoId
          ? {
              ...m,
              status: novoStatus,
              porcentagem: novoStatus === "CONCLUIDO" ? 100 : novoStatus === "NAO_INICIADO" ? 0 : 50,
              prazoRealizado: novoStatus === "CONCLUIDO" ? new Date().toISOString().split("T")[0] : null,
            }
          : m
      ),
    }));

    startTransition(async () => {
      const res = await atualizarStatusRapidoMarco(marcoId, novoStatus, roadmap.alunoId);
      if (!res.ok) {
        setErro(res.erro || "Erro ao atualizar status");
        router.refresh();
      } else {
        router.refresh();
      }
    });
  };

  const handleToggleSubtarefa = (marcoId: string, tarefaId: string, statusAtual: "ABERTA" | "CONCLUIDA") => {
    const novoStatus: "ABERTA" | "CONCLUIDA" = statusAtual === "CONCLUIDA" ? "ABERTA" : "CONCLUIDA";

    // Atualização otimista
    setRoadmap((prev) => ({
      ...prev,
      marcos: prev.marcos.map((m) => {
        if (m.id !== marcoId) return m;
        const novasTarefas: TarefaVinculadaMarco[] = m.tarefas.map((t) =>
          t.id === tarefaId ? { ...t, status: novoStatus } : t
        );
        const concluidas = novasTarefas.filter((t) => t.status === "CONCLUIDA").length;
        const porcentagem =
          novasTarefas.length > 0 ? Math.round((concluidas / novasTarefas.length) * 100) : m.porcentagem;
        const statusCalculado: StatusMarco =
          porcentagem === 100 ? "CONCLUIDO" : porcentagem > 0 ? "EM_ANDAMENTO" : m.status;

        return {
          ...m,
          tarefas: novasTarefas,
          porcentagem,
          status: statusCalculado,
        };
      }),
    }));

    startTransition(async () => {
      const res = await alternarStatusTarefaMarco(tarefaId, novoStatus, roadmap.alunoId);
      if (!res.ok) {
        setErro(res.erro || "Erro ao atualizar status da subtarefa");
        router.refresh();
      }
    });
  };

  const handleAplicarTemplate = (nivel: "TCC" | "MESTRADO" | "DOUTORADO") => {
    if (
      roadmap.marcos.length > 0 &&
      !confirm(
        "Isso substituirá a estrutura atual pelas atividades recomendadas para este nível acadêmico. Deseja continuar?"
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await aplicarTemplateRoadmap(roadmap.alunoId, nivel);
      if (res.ok) {
        setSucesso(`Estrutura de atividades para ${nivel} aplicada com sucesso!`);
        setModalTemplateAberto(false);
        router.refresh();
      } else {
        setErro(res.erro || "Erro ao aplicar template");
      }
    });
  };

  const handleCriarTarefaNoMarco = () => {
    if (!modalNovaTarefaMarco || !tarefaTitulo.trim()) {
      setErro("Informe o título da subtarefa.");
      return;
    }

    startTransition(async () => {
      const res = await criarTarefaReuniao({
        alunoId: roadmap.alunoId,
        reuniaoId: "",
        titulo: tarefaTitulo,
        responsavelTipo: tarefaRespTipo,
        prazo: tarefaPrazo || undefined,
        marcoId: modalNovaTarefaMarco,
      });

      if (res.ok) {
        setSucesso("Subtarefa vinculada à atividade com sucesso!");
        setModalNovaTarefaMarco(null);
        setTarefaTitulo("");
        setTarefaPrazo("");
        router.refresh();
      } else {
        setErro("Erro ao criar subtarefa vinculada");
      }
    });
  };

  const handleExportarCSV = () => {
    const headers = [
      "Ordem",
      "Atividade / Seção",
      "Estimativa Páginas",
      "Categoria",
      "Responsável",
      "Prazo Planejado",
      "Prazo Realizado",
      "Status",
      "Situação do Prazo",
      "Subtarefas Vinculadas",
    ];

    const rows = roadmap.marcos.map((m) => [
      m.ordem,
      `"${m.titulo}"`,
      `"${m.estimativaPaginas || ""}"`,
      `"${m.fase}"`,
      `"${m.responsavelTipo || "AMBOS"}"`,
      m.prazoPlanejado,
      m.prazoRealizado || "",
      m.status,
      `"${m.situacaoPrazo}"`,
      m.tarefas.length,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `quadro_atividades_${roadmap.alunoNome.replace(/\s+/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtragem de atividades para a Grade
  const atividadesFiltradas = useMemo(() => {
    return roadmap.marcos.filter((m) => {
      // Filtro de texto
      if (buscaTexto.trim()) {
        const query = buscaTexto.toLowerCase();
        const matchTitulo = m.titulo.toLowerCase().includes(query);
        const matchDesc = m.descricao?.toLowerCase().includes(query);
        const matchFase = m.fase?.toLowerCase().includes(query);
        if (!matchTitulo && !matchDesc && !matchFase) return false;
      }

      // Filtro de status
      if (filtroStatus !== "TODAS") {
        if (filtroStatus === "ATRASADO" && m.status !== "ATRASADO") return false;
        if (filtroStatus === "CONCLUIDO" && m.status !== "CONCLUIDO") return false;
        if (filtroStatus === "EM_ANDAMENTO" && m.status !== "EM_ANDAMENTO") return false;
        if (filtroStatus === "NAO_INICIADO" && m.status !== "NAO_INICIADO") return false;
      }

      // Filtro de responsável
      if (filtroResponsavel !== "TODOS") {
        const resp = m.responsavelTipo || "AMBOS";
        if (resp !== filtroResponsavel && resp !== "AMBOS") return false;
      }

      return true;
    });
  }, [roadmap.marcos, buscaTexto, filtroStatus, filtroResponsavel]);

  // Colunas do Kanban
  const colunasKanban = useMemo(() => {
    return {
      naoIniciadas: roadmap.marcos.filter((m) => m.status === "NAO_INICIADO"),
      emAndamento: roadmap.marcos.filter((m) => m.status === "EM_ANDAMENTO" || m.status === "ATRASADO"),
      concluidas: roadmap.marcos.filter((m) => m.status === "CONCLUIDO"),
    };
  }, [roadmap.marcos]);

  const renderBadgeSituacao = (marco: MarcoRoadmapItem) => {
    switch (marco.situacaoPrazo) {
      case "CONCLUIDO_ADIANTADO":
        return (
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            ✓ Concluído adiantado ({marco.diasDiferenca} dias antes)
          </span>
        );
      case "CONCLUIDO_NO_PRAZO":
        return (
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            ✓ Concluído no prazo
          </span>
        );
      case "CONCLUIDO_COM_ATRASO":
        return (
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            Concluído com atraso ({Math.abs(marco.diasDiferenca || 0)} dias)
          </span>
        );
      case "ATRASADO":
        return (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
            Atrasado ({Math.abs(marco.diasDiferenca || 0)} dias)
          </span>
        );
      case "ATENCAO":
        return (
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            Atenção: Prazo próximo ({marco.diasDiferenca} dias restantes)
          </span>
        );
      case "NO_PRAZO":
      default:
        return (
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
            No prazo ({marco.diasDiferenca} dias)
          </span>
        );
    }
  };

  const renderBadgeResponsavel = (tipo?: "ALUNO" | "PROFESSOR" | "AMBOS" | null) => {
    const t = tipo || "AMBOS";
    if (t === "ALUNO") {
      return (
        <span className="text-[11px] font-bold font-karla px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80">
          Aluno
        </span>
      );
    }
    if (t === "PROFESSOR") {
      return (
        <span className="text-[11px] font-bold font-karla px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80">
          Professor
        </span>
      );
    }
    return (
      <span className="text-[11px] font-bold font-karla px-2 py-0.5 rounded-md bg-[#133C1B]/10 text-[#133C1B] border border-[#133C1B]/20">
        Ambos
      </span>
    );
  };

  /**
   * Componente reutilizável para renderizar um Card de Atividade individual (não-linear)
   */
  const renderCardAtividade = (m: MarcoRoadmapItem) => (
    <div
      key={m.id}
      className="bg-white p-5 rounded-2xl border border-zinc-200/90 shadow-xs hover:border-[#133C1B]/40 hover:shadow-sm transition-all space-y-3.5 flex flex-col justify-between"
    >
      <div className="space-y-2">
        {/* Badges superiores: Categoria, Páginas, Responsável, Prazo */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {m.fase && m.fase !== "Atividade" && (
            <span className="text-xs font-bold font-karla px-2.5 py-0.5 rounded-lg bg-zinc-100 text-zinc-700 uppercase tracking-wide">
              {m.fase}
            </span>
          )}
          {renderBadgeResponsavel(m.responsavelTipo)}
          {m.estimativaPaginas && (
            <span className="text-xs font-semibold font-karla px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200/80 inline-flex items-center gap-1">
              <svg className="h-3 w-3 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {m.estimativaPaginas}
            </span>
          )}
          {renderBadgeSituacao(m)}
        </div>

        {/* Título da Atividade */}
        <h3 className="text-base font-bold font-karla text-zinc-900 leading-snug">
          {m.titulo}
        </h3>

        {/* Descrição / Conteúdo planejado */}
        {m.descricao && (
          <p className="text-xs text-zinc-600 font-spectral line-clamp-3 leading-relaxed">
            {m.descricao}
          </p>
        )}
      </div>

      <div className="space-y-3 pt-2 border-t border-zinc-100">
        {/* Prazos planejados vs realizados */}
        <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-50/70 p-2.5 rounded-xl border border-zinc-200/70 font-spectral">
          <div>
            <span className="text-zinc-500 font-medium block">Prazo Planejado:</span>
            <strong className="text-zinc-800">
              {new Date(`${m.prazoPlanejado}T12:00:00Z`).toLocaleDateString("pt-BR")}
            </strong>
          </div>
          <div>
            <span className="text-zinc-500 font-medium block">Conclusão:</span>
            <strong className="text-zinc-800">
              {m.prazoRealizado
                ? new Date(`${m.prazoRealizado}T12:00:00Z`).toLocaleDateString("pt-BR")
                : "Pendente"}
            </strong>
          </div>
        </div>

        {/* Seletor Rápido de Status */}
        <div className="flex justify-between items-center text-xs font-spectral">
          <span className="text-zinc-500">Status da Atividade</span>
          <select
            value={m.status}
            onChange={(e) => handleMudarStatusRapido(m.id, e.target.value as StatusMarco)}
            className="text-[11px] font-bold font-karla py-1 px-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-2xs focus:outline-none focus:border-[#133C1B] cursor-pointer"
            title="Alterar status da atividade"
          >
            <option value="NAO_INICIADO">Não Iniciado</option>
            <option value="EM_ANDAMENTO">Em Andamento</option>
            <option value="CONCLUIDO">Concluído</option>
          </select>
        </div>

        {/* Subtarefas / Checklist Interativo */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-karla font-bold text-zinc-500 uppercase tracking-wide">
            <span>Subtarefas ({m.tarefas.length}):</span>
            <button
              type="button"
              onClick={() => setModalNovaTarefaMarco(m.id)}
              className="text-[#133C1B] hover:text-[#1a4f24] hover:underline cursor-pointer lowercase"
            >
              + adicionar
            </button>
          </div>

          {m.tarefas.length === 0 ? (
            <p className="text-[11px] text-zinc-400 font-spectral italic">
              Nenhuma subtarefa vinculada a esta atividade.
            </p>
          ) : (
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {m.tarefas.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100/70 text-xs font-spectral border border-zinc-200/50 transition-colors"
                >
                  <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={t.status === "CONCLUIDA"}
                      onChange={() => handleToggleSubtarefa(m.id, t.id, t.status)}
                      className="rounded border-zinc-300 text-[#133C1B] focus:ring-[#133C1B]/20 h-3.5 w-3.5 cursor-pointer shrink-0"
                    />
                    <span
                      className={`truncate ${
                        t.status === "CONCLUIDA"
                          ? "line-through text-zinc-400"
                          : "text-zinc-800 font-medium"
                      }`}
                    >
                      {t.titulo}
                    </span>
                  </label>
                  <span className="text-[10px] font-bold font-karla px-1.5 py-0.2 rounded bg-white border border-zinc-200 text-zinc-500 shrink-0">
                    {t.responsavelTipo || "ALUNO"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botões de Ação do Card (Acessíveis para ALUNO e PROFESSOR) */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setModalNovaTarefaMarco(m.id)}
            className="text-xs font-bold font-karla text-[#133C1B] hover:bg-[#133C1B]/10 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
          >
            + Subtarefa
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setModalEditarMarco(m)}
              className="text-xs font-semibold font-karla text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-300 hover:bg-zinc-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => handleExcluirAtividade(m.id, m.titulo)}
              className="text-xs font-semibold font-karla text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-6">
      {/* CARD 1: PAINEL DE CONTROLE E NAVEGAÇÃO SUPERIOR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200/90 shadow-xs print:hidden space-y-4">
        {/* Linha 1: Informações do Aluno / Pesquisa & Botão Verde com Ícone para Filtrar Orientando */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#133C1B]/10 text-[#133C1B] shrink-0">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold font-karla text-zinc-900 truncate">
                  {roadmap.alunoNome}
                </h2>
                <span className="text-xs font-bold font-karla px-2.5 py-0.5 rounded-lg bg-[#133C1B]/10 text-[#133C1B] border border-[#133C1B]/20 shrink-0">
                  {roadmap.nivel}
                </span>
                {roadmap.orientadorNome && (
                  <span className="text-xs text-zinc-500 font-spectral hidden sm:inline truncate">
                    • Orientador(a): <strong className="text-zinc-700">{roadmap.orientadorNome}</strong>
                  </span>
                )}
              </div>
              {roadmap.tema && (
                <p className="text-xs text-zinc-500 font-spectral line-clamp-1 mt-0.5">
                  Tema: {roadmap.tema}
                </p>
              )}
            </div>
          </div>

          {!isAluno && roadmap.orientandos && roadmap.orientandos.length > 0 && (
            <button
              type="button"
              onClick={() => setModalAlunosAberto(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#133C1B] hover:bg-[#1a4f24] active:scale-95 text-white shadow-2xs transition-all cursor-pointer shrink-0"
              title="Filtrar orientando"
              aria-label="Filtrar orientando"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </button>
          )}
        </div>

        {/* Linha 2: Alternador de Visualizações e Ferramentas Auxiliares */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Alternador de Visualização em Pílulas */}
          <div className="flex items-center gap-1 bg-zinc-100/90 p-1 rounded-xl self-start">
            <button
              type="button"
              onClick={() => setVisualizacao("QUADRO")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold font-karla rounded-lg transition-all cursor-pointer ${
                visualizacao === "QUADRO"
                  ? "bg-white text-[#133C1B] shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.5-15h15a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75A2.25 2.25 0 014.5 4.5z" />
              </svg>
              <span>Quadro (Colunas)</span>
            </button>
            <button
              type="button"
              onClick={() => setVisualizacao("GRADE")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold font-karla rounded-lg transition-all cursor-pointer ${
                visualizacao === "GRADE"
                  ? "bg-white text-[#133C1B] shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              <span>Grade de Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setVisualizacao("GANTT")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold font-karla rounded-lg transition-all cursor-pointer ${
                visualizacao === "GANTT"
                  ? "bg-white text-[#133C1B] shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <span>Cronograma</span>
            </button>
          </div>

          {/* Ações Secundárias Agrupadas */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setModalTemplateAberto(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold font-karla text-[#133C1B] bg-[#133C1B]/10 border border-[#133C1B]/20 rounded-xl hover:bg-[#133C1B]/20 transition-colors shadow-2xs cursor-pointer"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Aplicar Template</span>
            </button>

            <button
              type="button"
              onClick={handleExportarCSV}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold font-karla text-zinc-700 bg-white border border-zinc-300 rounded-xl hover:bg-zinc-50 transition-colors shadow-2xs cursor-pointer"
            >
              <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold font-karla text-zinc-700 bg-white border border-zinc-300 rounded-xl hover:bg-zinc-50 transition-colors shadow-2xs cursor-pointer"
            >
              <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.018-.62-2.023-.62-3.079 0-3.314 2.686-6 6-6s6 2.686 6 6c0 1.056-.38 2.061-.62 3.079M9 16.5h6m-9 3.75h12a1.5 1.5 0 001.5-1.5V15a1.5 1.5 0 00-1.5-1.5H4.5A1.5 1.5 0 003 15v3.75a1.5 1.5 0 001.5 1.5z" />
              </svg>
              <span>Imprimir</span>
            </button>
          </div>
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

      {/* CARD 2: PROGRESSO GLOBAL E MÉTRICAS */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-zinc-200/90 shadow-xs space-y-4">
        <div>
          <span className="text-xs font-bold font-karla uppercase tracking-wider text-[#133C1B]">
            Progresso Geral das Atividades da Pesquisa
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-karla text-zinc-900">
            {roadmap.estatisticas.etapaAtualNome || "Em andamento"}
          </h2>
        </div>

        {/* Estatísticas resumidas em grid harmônico de 5 colunas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-zinc-100 text-center">
          <div className="p-3 bg-zinc-50/80 border border-zinc-200/80 rounded-xl shadow-2xs flex flex-col justify-center">
            <div className="text-xl font-bold font-karla text-zinc-900">
              {roadmap.estatisticas.totalMarcos}
            </div>
            <div className="text-xs text-zinc-500 font-spectral mt-0.5">Total de Atividades</div>
          </div>
          <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl shadow-2xs flex flex-col justify-center">
            <div className="text-xl font-bold font-karla text-emerald-800">
              {roadmap.estatisticas.concluidos}
            </div>
            <div className="text-xs text-emerald-700 font-spectral mt-0.5">Concluídas</div>
          </div>
          <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl shadow-2xs flex flex-col justify-center">
            <div className="text-xl font-bold font-karla text-blue-800">
              {roadmap.estatisticas.emAndamento}
            </div>
            <div className="text-xs text-blue-700 font-spectral mt-0.5">Em Andamento</div>
          </div>
          <div className="p-3 bg-red-50/80 border border-red-200/80 rounded-xl shadow-2xs flex flex-col justify-center">
            <div className="text-xl font-bold font-karla text-red-800">
              {roadmap.estatisticas.atrasados}
            </div>
            <div className="text-xs text-red-700 font-spectral mt-0.5">Atrasadas</div>
          </div>
          <div className="p-3 bg-teal-50/80 border border-teal-200/80 rounded-xl shadow-2xs col-span-2 sm:col-span-1 flex flex-col justify-center">
            <div className="text-sm sm:text-base font-bold font-karla text-teal-900 truncate">
              {roadmap.estatisticas.totalPaginasEstimadas || "A calcular"}
            </div>
            <div className="text-xs text-teal-700 font-spectral mt-0.5">Estimativa Total</div>
          </div>
        </div>
      </div>

      {/* VISÃO 1: QUADRO KANBAN POR STATUS */}
      {visualizacao === "QUADRO" && (
        <div className="space-y-4">
          {roadmap.marcos.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-zinc-200/90 p-8 space-y-3 shadow-xs font-spectral">
              <p className="text-zinc-600 text-sm">
                Nenhuma atividade foi configurada para este aluno ainda.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNovoMarcoAberto(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#133C1B] hover:bg-[#133C1B]/90 text-white rounded-xl text-sm font-bold font-karla shadow-xs cursor-pointer transition-colors"
                >
                  + Nova Atividade
                </button>
                <button
                  type="button"
                  onClick={() => setModalTemplateAberto(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#133C1B]/10 hover:bg-[#133C1B]/20 text-[#133C1B] rounded-xl text-sm font-bold font-karla shadow-xs cursor-pointer transition-colors"
                >
                  Aplicar Template ({roadmap.nivel})
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Coluna 1: Não Iniciadas */}
              <div className="bg-zinc-100/70 p-4 rounded-2xl border border-zinc-200/80 space-y-3.5 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
                    <h3 className="text-sm font-bold font-karla text-zinc-800 uppercase tracking-wide">
                      Não Iniciadas
                    </h3>
                  </div>
                  <span className="text-xs font-bold font-karla px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700">
                    {colunasKanban.naoIniciadas.length}
                  </span>
                </div>

                <div className="space-y-3.5 flex-1">
                  {colunasKanban.naoIniciadas.length === 0 ? (
                    <div className="text-center py-8 text-xs text-zinc-400 font-spectral italic border border-dashed border-zinc-300 rounded-xl">
                      Nenhuma atividade nesta etapa
                    </div>
                  ) : (
                    colunasKanban.naoIniciadas.map(renderCardAtividade)
                  )}
                </div>
              </div>

              {/* Coluna 2: Em Andamento / Atrasadas */}
              <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-200/80 space-y-3.5 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-blue-200/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                    <h3 className="text-sm font-bold font-karla text-blue-900 uppercase tracking-wide">
                      Em Andamento
                    </h3>
                  </div>
                  <span className="text-xs font-bold font-karla px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {colunasKanban.emAndamento.length}
                  </span>
                </div>

                <div className="space-y-3.5 flex-1">
                  {colunasKanban.emAndamento.length === 0 ? (
                    <div className="text-center py-8 text-xs text-blue-400 font-spectral italic border border-dashed border-blue-200 rounded-xl">
                      Nenhuma atividade em andamento
                    </div>
                  ) : (
                    colunasKanban.emAndamento.map(renderCardAtividade)
                  )}
                </div>
              </div>

              {/* Coluna 3: Concluídas */}
              <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-200/80 space-y-3.5 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <h3 className="text-sm font-bold font-karla text-emerald-900 uppercase tracking-wide">
                      Concluídas
                    </h3>
                  </div>
                  <span className="text-xs font-bold font-karla px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {colunasKanban.concluidas.length}
                  </span>
                </div>

                <div className="space-y-3.5 flex-1">
                  {colunasKanban.concluidas.length === 0 ? (
                    <div className="text-center py-8 text-xs text-emerald-500 font-spectral italic border border-dashed border-emerald-200 rounded-xl">
                      Nenhuma atividade concluída ainda
                    </div>
                  ) : (
                    colunasKanban.concluidas.map(renderCardAtividade)
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VISÃO 2: GRADE DE CARDS (GRID NÃO-LINEAR COM FILTROS) */}
      {visualizacao === "GRADE" && (
        <div className="space-y-4">
          {/* Barra de Filtros e Busca */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-zinc-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold font-karla text-zinc-500 uppercase mr-1">
                Status:
              </span>
              {[
                { key: "TODAS", label: `Todas (${roadmap.marcos.length})` },
                { key: "NAO_INICIADO", label: `Não Iniciadas (${colunasKanban.naoIniciadas.length})` },
                { key: "EM_ANDAMENTO", label: `Em Andamento (${colunasKanban.emAndamento.length})` },
                { key: "CONCLUIDO", label: `Concluídas (${colunasKanban.concluidas.length})` },
                { key: "ATRASADO", label: `Atrasadas (${roadmap.estatisticas.atrasados})` },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFiltroStatus(f.key)}
                  className={`text-xs font-bold font-karla px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    filtroStatus === f.key
                      ? "bg-[#133C1B] text-white shadow-2xs"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filtroResponsavel}
                onChange={(e) => setFiltroResponsavel(e.target.value)}
                className="text-xs font-spectral border border-zinc-300 rounded-xl px-2.5 py-1.5 bg-white text-zinc-700 shadow-2xs focus:outline-none focus:border-[#133C1B]"
              >
                <option value="TODOS">Todos os responsáveis</option>
                <option value="ALUNO">Responsável: Aluno</option>
                <option value="PROFESSOR">Responsável: Professor</option>
                <option value="AMBOS">Responsável: Ambos</option>
              </select>

              <input
                type="text"
                placeholder="Buscar atividade..."
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                className="text-xs font-spectral border border-zinc-300 rounded-xl px-3 py-1.5 bg-white text-zinc-800 shadow-2xs focus:outline-none focus:border-[#133C1B] w-44"
              />
            </div>
          </div>

          {atividadesFiltradas.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-zinc-200/90 p-8 space-y-2 shadow-xs font-spectral">
              <p className="text-zinc-600 text-sm">
                Nenhuma atividade encontrada com os filtros selecionados.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFiltroStatus("TODAS");
                  setFiltroResponsavel("TODOS");
                  setBuscaTexto("");
                }}
                className="text-xs font-bold font-karla text-[#133C1B] hover:underline cursor-pointer"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {atividadesFiltradas.map(renderCardAtividade)}
            </div>
          )}
        </div>
      )}

      {/* VISÃO 3: CRONOGRAMA GANTT / TABELA */}
      {visualizacao === "GANTT" && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-zinc-200/90 shadow-xs space-y-4 overflow-x-auto font-spectral">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <h3 className="text-base font-bold font-karla text-zinc-900">
              Cronograma de Execução das Atividades
            </h3>
            <span className="text-xs text-zinc-500 font-spectral">
              Prazos planejados vs. Realizados
            </span>
          </div>

          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 uppercase tracking-wider text-[11px] font-karla font-bold">
                <th className="py-2.5 pr-4">Atividade / Seção</th>
                <th className="py-2.5 px-3">Est. Páginas</th>
                <th className="py-2.5 px-3">Categoria</th>
                <th className="py-2.5 px-3">Responsável</th>
                <th className="py-2.5 px-3">Planejado</th>
                <th className="py-2.5 px-3">Realizado</th>
                <th className="py-2.5 pl-4">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {roadmap.marcos.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="py-3 pr-4 font-bold font-karla text-zinc-900">
                    {m.titulo}
                  </td>
                  <td className="py-3 px-3 text-zinc-600 font-karla font-semibold text-xs">
                    {m.estimativaPaginas || "—"}
                  </td>
                  <td className="py-3 px-3 text-zinc-600">{m.fase}</td>
                  <td className="py-3 px-3">
                    {renderBadgeResponsavel(m.responsavelTipo)}
                  </td>
                  <td className="py-3 px-3 text-zinc-700">
                    {new Date(`${m.prazoPlanejado}T12:00:00Z`).toLocaleDateString(
                      "pt-BR"
                    )}
                  </td>
                  <td className="py-3 px-3 text-zinc-700">
                    {m.prazoRealizado
                      ? new Date(`${m.prazoRealizado}T12:00:00Z`).toLocaleDateString(
                          "pt-BR"
                        )
                      : "—"}
                  </td>
                  <td className="py-3 pl-4">{renderBadgeSituacao(m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL NOVA ATIVIDADE */}
      {modalNovoMarcoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-4 text-left font-spectral">
            <h3 className="text-lg font-bold font-karla text-zinc-900">
              Adicionar Nova Atividade
            </h3>
            <p className="text-xs text-zinc-500 font-spectral">
              Crie uma atividade para a pesquisa com prazo e responsável definidos.
            </p>

            <div>
              <label
                htmlFor="modal-titulo-atividade"
                className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
              >
                Título da Atividade:
              </label>
              <input
                id="modal-titulo-atividade"
                type="text"
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
                placeholder="Ex: Coletar dados e redigir metodologia"
                className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="modal-resp-atividade"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Responsável:
                </label>
                <select
                  id="modal-resp-atividade"
                  value={novoResponsavel}
                  onChange={(e) => setNovoResponsavel(e.target.value as "ALUNO" | "PROFESSOR" | "AMBOS")}
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none bg-white shadow-xs"
                >
                  <option value="AMBOS">Ambos (Compartilhado)</option>
                  <option value="ALUNO">Aluno</option>
                  <option value="PROFESSOR">Professor</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="modal-prazo-atividade"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Prazo Planejado:
                </label>
                <input
                  id="modal-prazo-atividade"
                  type="date"
                  value={novoPrazo}
                  onChange={(e) => setNovoPrazo(e.target.value)}
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="modal-paginas-atividade"
                className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
              >
                Estimativa de Páginas <span className="text-zinc-400 font-normal lowercase">(opcional)</span>:
              </label>
              <input
                id="modal-paginas-atividade"
                type="text"
                value={novaEstimativaPaginas}
                onChange={(e) => setNovaEstimativaPaginas(e.target.value)}
                placeholder="Ex: 10-15 páginas"
                className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
              />
            </div>

            <div>
              <label
                htmlFor="modal-desc-atividade"
                className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
              >
                Conteúdo Planejado para esta Atividade:
              </label>
              <textarea
                id="modal-desc-atividade"
                rows={3}
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Principais tópicos, experimentos, autores a citar ou etapas detalhadas..."
                className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setModalNovoMarcoAberto(false)}
                className="px-4 py-2 text-sm font-semibold font-karla text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCriarAtividade}
                disabled={isPending}
                className="px-4 py-2 text-sm font-bold font-karla text-white bg-[#133C1B] hover:bg-[#133C1B]/90 rounded-xl disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                Salvar Atividade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR ATIVIDADE */}
      {modalEditarMarco && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-4 text-left font-spectral">
            <h3 className="text-lg font-bold font-karla text-zinc-900">Editar Atividade</h3>

            <div>
              <label
                htmlFor="modal-edit-titulo"
                className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
              >
                Título da Atividade:
              </label>
              <input
                id="modal-edit-titulo"
                type="text"
                value={modalEditarMarco.titulo}
                onChange={(e) =>
                  setModalEditarMarco({
                    ...modalEditarMarco,
                    titulo: e.target.value,
                  })
                }
                className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="modal-edit-paginas"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Est. Páginas:
                </label>
                <input
                  id="modal-edit-paginas"
                  type="text"
                  value={modalEditarMarco.estimativaPaginas || ""}
                  onChange={(e) =>
                    setModalEditarMarco({
                      ...modalEditarMarco,
                      estimativaPaginas: e.target.value,
                    })
                  }
                  placeholder="Ex: 15-20 páginas"
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="modal-edit-fase"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Categoria / Fase:
                </label>
                <input
                  id="modal-edit-fase"
                  type="text"
                  value={modalEditarMarco.fase}
                  onChange={(e) =>
                    setModalEditarMarco({
                      ...modalEditarMarco,
                      fase: e.target.value,
                    })
                  }
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="modal-edit-resp"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Responsável:
                </label>
                <select
                  id="modal-edit-resp"
                  value={modalEditarMarco.responsavelTipo || "AMBOS"}
                  onChange={(e) =>
                    setModalEditarMarco({
                      ...modalEditarMarco,
                      responsavelTipo: e.target.value as "ALUNO" | "PROFESSOR" | "AMBOS",
                    })
                  }
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none bg-white shadow-xs"
                >
                  <option value="AMBOS">Ambos (Compartilhado)</option>
                  <option value="ALUNO">Aluno</option>
                  <option value="PROFESSOR">Professor</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="modal-edit-prazo-plan"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Prazo Planejado:
                </label>
                <input
                  id="modal-edit-prazo-plan"
                  type="date"
                  value={modalEditarMarco.prazoPlanejado}
                  onChange={(e) =>
                    setModalEditarMarco({
                      ...modalEditarMarco,
                      prazoPlanejado: e.target.value,
                    })
                  }
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="modal-edit-desc"
                className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
              >
                Conteúdo / Descrição Planejada:
              </label>
              <textarea
                id="modal-edit-desc"
                rows={2}
                value={modalEditarMarco.descricao || ""}
                onChange={(e) =>
                  setModalEditarMarco({
                    ...modalEditarMarco,
                    descricao: e.target.value,
                  })
                }
                className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="modal-edit-prazo-real"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Conclusão Realizada:
                </label>
                <input
                  id="modal-edit-prazo-real"
                  type="date"
                  value={modalEditarMarco.prazoRealizado || ""}
                  onChange={(e) =>
                    setModalEditarMarco({
                      ...modalEditarMarco,
                      prazoRealizado: e.target.value || null,
                    })
                  }
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="modal-edit-status"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Status da Atividade:
                </label>
                <select
                  id="modal-edit-status"
                  value={modalEditarMarco.status}
                  onChange={(e) =>
                    setModalEditarMarco({
                      ...modalEditarMarco,
                      status: e.target.value as StatusMarco,
                    })
                  }
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none bg-white shadow-xs"
                >
                  <option value="NAO_INICIADO">Não Iniciado</option>
                  <option value="EM_ANDAMENTO">Em Andamento</option>
                  <option value="CONCLUIDO">Concluído</option>
                  <option value="ATRASADO">Atrasado</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setModalEditarMarco(null)}
                className="px-4 py-2 text-sm font-semibold font-karla text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarEdicaoAtividade}
                disabled={isPending}
                className="px-4 py-2 text-sm font-bold font-karla text-white bg-[#133C1B] hover:bg-[#133C1B]/90 rounded-xl disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TEMPLATE */}
      {modalTemplateAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-4 text-left font-spectral">
            <h3 className="text-lg font-bold font-karla text-zinc-900">
              Aplicar Estrutura de Atividades
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 font-spectral">
              Escolha a estrutura recomendada de atividades de acordo com o nível acadêmico do aluno:
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleAplicarTemplate("TCC")}
                disabled={isPending}
                className="w-full text-left p-4 border border-zinc-200/90 rounded-2xl hover:border-[#133C1B] hover:bg-[#133C1B]/5 transition-all shadow-2xs cursor-pointer"
              >
                <div className="font-bold text-sm font-karla text-zinc-900">
                  Graduação / TCC (Monografia)
                </div>
                <div className="text-xs text-zinc-500 font-spectral mt-1">
                  5 atividades estruturadas: Introdução &amp; Justificativa (4-6 págs), Revisão Bibliográfica (15-20 págs), Metodologia (6-10 págs), Desenvolvimento &amp; Resultados (18-25 págs), Considerações Finais (4-6 págs).
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAplicarTemplate("MESTRADO")}
                disabled={isPending}
                className="w-full text-left p-4 border border-zinc-200/90 rounded-2xl hover:border-[#133C1B] hover:bg-[#133C1B]/5 transition-all shadow-2xs cursor-pointer"
              >
                <div className="font-bold text-sm font-karla text-zinc-900">
                  Mestrado Acadêmico (Dissertação)
                </div>
                <div className="text-xs text-zinc-500 font-spectral mt-1">
                  6 atividades aprofundadas: Introdução &amp; Hipóteses (10-15 págs), RSL (25-35 págs), Metodologia (12-18 págs), Desenvolvimento (30-45 págs), Validação &amp; Análise (25-35 págs), Conclusões &amp; Produção Científica (6-10 págs).
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAplicarTemplate("DOUTORADO")}
                disabled={isPending}
                className="w-full text-left p-4 border border-zinc-200/90 rounded-2xl hover:border-[#133C1B] hover:bg-[#133C1B]/5 transition-all shadow-2xs cursor-pointer"
              >
                <div className="font-bold text-sm font-karla text-zinc-900">
                  Doutorado (Tese)
                </div>
                <div className="text-xs text-zinc-500 font-spectral mt-1">
                  7 atividades de fronteira: Introdução &amp; Tese (15-20 págs), Arcabouço Teórico (40-60 págs), Desenho Metodológico (20-30 págs), Contribuição I / Artigo 1 (30-45 págs), Contribuição II / Experimentos (35-50 págs), Discussão Crítica (20-30 págs), Conclusões (8-12 págs).
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setModalTemplateAberto(false)}
                className="px-4 py-2 text-sm font-semibold font-karla text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VINCULAR NOVA SUBTAREFA À ATIVIDADE */}
      {modalNovaTarefaMarco && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-4 text-left font-spectral">
            <h3 className="text-lg font-bold font-karla text-zinc-900">
              Vincular Subtarefa à Atividade
            </h3>

            <div>
              <label
                htmlFor="modal-tarefa-titulo"
                className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
              >
                Título da Subtarefa:
              </label>
              <input
                id="modal-tarefa-titulo"
                type="text"
                value={tarefaTitulo}
                onChange={(e) => setTarefaTitulo(e.target.value)}
                placeholder="Ex: Redigir subseção 2.1 e fichar 5 artigos"
                className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="modal-tarefa-resp"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Responsável:
                </label>
                <select
                  id="modal-tarefa-resp"
                  value={tarefaRespTipo}
                  onChange={(e) =>
                    setTarefaRespTipo(
                      e.target.value as "ALUNO" | "PROFESSOR" | "AMBOS"
                    )
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
                  htmlFor="modal-tarefa-prazo"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Prazo:
                </label>
                <input
                  id="modal-tarefa-prazo"
                  type="date"
                  value={tarefaPrazo}
                  onChange={(e) => setTarefaPrazo(e.target.value)}
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setModalNovaTarefaMarco(null)}
                className="px-4 py-2 text-sm font-semibold font-karla text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCriarTarefaNoMarco}
                disabled={isPending}
                className="px-4 py-2 text-sm font-bold font-karla text-white bg-[#133C1B] hover:bg-[#133C1B]/90 rounded-xl disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                Salvar Subtarefa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LISTA DE ORIENTANDOS */}
      {modalAlunosAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-4 text-left font-spectral max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 shrink-0">
              <div>
                <h3 className="text-lg font-bold font-karla text-zinc-900">
                  Selecionar Orientando
                </h3>
                <p className="text-xs text-zinc-500 font-spectral">
                  Escolha um aluno para gerenciar as atividades da pesquisa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalAlunosAberto(false);
                  setBuscaAluno("");
                }}
                className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                aria-label="Fechar modal"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Campo de busca do aluno */}
            <div className="relative shrink-0">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={buscaAluno}
                onChange={(e) => setBuscaAluno(e.target.value)}
                placeholder="Buscar orientando por nome ou nível..."
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-zinc-200 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-2xs"
                autoFocus
              />
            </div>

            {/* Lista de alunos */}
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {orientandosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-sm font-spectral">
                  Nenhum aluno encontrado para &quot;{buscaAluno}&quot;.
                </div>
              ) : (
                orientandosFiltrados.map((o) => {
                  const isSelecionado = (alunoSelecionadoId || roadmap.alunoId) === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setModalAlunosAberto(false);
                        setBuscaAluno("");
                        router.push(`/roadmap?alunoId=${o.id}`);
                      }}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelecionado
                          ? "bg-[#133C1B]/10 border-[#133C1B] shadow-2xs"
                          : "bg-white border-zinc-200 hover:border-[#133C1B]/40 hover:bg-zinc-50/70"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold font-karla text-sm shrink-0 ${
                            isSelecionado
                              ? "bg-[#133C1B] text-white"
                              : "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {o.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm font-karla text-zinc-900 truncate">
                            {o.nome}
                          </p>
                          <p className="text-xs text-zinc-500 font-spectral">
                            {o.nivel}
                          </p>
                        </div>
                      </div>

                      {isSelecionado && (
                        <span className="text-xs font-bold font-karla px-2.5 py-1 rounded-lg bg-[#133C1B] text-white shrink-0 flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Ativo
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setModalAlunosAberto(false);
                  setBuscaAluno("");
                }}
                className="px-4 py-2 text-sm font-semibold font-karla text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTÃO FLUTUANTE FIXO NO CANTO INFERIOR DIREITO: ADICIONAR ATIVIDADE */}
      <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 print:hidden">
        <button
          type="button"
          onClick={() => setModalNovoMarcoAberto(true)}
          className="flex items-center gap-2.5 px-5 py-3.5 bg-[#133C1B] hover:bg-[#1a4f24] active:scale-95 text-white font-bold font-karla text-sm sm:text-base rounded-full shadow-2xl ring-4 ring-white/90 border border-white/20 transition-all duration-200 cursor-pointer group"
          aria-label="Adicionar Nova Atividade"
          title="Adicionar nova atividade ao quadro"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform duration-200 group-hover:rotate-90">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <span className="tracking-wide">Adicionar Atividade</span>
        </button>
      </div>
    </div>
  );
}

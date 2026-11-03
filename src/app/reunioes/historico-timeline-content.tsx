"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  HistoricoReunioesResponse,
  ItemHistoricoReuniao,
} from "@/lib/actions/historico-reunioes";
import {
  salvarAtaReuniao,
  atualizarStatusReuniao,
} from "@/lib/actions/historico-reunioes";

interface HistoricoTimelineContentProps {
  historicoInicial: HistoricoReunioesResponse;
  alunoSelecionadoId?: string;
}

export function HistoricoTimelineContent({
  historicoInicial,
  alunoSelecionadoId,
}: HistoricoTimelineContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");

  // Modal Ata / Decisões
  const [modalAtaReuniao, setModalAtaReuniao] = useState<ItemHistoricoReuniao | null>(
    null
  );
  const [pautaForm, setPautaForm] = useState("");
  const [decisoesForm, setDecisoesForm] = useState("");
  const [combinadosForm, setCombinadosForm] = useState("");
  const [duvidasForm, setDuvidasForm] = useState("");
  const [proximosPassosForm, setProximosPassosForm] = useState("");

  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const isAluno = historicoInicial.isAluno;
  const orientandos = historicoInicial.orientandos || [];

  const handleMudarAluno = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    router.push(`/reunioes?aba=historico&alunoId=${id}`);
  };

  const abrirModalAta = (r: ItemHistoricoReuniao) => {
    setModalAtaReuniao(r);
    setPautaForm(r.pauta || "");
    setDecisoesForm(r.decisoes || "");
    setCombinadosForm(r.combinados || "");
    setDuvidasForm(r.duvidasAbertas || "");
    setProximosPassosForm(r.proximosPassos || "");
  };

  const handleSalvarAta = () => {
    if (!modalAtaReuniao) return;

    startTransition(async () => {
      const res = await salvarAtaReuniao(modalAtaReuniao.id, {
        pauta: pautaForm,
        decisoes: decisoesForm,
        combinados: combinadosForm,
        duvidasAbertas: duvidasForm,
        proximosPassos: proximosPassosForm,
      });

      if (res.ok) {
        setSucesso("Ata e decisões da reunião salvas com sucesso!");
        setModalAtaReuniao(null);
        router.refresh();
      } else {
        setErro("Erro ao salvar ata da reunião");
      }
    });
  };

  const handleAlterarStatus = (
    reuniaoId: string,
    novoStatus: "AGENDADA" | "REALIZADA" | "CANCELADA" | "FALTA"
  ) => {
    startTransition(async () => {
      const res = await atualizarStatusReuniao(reuniaoId, novoStatus);
      if (res.ok) {
        setSucesso(`Status atualizado para ${novoStatus}!`);
        router.refresh();
      } else {
        setErro("Erro ao atualizar status");
      }
    });
  };

  const handleExportarCSV = () => {
    const headers = [
      "Data",
      "Horário",
      "Status",
      "Orientando",
      "Orientador",
      "Pauta",
      "Decisões",
      "Combinados",
      "Tarefas Geradas",
      "Meet Link",
    ];

    const rows = historicoInicial.reunioes.map((r) => [
      `"${r.dataStr}"`,
      `"${r.horarioStr}"`,
      r.status,
      `"${r.alunoNome}"`,
      `"${r.orientadorNome}"`,
      `"${(r.pauta || "").replace(/"/g, '""')}"`,
      `"${(r.decisoes || "").replace(/"/g, '""')}"`,
      `"${(r.combinados || "").replace(/"/g, '""')}"`,
      `"${r.tarefasGeradas.map((t) => t.titulo).join("; ")}"`,
      `"${r.meetLink || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `historico_reunioes_${historicoInicial.alunoNome.replace(/\s+/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtragem
  const reunioesFiltradas = historicoInicial.reunioes.filter((r) => {
    if (filtroStatus !== "TODOS" && r.status !== filtroStatus) {
      return false;
    }

    if (!busca.trim()) return true;

    const termo = busca.toLowerCase();
    const emPauta = (r.pauta || "").toLowerCase().includes(termo);
    const emDecisoes = (r.decisoes || "").toLowerCase().includes(termo);
    const emCombinados = (r.combinados || "").toLowerCase().includes(termo);
    const emDuvidas = (r.duvidasAbertas || "").toLowerCase().includes(termo);
    const emPassos = (r.proximosPassos || "").toLowerCase().includes(termo);
    const emTarefas = r.tarefasGeradas.some((t) =>
      t.titulo.toLowerCase().includes(termo)
    );

    return emPauta || emDecisoes || emCombinados || emDuvidas || emPassos || emTarefas;
  });

  const renderBadgeStatus = (status: ItemHistoricoReuniao["status"]) => {
    switch (status) {
      case "REALIZADA":
        return (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            ✓ Realizada
          </span>
        );
      case "AGENDADA":
        return (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            Agendada
          </span>
        );
      case "CANCELADA":
        return (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-zinc-200 text-zinc-700">
            Cancelada
          </span>
        );
      case "FALTA":
        return (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
            Falta
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200/90 shadow-xs print:hidden">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {!isAluno && orientandos.length > 0 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="select-aluno-hist"
                className="text-xs font-bold font-karla text-zinc-500 uppercase tracking-wider"
              >
                Orientando:
              </label>
              <select
                id="select-aluno-hist"
                value={alunoSelecionadoId || historicoInicial.alunoId}
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

          <div className="relative flex-1 min-w-[200px] max-w-md">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar em pautas, atas, decisões ou tarefas..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm font-spectral border border-zinc-300 rounded-xl focus:outline-none focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 shadow-xs"
            />
            <svg
              className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold font-karla text-zinc-500 uppercase">
              Status:
            </span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="text-xs sm:text-sm font-spectral border border-zinc-300 rounded-xl px-2.5 py-1.5 bg-white text-zinc-800 shadow-xs focus:outline-none focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20"
            >
              <option value="TODOS">Todos os status</option>
              <option value="REALIZADA">Realizadas</option>
              <option value="AGENDADA">Agendadas</option>
              <option value="CANCELADA">Canceladas</option>
              <option value="FALTA">Faltas</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportarCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold font-karla text-zinc-700 bg-white border border-zinc-300 rounded-xl hover:bg-zinc-50 transition-colors shadow-xs cursor-pointer"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold font-karla text-zinc-700 bg-white border border-zinc-300 rounded-xl hover:bg-zinc-50 transition-colors shadow-xs cursor-pointer"
          >
            Imprimir / PDF
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

      {/* Estatísticas do Histórico */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 bg-zinc-50/70 border border-zinc-200/80 rounded-xl text-center shadow-2xs">
          <div className="text-xl font-bold font-karla text-zinc-900">
            {historicoInicial.estatisticas.total}
          </div>
          <div className="text-xs text-zinc-500 font-spectral">Total Encontros</div>
        </div>
        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-center shadow-2xs">
          <div className="text-xl font-bold font-karla text-emerald-800">
            {historicoInicial.estatisticas.realizadas}
          </div>
          <div className="text-xs text-emerald-700 font-spectral">Realizadas</div>
        </div>
        <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-center shadow-2xs">
          <div className="text-xl font-bold font-karla text-blue-800">
            {historicoInicial.estatisticas.agendadas}
          </div>
          <div className="text-xs text-blue-700 font-spectral">Agendadas</div>
        </div>
        <div className="p-3.5 bg-zinc-100/70 border border-zinc-200 rounded-xl text-center shadow-2xs">
          <div className="text-xl font-bold font-karla text-zinc-700">
            {historicoInicial.estatisticas.canceladas}
          </div>
          <div className="text-xs text-zinc-500 font-spectral">Canceladas</div>
        </div>
        <div className="p-3.5 bg-red-50/70 border border-red-200/80 rounded-xl text-center shadow-2xs">
          <div className="text-xl font-bold font-karla text-red-800">
            {historicoInicial.estatisticas.faltas}
          </div>
          <div className="text-xs text-red-700 font-spectral">Faltas</div>
        </div>
      </div>

      {/* TIMELINE DE ENCONTROS */}
      <div className="space-y-6">
        {reunioesFiltradas.length === 0 ? (
          <div className="p-12 text-center bg-white border border-zinc-200/90 rounded-2xl text-zinc-500 text-sm font-spectral shadow-xs">
            Nenhuma reunião encontrada com os filtros aplicados.
          </div>
        ) : (
          reunioesFiltradas.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-5 sm:p-6 space-y-4 hover:border-[#133C1B]/30 transition-all font-spectral"
            >
              {/* Cabeçalho do Encontro */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 font-bold font-karla text-base text-zinc-900">
                    <svg
                      className="w-5 h-5 text-[#133C1B]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span>{r.dataStr}</span>
                    <span className="text-zinc-400 font-normal">às</span>
                    <span>{r.horarioStr}</span>
                  </div>
                  {renderBadgeStatus(r.status)}

                  {r.meetLink && (
                    <a
                      href={r.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 print:hidden transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.5 4.5l-4.5 3.6V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h9c1.1 0 2-.9 2-2v-2.1l4.5 3.6c.5.4 1.5.1 1.5-.7V5.2c0-.8-1-1.1-1.5-.7z" />
                      </svg>
                      Google Meet
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 print:hidden self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => abrirModalAta(r)}
                    className="text-xs font-bold font-karla px-3.5 py-1.5 bg-[#133C1B]/10 text-[#133C1B] hover:bg-[#133C1B]/20 border border-[#133C1B]/20 rounded-xl transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span>Registrar / Ver Ata</span>
                  </button>

                  <select
                    value={r.status}
                    onChange={(e) =>
                      handleAlterarStatus(r.id, e.target.value as any)
                    }
                    className="text-xs font-karla font-medium border border-zinc-300 rounded-xl px-2.5 py-1.5 bg-white text-zinc-700 shadow-xs focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 cursor-pointer"
                  >
                    <option value="AGENDADA">Agendada</option>
                    <option value="REALIZADA">Realizada</option>
                    <option value="CANCELADA">Cancelada</option>
                    <option value="FALTA">Falta</option>
                  </select>
                </div>
              </div>

              {/* Participantes */}
              <div className="text-xs text-zinc-500 flex flex-wrap gap-4">
                <span>
                  <strong>Orientando:</strong> {r.alunoNome} ({r.alunoEmail})
                </span>
                <span>
                  <strong>Orientador:</strong> {r.orientadorNome}
                </span>
              </div>

              {/* Pauta */}
              {r.pauta && (
                <div className="p-3.5 bg-zinc-50/70 border border-zinc-200/80 rounded-xl font-spectral">
                  <span className="text-xs font-bold font-karla uppercase tracking-wider text-zinc-700 block mb-1">
                    Pauta Prevista:
                  </span>
                  <p className="text-xs sm:text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
                    {r.pauta}
                  </p>
                </div>
              )}

              {/* Ata / Resumo e Decisões */}
              {(r.decisoes || r.combinados || r.proximosPassos || r.duvidasAbertas) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {r.decisoes && (
                    <div className="p-3.5 bg-emerald-50/40 border border-emerald-200/80 rounded-xl font-spectral">
                      <span className="text-xs font-bold font-karla text-emerald-800 flex items-center gap-1.5 mb-1">
                        <svg className="h-3.5 w-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Decisões Tomadas:
                      </span>
                      <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">
                        {r.decisoes}
                      </p>
                    </div>
                  )}

                  {r.combinados && (
                    <div className="p-3.5 bg-blue-50/40 border border-blue-200/80 rounded-xl font-spectral">
                      <span className="text-xs font-bold font-karla text-blue-800 flex items-center gap-1.5 mb-1">
                        <svg className="h-3.5 w-3.5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Combinados &amp; Prazos:
                      </span>
                      <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">
                        {r.combinados}
                      </p>
                    </div>
                  )}

                  {r.proximosPassos && (
                    <div className="p-3.5 bg-purple-50/40 border border-purple-200/80 rounded-xl font-spectral">
                      <span className="text-xs font-bold font-karla text-purple-800 flex items-center gap-1.5 mb-1">
                        <svg className="h-3.5 w-3.5 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        Próximos Passos:
                      </span>
                      <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">
                        {r.proximosPassos}
                      </p>
                    </div>
                  )}

                  {r.duvidasAbertas && (
                    <div className="p-3.5 bg-amber-50/40 border border-amber-200/80 rounded-xl font-spectral">
                      <span className="text-xs font-bold font-karla text-amber-800 flex items-center gap-1.5 mb-1">
                        <svg className="h-3.5 w-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Dúvidas / Bloqueios Abertos:
                      </span>
                      <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">
                        {r.duvidasAbertas}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Atividades Geradas no Encontro */}
              {r.tarefasGeradas.length > 0 && (
                <div className="pt-2 border-t border-zinc-100 space-y-2">
                  <span className="text-xs font-bold font-karla text-zinc-700 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#133C1B]"></span>
                    Atividades Geradas no Encontro ({r.tarefasGeradas.length}):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {r.tarefasGeradas.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-zinc-50/70 border border-zinc-200/80 font-spectral"
                      >
                        <span
                          className={`font-medium ${
                            t.status === "CONCLUIDA"
                              ? "line-through text-zinc-400"
                              : "text-zinc-800"
                          }`}
                        >
                          {t.titulo}
                        </span>
                        <div className="flex items-center gap-2 text-zinc-500">
                          <span className="bg-white border border-zinc-200 px-2 py-0.5 rounded-md text-[10px] font-bold font-karla">
                            {t.responsavelTipo || "ALUNO"}
                          </span>
                          {t.prazo && <span>{t.prazo}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pendências da Reunião Anterior */}
              {r.pendenciasAnterior.length > 0 && (
                <div className="pt-2 border-t border-zinc-100 space-y-2">
                  <span className="text-xs font-bold font-karla text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Pendências Trazidas do Encontro Anterior ({r.pendenciasAnterior.length}):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {r.pendenciasAnterior.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-amber-50/50 border border-amber-200/80 font-spectral"
                      >
                        <span className="font-medium text-amber-900">
                          {p.titulo}
                        </span>
                        <span className="text-[10px] text-amber-700 font-karla font-semibold">
                          De {p.reuniaoOrigemDataStr}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* MODAL REGISTRAR ATA / DECISÕES */}
      {modalAtaReuniao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-4 max-h-[90vh] overflow-y-auto text-left font-spectral">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="text-lg font-bold font-karla text-zinc-900">
                  Ata e Decisões da Reunião
                </h3>
                <p className="text-xs text-zinc-500 font-spectral">
                  {modalAtaReuniao.dataStr} às {modalAtaReuniao.horarioStr} — {modalAtaReuniao.alunoNome}
                </p>
              </div>
              <button
                onClick={() => setModalAtaReuniao(null)}
                className="text-zinc-400 hover:text-zinc-700 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label
                htmlFor="modal-pauta-form"
                className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
              >
                Pauta Discutida:
              </label>
              <textarea
                id="modal-pauta-form"
                rows={2}
                value={pautaForm}
                onChange={(e) => setPautaForm(e.target.value)}
                placeholder="Pontos abordados na orientação..."
                className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
              />
            </div>

            <div>
              <label
                htmlFor="modal-decisoes-form"
                className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
              >
                Decisões e Definições Tomadas:
              </label>
              <textarea
                id="modal-decisoes-form"
                rows={3}
                value={decisoesForm}
                onChange={(e) => setDecisoesForm(e.target.value)}
                placeholder="Principais decisões tomadas em conjunto sobre o rumo da pesquisa..."
                className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
              />
            </div>

            <div>
              <label
                htmlFor="modal-combinados-form"
                className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
              >
                Combinados e Responsabilidades:
              </label>
              <textarea
                id="modal-combinados-form"
                rows={3}
                value={combinadosForm}
                onChange={(e) => setCombinadosForm(e.target.value)}
                placeholder="O que ficou alinhado entre aluno e orientador..."
                className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="modal-passos-form"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Próximos Passos:
                </label>
                <textarea
                  id="modal-passos-form"
                  rows={2}
                  value={proximosPassosForm}
                  onChange={(e) => setProximosPassosForm(e.target.value)}
                  placeholder="Ações imediatas..."
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="modal-duvidas-form"
                  className="block text-xs font-bold font-karla text-zinc-700 uppercase mb-1"
                >
                  Dúvidas / Bloqueios Abertos:
                </label>
                <textarea
                  id="modal-duvidas-form"
                  rows={2}
                  value={duvidasForm}
                  onChange={(e) => setDuvidasForm(e.target.value)}
                  placeholder="Questões que ainda dependem de resolução..."
                  className="w-full text-sm p-2.5 border border-zinc-300 rounded-xl font-spectral focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none shadow-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setModalAtaReuniao(null)}
                className="px-4 py-2 text-sm font-semibold font-karla text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarAta}
                disabled={isPending}
                className="px-4 py-2 text-sm font-bold font-karla text-white bg-[#133C1B] hover:bg-[#133C1B]/90 rounded-xl disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                Salvar Ata
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


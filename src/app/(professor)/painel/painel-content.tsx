"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";

export interface AlunoPainelItem {
  id: string;
  nome: string;
  email: string;
  nivel: string;
  statusEfetivo: "OK" | "ATENCAO" | "CRITICO";
  statusManual?: "OK" | "ATENCAO" | "CRITICO" | null;
  diasSemReuniao: number;
  dataReferencia?: string;
  quantidadeArtigos: number;
  arquivado: boolean;
}

interface FiltrosState {
  status: string; // "" (todos) | "CRITICO" | "ATENCAO" | "OK"
  nivel: string; // "" (todos) | "TCC" | "MESTRADO" | "DOUTORADO"
  ordenar: string; // "status" | "dias" | "nome"
  situacao: string; // "ativos" | "arquivados" | "todos"
}

const FILTROS_PADRAO: FiltrosState = {
  status: "",
  nivel: "",
  ordenar: "status",
  situacao: "ativos",
};

const ROTULOS_NIVEL: Record<string, string> = {
  TCC: "TCC",
  MESTRADO: "Mestrado",
  DOUTORADO: "Doutorado",
};

const ORDEM_STATUS: Record<string, number> = {
  CRITICO: 0,
  ATENCAO: 1,
  OK: 2,
};

function SleepyFaceIcon({ className = "h-24 w-24" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Contorno e fundo suave do rostinho em tons neutros (cinza/zinc) */}
      <circle
        cx="40"
        cy="44"
        r="30"
        fill="#F4F4F5"
        stroke="#A1A1AA"
        strokeWidth="2.5"
      />

      {/* Olho esquerdo sonolento em cinza grafite neutro */}
      <path
        d="M27 40C29 44 35 44 37 40"
        stroke="#52525B"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Olho direito sonolento em cinza grafite neutro */}
      <path
        d="M43 40C45 44 51 44 53 40"
        stroke="#52525B"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Boquinha de sono / bocejo em cinza grafite neutro */}
      <ellipse
        cx="40"
        cy="55"
        rx="4.5"
        ry="6"
        fill="#52525B"
      />

      {/* Bochechinhas neutras sutis */}
      <ellipse
        cx="23"
        cy="49"
        rx="3.5"
        ry="2"
        fill="#E4E4E7"
      />
      <ellipse
        cx="57"
        cy="49"
        rx="3.5"
        ry="2"
        fill="#E4E4E7"
      />

      {/* Letras Zzz em cinza médio neutro */}
      <g fill="#71717A" className="font-karla font-bold">
        <text x="56" y="24" fontSize="15" fontWeight="bold">Z</text>
        <text x="65" y="16" fontSize="12" fontWeight="bold">z</text>
        <text x="71" y="9" fontSize="9" fontWeight="bold">z</text>
      </g>
    </svg>
  );
}

function ContadorDiasSemReuniao({
  dataReferencia,
  diasIniciais,
}: {
  dataReferencia?: string;
  diasIniciais: number;
}) {
  const [agora, setAgora] = useState<number | null>(null);

  useEffect(() => {
    setAgora(Date.now());
    // Atualiza o relógio a cada segundo para manter o contador e o ciclo de 24h em tempo real
    const timer = setInterval(() => {
      setAgora(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { dias, horas, minutos, segundos } = useMemo(() => {
    if (!dataReferencia || agora === null) {
      return { dias: diasIniciais, horas: 24, minutos: 0, segundos: 0 };
    }
    const refMs = new Date(dataReferencia).getTime();
    const diffMs = Math.max(0, agora - refMs);

    const DAY_MS = 24 * 60 * 60 * 1000;
    const diasCalc = Math.floor(diffMs / DAY_MS);

    // Tempo restante para completar o próximo ciclo de 24 horas
    const msNoCicloAtual = diffMs % DAY_MS;
    const msRestanteParaProximoDia = DAY_MS - msNoCicloAtual;

    const horasRest = Math.floor(msRestanteParaProximoDia / (60 * 60 * 1000));
    const minutosRest = Math.floor((msRestanteParaProximoDia % (60 * 60 * 1000)) / (60 * 1000));
    const segundosRest = Math.floor((msRestanteParaProximoDia % (60 * 1000)) / 1000);

    return {
      dias: diasCalc,
      horas: horasRest,
      minutos: minutosRest,
      segundos: segundosRest,
    };
  }, [dataReferencia, diasIniciais, agora]);

  const pad = (n: number) => String(n).padStart(2, "0");

  const corStatus =
    dias > 30
      ? "text-red-600 font-semibold"
      : dias >= 7
      ? "text-amber-700 font-semibold"
      : "text-zinc-700 font-medium";

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5">
        <span className={`text-sm ${corStatus}`} suppressHydrationWarning>
          {`${dias} ${dias === 1 ? "dia" : "dias"}`}
        </span>
        {dias >= 7 && (
          <span
            className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800 font-karla"
            title="Aluno há 1 semana ou mais sem reunião"
          >
            ≥ 1 sem
          </span>
        )}
      </div>
      <span
        className="text-[11px] text-zinc-400 font-mono tracking-tight"
        title="Tempo até contabilizar mais 24 horas sem reunião"
        suppressHydrationWarning
      >
        {agora === null ? "\u00A0" : `+1 em ${pad(horas)}:${pad(minutos)}:${pad(segundos)}`}
      </span>
    </div>
  );
}

export function PainelContent({
  alunos,
  filtrosIniciais,
}: {
  alunos: AlunoPainelItem[];
  filtrosIniciais?: Partial<FiltrosState>;
}) {
  const [busca, setBusca] = useState("");
  const [modalFiltrosAberto, setModalFiltrosAberto] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Filtros ativos aplicados na tabela
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosState>({
    ...FILTROS_PADRAO,
    ...filtrosIniciais,
  });

  // Filtros temporários dentro do modal antes de aplicar
  const [filtrosModal, setFiltrosModal] = useState<FiltrosState>(filtrosAtivos);

  // Fechar modal com tecla ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && modalFiltrosAberto) {
        setModalFiltrosAberto(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalFiltrosAberto]);

  // Bloquear rolagem do body quando modal estiver aberto
  useEffect(() => {
    if (modalFiltrosAberto) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [modalFiltrosAberto]);

  // Contagem de filtros ativos (diferentes do padrão)
  const quantidadeFiltrosAtivos = useMemo(() => {
    let count = 0;
    if (filtrosAtivos.status) count++;
    if (filtrosAtivos.nivel) count++;
    if (filtrosAtivos.ordenar !== "status") count++;
    if (filtrosAtivos.situacao !== "ativos") count++;
    return count;
  }, [filtrosAtivos]);

  // Alunos filtrados e ordenados
  const alunosFiltrados = useMemo(() => {
    let lista = [...alunos];

    // Filtro por situação (ativos / arquivados / todos)
    if (filtrosAtivos.situacao === "ativos") {
      lista = lista.filter((a) => !a.arquivado);
    } else if (filtrosAtivos.situacao === "arquivados") {
      lista = lista.filter((a) => a.arquivado);
    }

    // Filtro por termo de busca no nome
    if (busca.trim()) {
      const termoNormalizado = busca
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      lista = lista.filter((a) => {
        const nomeNormalizado = a.nome
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        return nomeNormalizado.includes(termoNormalizado);
      });
    }

    // Filtro por Status
    if (filtrosAtivos.status) {
      lista = lista.filter((a) => a.statusEfetivo === filtrosAtivos.status);
    }

    // Filtro por Nível
    if (filtrosAtivos.nivel) {
      lista = lista.filter((a) => a.nivel === filtrosAtivos.nivel);
    }

    // Ordenação
    if (filtrosAtivos.ordenar === "dias") {
      lista.sort((a, b) => b.diasSemReuniao - a.diasSemReuniao);
    } else if (filtrosAtivos.ordenar === "nome") {
      lista.sort((a, b) => a.nome.localeCompare(b.nome));
    } else {
      // Padrão: por urgência de status
      lista.sort(
        (a, b) => (ORDEM_STATUS[a.statusEfetivo] ?? 9) - (ORDEM_STATUS[b.statusEfetivo] ?? 9)
      );
    }

    return lista;
  }, [alunos, busca, filtrosAtivos]);

  function handleAbrirModal() {
    setFiltrosModal({ ...filtrosAtivos });
    setModalFiltrosAberto(true);
  }

  function handleLimparFiltrosModal() {
    setFiltrosModal({ ...FILTROS_PADRAO });
  }

  function handleAplicarFiltros() {
    setFiltrosAtivos({ ...filtrosModal });
    setModalFiltrosAberto(false);
  }

  return (
    <div className="relative min-h-[calc(100vh-10rem)] flex flex-col pb-24 text-left">
      {/* Descrição da página alinhada à esquerda abaixo da topbar */}
      <div className="mb-6 sm:mb-8 text-left w-full">
        <p className="text-sm sm:text-base text-zinc-600 font-spectral leading-relaxed text-left">
          Acompanhe os trabalhos e prazos do(s) seu(s) orientando(s) com praticidade.
        </p>
      </div>

      {/* Conteúdo principal: estado vazio se o orientador não tem nenhum aluno, ou painel com busca e tabela */}
      {alunos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20 sm:py-28 text-center my-auto">
          <SleepyFaceIcon className="h-24 w-24 sm:h-28 sm:w-28 drop-shadow-xs transition-transform hover:scale-105 duration-300" />
          <p className="mt-5 text-base sm:text-lg font-medium text-zinc-600 font-spectral">
            Não tem nada aqui, pode ir dormir
          </p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-5xl space-y-6">
          {/* Barra de pesquisa + Botão Filtros */}
          <div className="flex items-center gap-3 w-full">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar orientando por nome..."
                className="w-full rounded-xl border border-zinc-300 bg-white pl-10 pr-10 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all font-spectral shadow-xs"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  aria-label="Limpar pesquisa"
                >
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Botão Filtros */}
            <button
              type="button"
              onClick={handleAbrirModal}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all font-karla shadow-xs cursor-pointer ${
                quantidadeFiltrosAtivos > 0
                  ? "border-[#133C1B] bg-[#133C1B]/10 text-[#133C1B] hover:bg-[#133C1B]/15"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <svg className="h-4.5 w-4.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              <span>Filtros</span>
              {quantidadeFiltrosAtivos > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#133C1B] text-[11px] font-bold text-white">
                  {quantidadeFiltrosAtivos}
                </span>
              )}
            </button>
          </div>

          {/* Tabela Reformulada */}
          <div className="overflow-x-auto rounded-2xl border border-zinc-200/90 bg-white shadow-xs">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla">
                <tr>
                  <th className="px-5 py-3.5">Aluno</th>
                  <th className="px-5 py-3.5">Nível</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Dias sem reunião</th>
                  <th className="px-5 py-3.5">Quantidade de artigos</th>
                  <th className="px-5 py-3.5 text-right font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-spectral">
                {alunosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-zinc-500 font-spectral">
                      <div className="flex flex-col items-center justify-center space-y-2.5">
                        <svg className="h-10 w-10 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        <p className="text-sm font-medium text-zinc-600">Nenhum orientando encontrado.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  alunosFiltrados.map((aluno) => (
                    <tr key={aluno.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* Coluna 1: Aluno (Apenas nome) */}
                      <td className="px-5 py-4 font-semibold text-zinc-900 font-karla">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/alunos/${aluno.id}`}
                            className="hover:underline hover:text-[#133C1B] transition-colors"
                          >
                            {aluno.nome}
                          </Link>
                          {aluno.arquivado && (
                            <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-karla">
                              Arquivado
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Coluna 2: Nível */}
                      <td className="px-5 py-4 text-zinc-700">
                        <span className="font-medium">
                          {ROTULOS_NIVEL[aluno.nivel] || aluno.nivel}
                        </span>
                      </td>

                      {/* Coluna 3: Status */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={aluno.statusEfetivo} />
                          {aluno.statusManual && (
                            <span className="text-[11px] text-zinc-400 font-spectral" title="Status definido manualmente">
                              (manual)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Coluna 4: Dias sem reunião com contador em tempo real */}
                      <td className="px-5 py-4 text-zinc-700">
                        <ContadorDiasSemReuniao
                          dataReferencia={aluno.dataReferencia}
                          diasIniciais={aluno.diasSemReuniao}
                        />
                      </td>

                      {/* Coluna 5: Quantidade de artigos */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 font-karla border border-zinc-200/60">
                          {aluno.quantidadeArtigos}
                        </span>
                      </td>

                      {/* Coluna 6: Acompanhar */}
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/alunos/${aluno.id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#133C1B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1a4f24] active:scale-95 transition-all font-karla cursor-pointer"
                        >
                          <span>Acompanhar</span>
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Botão Adicionar Aluno fixo no canto inferior direito */}
      <Link
        href="/alunos/novo"
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 flex items-center gap-2 rounded-full bg-[#133C1B] px-5 py-3.5 text-sm sm:text-base font-semibold text-white shadow-xl hover:bg-[#1a4f24] hover:shadow-2xl active:scale-95 transition-all font-karla tracking-wide cursor-pointer focus:outline-none focus:ring-4 focus:ring-[#133C1B]/30"
        aria-label="Adicionar Aluno"
      >
        <svg
          className="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        <span>Adicionar Aluno</span>
      </Link>

      {/* Modal de Filtros */}
      {modalFiltrosAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalFiltrosAberto(false);
            }
          }}
        >
          <div
            ref={modalRef}
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-6 text-left max-h-[90vh] overflow-y-auto"
          >
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-[#133C1B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                <h2 className="text-lg font-bold text-zinc-900 font-karla">
                  Opções de Filtro
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalFiltrosAberto(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Conteúdo dos Filtros */}
            <div className="space-y-5">
              {/* Filtro: Status */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla">
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "", label: "Todos" },
                    { id: "CRITICO", label: "Crítico" },
                    { id: "ATENCAO", label: "Atenção" },
                    { id: "OK", label: "Ok" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFiltrosModal({ ...filtrosModal, status: item.id })}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold font-karla transition-all cursor-pointer text-center ${
                        filtrosModal.status === item.id
                          ? "border-[#133C1B] bg-[#133C1B] text-white shadow-xs"
                          : "border-zinc-200 bg-zinc-50/70 text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtro: Nível */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla">
                  Nível
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "", label: "Todos" },
                    { id: "TCC", label: "TCC" },
                    { id: "MESTRADO", label: "Mestrado" },
                    { id: "DOUTORADO", label: "Doutorado" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFiltrosModal({ ...filtrosModal, nivel: item.id })}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold font-karla transition-all cursor-pointer text-center ${
                        filtrosModal.nivel === item.id
                          ? "border-[#133C1B] bg-[#133C1B] text-white shadow-xs"
                          : "border-zinc-200 bg-zinc-50/70 text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtro: Ordenação */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla">
                  Ordenar por
                </label>
                <div className="space-y-1.5">
                  {[
                    { id: "status", label: "Urgência de status (Padrão)" },
                    { id: "dias", label: "Mais dias sem reunião" },
                    { id: "nome", label: "Nome do aluno (A-Z)" },
                  ].map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs font-medium cursor-pointer transition-all font-karla ${
                        filtrosModal.ordenar === item.id
                          ? "border-[#133C1B] bg-[#133C1B]/5 text-[#133C1B] font-semibold"
                          : "border-zinc-200 bg-zinc-50/50 text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name="ordenar"
                        value={item.id}
                        checked={filtrosModal.ordenar === item.id}
                        onChange={() => setFiltrosModal({ ...filtrosModal, ordenar: item.id })}
                        className="text-[#133C1B] focus:ring-[#133C1B]"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Filtro: Situação */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla">
                  Situação
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "ativos", label: "Ativos" },
                    { id: "arquivados", label: "Arquivados" },
                    { id: "todos", label: "Todos" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFiltrosModal({ ...filtrosModal, situacao: item.id })}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold font-karla transition-all cursor-pointer text-center ${
                        filtrosModal.situacao === item.id
                          ? "border-[#133C1B] bg-[#133C1B] text-white shadow-xs"
                          : "border-zinc-200 bg-zinc-50/70 text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Rodapé do Modal: Botões Limpar e Aplicar */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={handleLimparFiltrosModal}
                className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.99] transition-all font-karla cursor-pointer"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={handleAplicarFiltros}
                className="rounded-xl bg-[#133C1B] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1a4f24] active:scale-[0.99] transition-all font-karla cursor-pointer"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

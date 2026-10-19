"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { atualizarStatusManual } from "@/lib/actions/notas";
import {
  atualizarStatusProducao,
  obterProducaoTempoRealProfessor,
  adicionarMarcacaoComentarioProfessor,
  resolverComentarioProducao,
  excluirComentarioProducao,
  type CorMarcacao,
  type ComentarioArtigo,
} from "@/lib/actions/producao";
import { formatarData, formatarDataHora } from "@/lib/datas";

export interface ProducaoFichaItem {
  id: string;
  titulo: string;
  venue: string | null;
  status: "EM_ESCRITA" | "SUBMETIDO" | "EM_REVISAO" | "ACEITO" | "PUBLICADO";
  prazoSubmissao: Date | string | null;
  googleDocsUrl?: string | null;
  overleafUrl?: string | null;
  comentariosJson?: string | null;
  conteudo?: string | null;
  criadoEm: Date | string;
  atualizadoEm: Date | string;
}

const ROTULOS_NIVEL: Record<string, string> = {
  TCC: "TCC",
  MESTRADO: "Mestrado",
  DOUTORADO: "Doutorado",
};

const CONFIG_STATUS_ALUNO: Record<
  "OK" | "ATENCAO" | "CRITICO",
  { label: string; badgeClass: string; dotClass: string }
> = {
  OK: {
    label: "OK",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200/70",
    dotClass: "bg-emerald-500",
  },
  ATENCAO: {
    label: "ALERTA",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200/70",
    dotClass: "bg-amber-500",
  },
  CRITICO: {
    label: "CRÍTICO",
    badgeClass: "bg-red-100 text-red-800 border-red-300 hover:bg-red-200/70",
    dotClass: "bg-red-500",
  },
};

export const CORES_MARCACAO: Record<
  CorMarcacao,
  {
    nome: string;
    bgHex: string;
    dotClass: string;
    badgeClass: string;
    borderClass: string;
    quoteBgClass: string;
  }
> = {
  AMARELO: {
    nome: "Amarelo",
    bgHex: "#FEF08A",
    dotClass: "bg-yellow-400 border-yellow-600",
    badgeClass: "bg-yellow-100 text-yellow-900 border-yellow-300",
    borderClass: "border-l-yellow-400",
    quoteBgClass: "bg-yellow-100/80 text-yellow-950",
  },
  VERMELHO: {
    nome: "Vermelho",
    bgHex: "#FECACA",
    dotClass: "bg-red-400 border-red-600",
    badgeClass: "bg-red-100 text-red-900 border-red-300",
    borderClass: "border-l-red-400",
    quoteBgClass: "bg-red-100/80 text-red-950",
  },
  AZUL: {
    nome: "Azul",
    bgHex: "#BFDBFE",
    dotClass: "bg-blue-400 border-blue-600",
    badgeClass: "bg-blue-100 text-blue-900 border-blue-300",
    borderClass: "border-l-blue-400",
    quoteBgClass: "bg-blue-100/80 text-blue-950",
  },
  ROXO: {
    nome: "Roxo",
    bgHex: "#E9D5FF",
    dotClass: "bg-purple-400 border-purple-600",
    badgeClass: "bg-purple-100 text-purple-900 border-purple-300",
    borderClass: "border-l-purple-400",
    quoteBgClass: "bg-purple-100/80 text-purple-950",
  },
};

function parseComentarios(jsonStr?: string | null): ComentarioArtigo[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const ROTULOS_STATUS_PRODUCAO: Record<string, string> = {
  EM_ESCRITA: "Em escrita",
  SUBMETIDO: "Submetido",
  EM_REVISAO: "Em revisão",
  ACEITO: "Aceito",
  PUBLICADO: "Publicado",
};

const OPCOES_STATUS_PRODUCAO = [
  "EM_ESCRITA",
  "SUBMETIDO",
  "EM_REVISAO",
  "ACEITO",
  "PUBLICADO",
] as const;

function getStatusProducaoStyle(status: string) {
  switch (status) {
    case "EM_ESCRITA":
      return "bg-blue-50 text-blue-700 border border-blue-200/80";
    case "SUBMETIDO":
      return "bg-amber-50 text-amber-700 border border-amber-200/80";
    case "EM_REVISAO":
      return "bg-purple-50 text-purple-700 border border-purple-200/80";
    case "ACEITO":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200/80";
    case "PUBLICADO":
      return "bg-green-100 text-[#133C1B] border border-green-300";
    default:
      return "bg-zinc-100 text-zinc-700 border border-zinc-200";
  }
}

function OverleafIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.8 3.2C14.6 3.2 9.5 6.1 7.1 10.8c-1.4 2.7-1.6 5.8-.5 8.4l-2.3 2.3a.75.75 0 1 0 1.06 1.06l2.28-2.28c1.4.5 3 .7 4.66.5 4.9-.6 8.5-4.9 8.5-10.3 0-2.6-.5-5.1-1-7.28zm-7.7 15.1c-1.2.15-2.35-.02-3.38-.42 1.88-1.98 4.44-4.23 7.38-5.58a.75.75 0 0 0-.62-1.36c-3.17 1.45-5.88 3.82-7.85 5.88-.58-1.8-.34-3.85.67-5.8 1.98-3.84 6.12-6.24 10.37-6.37.28 1.47.53 3.16.53 4.85 0 4.44-3.02 8.07-7.1 8.8z" />
    </svg>
  );
}

function SleepyFaceIcon({ className = "h-20 w-20" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="40" cy="44" r="30" fill="#F4F4F5" stroke="#A1A1AA" strokeWidth="2.5" />
      <path d="M27 40C29 44 35 44 37 40" stroke="#52525B" strokeWidth="3" strokeLinecap="round" />
      <path d="M43 40C45 44 51 44 53 40" stroke="#52525B" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="40" cy="55" rx="4.5" ry="6" fill="#52525B" />
      <ellipse cx="23" cy="49" rx="3.5" ry="2" fill="#E4E4E7" />
      <ellipse cx="57" cy="49" rx="3.5" ry="2" fill="#E4E4E7" />
      <g fill="#71717A" className="font-karla font-bold">
        <text x="56" y="24" fontSize="15" fontWeight="bold">Z</text>
        <text x="65" y="16" fontSize="12" fontWeight="bold">z</text>
        <text x="71" y="9" fontSize="9" fontWeight="bold">z</text>
      </g>
    </svg>
  );
}

export function CardPerfilAluno({
  alunoId,
  nome,
  email,
  nivel,
  tema,
  diasIniciais,
  dataReferencia,
  statusInicial,
  contaPendente,
  arquivado,
}: {
  alunoId: string;
  nome: string;
  email: string;
  nivel: string;
  tema?: string | null;
  diasIniciais: number;
  dataReferencia: string;
  statusInicial: "OK" | "ATENCAO" | "CRITICO";
  contaPendente: boolean;
  arquivado: boolean;
}) {
  const [statusAtual, setStatusAtual] = useState<"OK" | "ATENCAO" | "CRITICO">(statusInicial);
  const [menuAberto, setMenuAberto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [dias, setDias] = useState(diasIniciais);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStatusAtual(statusInicial);
  }, [statusInicial]);

  useEffect(() => {
    const refMs = new Date(dataReferencia).getTime();
    if (isNaN(refMs)) return;
    const calcular = () => {
      const diff = Math.max(0, Date.now() - refMs);
      setDias(Math.floor(diff / (1000 * 60 * 60 * 24)));
    };
    calcular();
    const interval = setInterval(calcular, 10000);
    return () => clearInterval(interval);
  }, [dataReferencia]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelecionarStatus(novoStatus: "OK" | "ATENCAO" | "CRITICO") {
    setStatusAtual(novoStatus);
    setMenuAberto(false);
    startTransition(async () => {
      await atualizarStatusManual(alunoId, novoStatus);
    });
  }

  const config = CONFIG_STATUS_ALUNO[statusAtual] ?? CONFIG_STATUS_ALUNO.OK;

  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Esquerda: Foto de perfil + Nome, Email, Nível */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-full bg-[#133C1B]/10 text-[#133C1B] ring-2 ring-[#133C1B]/20 shadow-xs">
            <svg
              className="h-9 w-9 sm:h-10 sm:w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.6}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
              />
            </svg>
          </div>

          <div className="space-y-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-zinc-900 font-karla">
                {nome}
              </h2>
              <span className="inline-flex items-center rounded-md bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 font-karla border border-zinc-200/80">
                {ROTULOS_NIVEL[nivel] ?? nivel}
              </span>
              {arquivado && (
                <span className="inline-flex items-center rounded-md bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-600 font-karla">
                  Arquivado
                </span>
              )}
            </div>

            <p className="text-sm text-zinc-500 font-spectral">{email}</p>

            {tema && (
              <p className="text-xs sm:text-sm text-zinc-600 font-spectral pt-0.5">
                <span className="font-semibold text-zinc-700 font-karla">Tema:</span> {tema}
              </p>
            )}

            {contaPendente && (
              <p className="text-xs text-amber-600 font-karla font-medium pt-0.5">
                Convite enviado — aguardando criação de conta pelo aluno.
              </p>
            )}
          </div>
        </div>

        {/* Direita: Dias sem reunião + Status clicável */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-t border-zinc-100 pt-4 sm:border-t-0 sm:pt-0">
          <div className="flex flex-col items-start sm:items-end">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-karla">
              Dias sem reunião
            </span>
            <span className="mt-0.5 text-base sm:text-lg font-bold text-zinc-800 font-karla tabular-nums">
              {dias} {dias === 1 ? "dia" : "dias"}
            </span>
          </div>

          <div className="h-9 w-[1px] bg-zinc-200 hidden sm:block" />

          {/* Status Clicável */}
          <div className="relative" ref={dropdownRef}>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-karla mb-1 sm:text-right">
              Status (clique para alterar)
            </span>
            <button
              type="button"
              onClick={() => setMenuAberto((prev) => !prev)}
              disabled={isPending}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold font-karla tracking-wide transition-all cursor-pointer shadow-2xs active:scale-95 ${config.badgeClass} ${
                isPending ? "opacity-60" : ""
              }`}
              title="Clique para alterar o status do aluno"
            >
              <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
              <span>{config.label}</span>
              <svg
                className={`h-3.5 w-3.5 transition-transform ${menuAberto ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.25}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {menuAberto && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 z-30">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-karla">
                  Alterar status para:
                </div>
                {(["OK", "ATENCAO", "CRITICO"] as const).map((op) => {
                  const itemCfg = CONFIG_STATUS_ALUNO[op];
                  const selecionado = statusAtual === op;
                  return (
                    <button
                      key={op}
                      type="button"
                      onClick={() => handleSelecionarStatus(op)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold font-karla transition-colors cursor-pointer ${
                        selecionado ? "bg-zinc-100 text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${itemCfg.dotClass}`} />
                        {itemCfg.label}
                      </span>
                      {selecionado && (
                        <svg className="h-4 w-4 text-[#133C1B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CardProducoesAluno({
  producoesIniciais,
}: {
  producoesIniciais: ProducaoFichaItem[];
}) {
  const [producoes, setProducoes] = useState<ProducaoFichaItem[]>(producoesIniciais);
  const [artigoAberto, setArtigoAberto] = useState<ProducaoFichaItem | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [isPendingStatus, startStatusTransition] = useTransition();
  const [salvandoComentario, startComentarioTransition] = useTransition();

  // Estados para o fluxo em 2 etapas:
  // 1) Seleciona trecho com o mouse -> aparece pequeno modal flutuante com botão preto "Comentar" próximo ao trecho
  // 2) Clica em "Comentar" -> abre o card de customização (escolha de cor + texto do comentário)
  const [trechoSelecionado, setTrechoSelecionado] = useState<string>("");
  const [posicaoPopover, setPosicaoPopover] = useState<{ top: number; left: number } | null>(null);
  const [cardCustomizacaoAberto, setCardCustomizacaoAberto] = useState<boolean>(false);
  const [corSelecionada, setCorSelecionada] = useState<CorMarcacao>("AMARELO");
  const [textoComentario, setTextoComentario] = useState<string>("");

  const artigoBodyRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputComentarioRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProducoes(producoesIniciais);
  }, [producoesIniciais]);

  // Foca automaticamente o input de comentário quando o card de customização é aberto
  useEffect(() => {
    if (cardCustomizacaoAberto) {
      setTimeout(() => {
        inputComentarioRef.current?.focus();
      }, 50);
    }
  }, [cardCustomizacaoAberto]);

  // Atualização em tempo real enquanto o modal de leitura do artigo estiver aberto
  useEffect(() => {
    if (!artigoAberto) return;

    const atualizarTempoReal = async () => {
      if (trechoSelecionado || cardCustomizacaoAberto) return;
      try {
        setSincronizando(true);
        const atualizado = await obterProducaoTempoRealProfessor(artigoAberto.id);
        setArtigoAberto((prev) => (prev ? { ...prev, ...atualizado } : null));
        setProducoes((prev) =>
          prev.map((p) => (p.id === atualizado.id ? { ...p, ...atualizado } : p))
        );
      } catch {
        // Silencioso no polling
      } finally {
        setSincronizando(false);
      }
    };

    const interval = setInterval(atualizarTempoReal, 5000);
    return () => clearInterval(interval);
  }, [artigoAberto?.id, trechoSelecionado, cardCustomizacaoAberto]);

  // Fechar visualizador com ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (cardCustomizacaoAberto) {
          setCardCustomizacaoAberto(false);
          setTrechoSelecionado("");
          setPosicaoPopover(null);
        } else if (posicaoPopover) {
          setPosicaoPopover(null);
          setTrechoSelecionado("");
        } else if (artigoAberto) {
          setArtigoAberto(null);
          setTrechoSelecionado("");
          setPosicaoPopover(null);
          setCardCustomizacaoAberto(false);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [artigoAberto, cardCustomizacaoAberto, posicaoPopover]);

  // Detecta seleção de texto com o mouse em tempo real (sem precisar de botão direito)
  useEffect(() => {
    if (!artigoAberto || cardCustomizacaoAberto) return;

    function checarSelecao() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !artigoBodyRef.current) {
        setPosicaoPopover(null);
        setTrechoSelecionado("");
        return;
      }

      const range = sel.getRangeAt(0);
      if (!artigoBodyRef.current.contains(range.commonAncestorContainer)) {
        setPosicaoPopover(null);
        setTrechoSelecionado("");
        return;
      }

      const texto = sel.toString().trim();
      if (!texto) {
        setPosicaoPopover(null);
        setTrechoSelecionado("");
        return;
      }

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const top = Math.max(16, rect.top - 46);
      const left = Math.min(
        window.innerWidth - 140,
        Math.max(20, rect.left + rect.width / 2 - 55)
      );

      setTrechoSelecionado(texto);
      setPosicaoPopover({ top, left });
    }

    function handleMouseUpGlobal() {
      setTimeout(checarSelecao, 15);
    }

    document.addEventListener("selectionchange", checarSelecao);
    window.addEventListener("mouseup", handleMouseUpGlobal);
    return () => {
      document.removeEventListener("selectionchange", checarSelecao);
      window.removeEventListener("mouseup", handleMouseUpGlobal);
    };
  }, [artigoAberto, cardCustomizacaoAberto]);

  function handleMudarStatusProducao(
    producaoId: string,
    novoStatus: (typeof OPCOES_STATUS_PRODUCAO)[number]
  ) {
    setProducoes((prev) =>
      prev.map((p) => (p.id === producaoId ? { ...p, status: novoStatus } : p))
    );
    if (artigoAberto?.id === producaoId) {
      setArtigoAberto((prev) => (prev ? { ...prev, status: novoStatus } : null));
    }
    startStatusTransition(async () => {
      await atualizarStatusProducao(producaoId, novoStatus);
    });
  }

  function verificarSelecaoMouse() {
    if (cardCustomizacaoAberto) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !artigoBodyRef.current) {
      setPosicaoPopover(null);
      setTrechoSelecionado("");
      return;
    }

    const range = sel.getRangeAt(0);
    if (!artigoBodyRef.current.contains(range.commonAncestorContainer)) {
      setPosicaoPopover(null);
      setTrechoSelecionado("");
      return;
    }

    const texto = sel.toString().trim();
    if (!texto) {
      setPosicaoPopover(null);
      setTrechoSelecionado("");
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    // Posiciona o pequeno modal com botão "Comentar" logo acima do trecho selecionado
    const top = Math.max(16, rect.top - 46);
    const left = Math.min(
      window.innerWidth - 140,
      Math.max(20, rect.left + rect.width / 2 - 55)
    );

    setTrechoSelecionado(texto);
    setPosicaoPopover({ top, left });
  }

  function handleAbrirCardCustomizacao(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPosicaoPopover(null);
    setCardCustomizacaoAberto(true);
  }

  function handleCancelarCustomizacao() {
    setCardCustomizacaoAberto(false);
    setPosicaoPopover(null);
    setTrechoSelecionado("");
    setTextoComentario("");
    window.getSelection()?.removeAllRanges();
  }

  function aplicarMarkNoHtml(htmlAtual: string, trecho: string, markId: string, cor: CorMarcacao): string {
    const corHex = CORES_MARCACAO[cor].bgHex;
    const escapedTrecho = trecho.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedTrecho})`, "i");
    if (regex.test(htmlAtual)) {
      return htmlAtual.replace(
        regex,
        `<mark data-mark-id="${markId}" data-cor="${cor}" style="background-color: ${corHex}; padding: 1px 3px; border-radius: 4px;">$1</mark>`
      );
    }
    return htmlAtual;
  }

  function handleSalvarMarcacaoEComentario(e: React.FormEvent) {
    e.preventDefault();
    if (!artigoAberto || !trechoSelecionado.trim()) return;

    const markId = `mark_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const htmlBase = artigoAberto.conteudo || "";
    const htmlComMark = aplicarMarkNoHtml(htmlBase, trechoSelecionado.trim(), markId, corSelecionada);

    const comentarioFinal = textoComentario.trim() || "Trecho destacado pelo orientador";

    startComentarioTransition(async () => {
      const res = await adicionarMarcacaoComentarioProfessor(artigoAberto.id, {
        id: markId,
        trecho: trechoSelecionado.trim(),
        comentario: comentarioFinal,
        cor: corSelecionada,
        conteudoAtualizado: htmlComMark,
      });

      const novoJson = JSON.stringify(res.comentarios);
      setArtigoAberto((prev) =>
        prev ? { ...prev, comentariosJson: novoJson, conteudo: res.conteudo } : null
      );
      setProducoes((prev) =>
        prev.map((p) =>
          p.id === artigoAberto.id
            ? { ...p, comentariosJson: novoJson, conteudo: res.conteudo }
            : p
        )
      );

      setCardCustomizacaoAberto(false);
      setPosicaoPopover(null);
      setTrechoSelecionado("");
      setTextoComentario("");
      window.getSelection()?.removeAllRanges();
    });
  }

  function handleResolverComentario(comentarioId: string) {
    if (!artigoAberto) return;
    startComentarioTransition(async () => {
      const res = await resolverComentarioProducao(artigoAberto.id, comentarioId);
      const novoJson = JSON.stringify(res.comentarios);
      setArtigoAberto((prev) =>
        prev ? { ...prev, comentariosJson: novoJson, conteudo: res.conteudo } : null
      );
      setProducoes((prev) =>
        prev.map((p) =>
          p.id === artigoAberto.id
            ? { ...p, comentariosJson: novoJson, conteudo: res.conteudo }
            : p
        )
      );
    });
  }

  function handleExcluirComentario(comentarioId: string) {
    if (!artigoAberto) return;
    startComentarioTransition(async () => {
      const res = await excluirComentarioProducao(artigoAberto.id, comentarioId);
      const novoJson = JSON.stringify(res.comentarios);
      setArtigoAberto((prev) =>
        prev ? { ...prev, comentariosJson: novoJson, conteudo: res.conteudo } : null
      );
      setProducoes((prev) =>
        prev.map((p) =>
          p.id === artigoAberto.id
            ? { ...p, comentariosJson: novoJson, conteudo: res.conteudo }
            : p
        )
      );
    });
  }

  const comentariosArtigoAberto = parseComentarios(artigoAberto?.comentariosJson);
  const comentariosPendentesAberto = comentariosArtigoAberto.filter((c) => !c.resolvido);
  const comentariosResolvidosAberto = comentariosArtigoAberto.filter((c) => c.resolvido);

  const textoLimpo = (artigoAberto?.conteudo || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const contagemPalavras = textoLimpo ? textoLimpo.split(" ").length : 0;

  return (
    <section className="w-full rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 font-karla">
            Produções Acadêmicas
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 font-spectral">
            Visualize os artigos em tempo real, destaque trechos com cores e deixe comentários para o orientando.
          </p>
        </div>
        <span className="inline-flex items-center self-start sm:self-auto rounded-full bg-[#133C1B]/10 px-3 py-1 text-xs font-bold text-[#133C1B] font-karla">
          {producoes.length} {producoes.length === 1 ? "trabalho" : "trabalhos"}
        </span>
      </div>

      {producoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <SleepyFaceIcon className="h-20 w-20 drop-shadow-xs" />
          <p className="mt-3 text-sm font-medium text-zinc-500 font-spectral">
            O orientando ainda não cadastrou nenhuma produção acadêmica.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 text-left">
          {producoes.map((p) => {
            const listaComentarios = parseComentarios(p.comentariosJson);
            const pendentes = listaComentarios.filter((c) => !c.resolvido).length;

            return (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200/90 bg-zinc-50/40 p-4 sm:p-5 shadow-2xs hover:shadow-md hover:bg-white transition-all space-y-4 text-left"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-base font-bold text-zinc-900 font-karla leading-snug">
                      {p.titulo}
                    </h3>
                    <select
                      value={p.status}
                      disabled={isPendingStatus}
                      onChange={(e) =>
                        handleMudarStatusProducao(
                          p.id,
                          e.target.value as (typeof OPCOES_STATUS_PRODUCAO)[number]
                        )
                      }
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold font-karla cursor-pointer focus:outline-none ${getStatusProducaoStyle(
                        p.status
                      )}`}
                      title="Alterar status da produção"
                    >
                      {OPCOES_STATUS_PRODUCAO.map((s) => (
                        <option key={s} value={s} className="bg-white text-zinc-800">
                          {ROTULOS_STATUS_PRODUCAO[s]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {p.venue && (
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-zinc-600 font-spectral mt-1">
                      <svg
                        className="h-4 w-4 text-zinc-400 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.75}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                        />
                      </svg>
                      <span className="truncate">{p.venue}</span>
                    </div>
                  )}

                  {/* Badges de vinculação e contagem de comentários pendentes */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {p.overleafUrl && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-[#138A07] border border-emerald-200/90 font-karla">
                        <OverleafIcon className="h-3.5 w-3.5 shrink-0" />
                        Overleaf Vinculado
                      </span>
                    )}
                    {p.googleDocsUrl && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200/80 font-karla">
                        <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM13 3.5L18.5 9H13V3.5zM16 17H8v-2h8v2zm0-4H8v-2h8v2z" />
                        </svg>
                        Google Docs Vinculado
                      </span>
                    )}
                    {!p.overleafUrl && !p.googleDocsUrl && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 border border-zinc-200/80 font-karla">
                        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                        Editor Scholab
                      </span>
                    )}

                    {/* Indicador de comentários que faltam ser resolvidos */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold font-karla border ${
                        pendentes > 0
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : "bg-zinc-100 text-zinc-600 border-zinc-200/80"
                      }`}
                    >
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                      {pendentes} {pendentes === 1 ? "comentário para resolver" : "comentários para resolver"}
                    </span>
                  </div>
                </div>

                <div className="border-t border-zinc-200/60 pt-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-zinc-500 font-spectral">
                    {p.prazoSubmissao ? (
                      <div className="flex items-center gap-1 text-amber-700 font-medium">
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Prazo: {formatarData(new Date(p.prazoSubmissao))}</span>
                      </div>
                    ) : (
                      <span>Sem prazo definido</span>
                    )}
                    <span>Criado em {formatarData(new Date(p.criadoEm))}</span>
                  </div>

                  {/* Botões de Ação do Card */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-zinc-100">
                    {p.overleafUrl && (
                      <a
                        href={p.overleafUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 text-xs font-semibold text-[#138A07] hover:bg-emerald-50 transition-colors font-karla"
                      >
                        <OverleafIcon className="h-3.5 w-3.5 shrink-0" />
                        <span>Abrir Overleaf</span>
                      </a>
                    )}

                    {p.googleDocsUrl && (
                      <a
                        href={p.googleDocsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors font-karla"
                      >
                        <svg className="h-3.5 w-3.5 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM13 3.5L18.5 9H13V3.5zM16 17H8v-2h8v2zm0-4H8v-2h8v2z" />
                        </svg>
                        <span>Abrir Docs</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setTrechoSelecionado("");
                        setPosicaoPopover(null);
                        setCardCustomizacaoAberto(false);
                        setTextoComentario("");
                        setArtigoAberto(p);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#133C1B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1a4f24] active:scale-95 transition-all font-karla cursor-pointer"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Visualizar Artigo</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pequeno modal flutuante próximo ao trecho selecionado com botão preto "Comentar" */}
      {artigoAberto && posicaoPopover && trechoSelecionado && !cardCustomizacaoAberto && (
        <div
          style={{ top: `${posicaoPopover.top}px`, left: `${posicaoPopover.left}px` }}
          className="fixed z-[70] animate-fade-in"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            type="button"
            onClick={handleAbrirCardCustomizacao}
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 px-3.5 py-2 text-xs font-bold text-white shadow-xl ring-1 ring-white/15 hover:bg-zinc-800 active:scale-95 transition-all font-karla cursor-pointer"
          >
            <svg className="h-3.5 w-3.5 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <span>Comentar</span>
          </button>
          {/* Setinha indicadora apontando para o trecho */}
          <div className="mx-auto h-2 w-2 -mt-1 rotate-45 bg-zinc-950" />
        </div>
      )}

      {/* Modal de Visualização em Tempo Real + Marcação de Texto e Comentários */}
      {artigoAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setArtigoAberto(null);
              setTrechoSelecionado("");
              setPosicaoPopover(null);
              setCardCustomizacaoAberto(false);
            }
          }}
        >
          <div className="relative flex flex-col w-full max-w-6xl h-[90vh] rounded-2xl bg-white shadow-2xl border border-zinc-200 overflow-hidden text-left">
            {/* Cabeçalho do Visualizador */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-6 py-4 shrink-0">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-zinc-900 font-karla">
                    {artigoAberto.titulo}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold font-karla ${getStatusProducaoStyle(
                      artigoAberto.status
                    )}`}
                  >
                    {ROTULOS_STATUS_PRODUCAO[artigoAberto.status]}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 font-karla">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Selecione qualquer trecho com o mouse para comentar
                  </span>
                </div>
                {artigoAberto.venue && (
                  <p className="text-xs text-zinc-500 font-spectral">
                    Venue: <span className="font-medium text-zinc-700">{artigoAberto.venue}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {artigoAberto.overleafUrl && (
                  <a
                    href={artigoAberto.overleafUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-[#138A07] hover:bg-emerald-100 transition-colors font-karla"
                  >
                    <OverleafIcon className="h-3.5 w-3.5" />
                    <span>Abrir no Overleaf ↗</span>
                  </a>
                )}
                {artigoAberto.googleDocsUrl && (
                  <a
                    href={artigoAberto.googleDocsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors font-karla"
                  >
                    <span>Abrir no Docs ↗</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setArtigoAberto(null);
                    setTrechoSelecionado("");
                    setPosicaoPopover(null);
                    setCardCustomizacaoAberto(false);
                  }}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700 transition-colors cursor-pointer"
                  aria-label="Fechar visualizador"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Conteúdo dividido: Artigo à esquerda + Painel de Marcações/Comentários à direita */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
              {/* Modal/Card de Customização do Comentário/Marcação (aparece somente após clicar no botão preto "Comentar") */}
              {cardCustomizacaoAberto && trechoSelecionado && (
                <div
                  className="absolute inset-0 z-40 flex items-center justify-center bg-black/25 backdrop-blur-[1px] p-4 animate-fade-in"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) handleCancelarCustomizacao();
                  }}
                >
                  <form
                    onSubmit={handleSalvarMarcacaoEComentario}
                    className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl space-y-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 font-karla">
                          Adicionar Marcação e Comentário
                        </h4>
                        <p className="text-xs text-zinc-500 font-spectral">
                          Escolha uma cor de destaque e escreva sua observação para o orientando.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelarCustomizacao}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-karla">
                        Trecho selecionado:
                      </span>
                      <blockquote
                        style={{ backgroundColor: CORES_MARCACAO[corSelecionada].bgHex }}
                        className="mt-1 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-spectral italic text-zinc-900 line-clamp-3 border border-black/10 transition-colors"
                      >
                        &ldquo;{trechoSelecionado}&rdquo;
                      </blockquote>
                    </div>

                    {/* Seletor das 4 cores: Amarelo, Vermelho, Azul, Roxo */}
                    <div className="space-y-1.5">
                      <span className="block text-xs font-semibold text-zinc-700 font-karla">
                        Cor da marcação:
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {(["AMARELO", "VERMELHO", "AZUL", "ROXO"] as CorMarcacao[]).map((cor) => {
                          const cfg = CORES_MARCACAO[cor];
                          const ativa = corSelecionada === cor;
                          return (
                            <button
                              key={cor}
                              type="button"
                              onClick={() => setCorSelecionada(cor)}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold font-karla transition-all cursor-pointer ${
                                ativa
                                  ? `${cfg.badgeClass} ring-2 ring-zinc-900/20 scale-105`
                                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
                              }`}
                            >
                              <span className={`h-3 w-3 rounded-full border ${cfg.dotClass}`} />
                              <span>{cfg.nome}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-zinc-700 font-karla">
                        Comentário:
                      </label>
                      <input
                        ref={inputComentarioRef}
                        type="text"
                        value={textoComentario}
                        onChange={(e) => setTextoComentario(e.target.value)}
                        placeholder="Escreva um comentário relacionado a este trecho..."
                        required
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 font-spectral"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                      <button
                        type="button"
                        onClick={handleCancelarCustomizacao}
                        className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors font-karla cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={salvandoComentario}
                        className="rounded-xl bg-[#133C1B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1a4f24] transition-colors font-karla cursor-pointer disabled:opacity-50"
                      >
                        {salvandoComentario ? "Salvando..." : "Salvar Marcação e Comentário"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Coluna Esquerda: Texto do Artigo */}
              <div
                ref={scrollContainerRef}
                onScroll={() => {
                  if (posicaoPopover) setPosicaoPopover(null);
                }}
                onMouseUp={verificarSelecaoMouse}
                onKeyUp={verificarSelecaoMouse}
                className="flex-1 flex flex-col overflow-y-auto p-6 sm:p-8 bg-white border-b lg:border-b-0 lg:border-r border-zinc-200"
              >
                {artigoAberto.conteudo && textoLimpo.length > 0 ? (
                  <div
                    ref={artigoBodyRef}
                    className="max-w-none font-spectral text-zinc-900 leading-relaxed text-base sm:text-lg prose prose-zinc select-text cursor-text"
                    dangerouslySetInnerHTML={{ __html: artigoAberto.conteudo }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center my-auto">
                    <p className="text-sm sm:text-base text-zinc-500 font-spectral">
                      O orientando ainda não escreveu conteúdo neste artigo pelo editor integrado.
                    </p>
                  </div>
                )}
              </div>

              {/* Coluna Direita: Lista de Marcações e Comentários */}
              <div className="w-full lg:w-80 xl:w-96 bg-zinc-50/70 flex flex-col overflow-y-auto p-4 sm:p-5 space-y-4 shrink-0">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
                  <h4 className="text-sm font-bold text-zinc-900 font-karla">
                    Comentários e Marcações
                  </h4>
                  <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 font-karla">
                    {comentariosPendentesAberto.length} pendente(s)
                  </span>
                </div>

                {comentariosPendentesAberto.length === 0 ? (
                  <p className="text-xs text-zinc-500 font-spectral py-4 text-center">
                    Nenhum comentário pendente de resolução. Selecione um trecho do texto à esquerda com o mouse e clique em &ldquo;Comentar&rdquo;.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {comentariosPendentesAberto.map((c) => {
                      const corCfg = CORES_MARCACAO[c.cor] ?? CORES_MARCACAO.AMARELO;
                      return (
                        <div
                          key={c.id}
                          className={`rounded-xl border border-zinc-200 border-l-4 ${corCfg.borderClass} bg-white p-3.5 shadow-2xs space-y-2`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold font-karla ${corCfg.badgeClass}`}>
                              <span className={`h-2 w-2 rounded-full ${corCfg.dotClass}`} />
                              {corCfg.nome}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-spectral">
                              {formatarDataHora(new Date(c.criadoEm))}
                            </span>
                          </div>

                          <blockquote className={`rounded-lg px-2.5 py-1.5 text-xs font-spectral italic line-clamp-3 ${corCfg.quoteBgClass}`}>
                            &ldquo;{c.trecho}&rdquo;
                          </blockquote>

                          <p className="text-xs sm:text-sm text-zinc-800 font-spectral">
                            {c.comentario}
                          </p>

                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-100">
                            <button
                              type="button"
                              onClick={() => handleExcluirComentario(c.id)}
                              disabled={salvandoComentario}
                              className="text-[11px] font-semibold text-zinc-400 hover:text-red-600 font-karla cursor-pointer"
                            >
                              Excluir
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolverComentario(c.id)}
                              disabled={salvandoComentario}
                              className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-[#133C1B] hover:bg-emerald-100 font-karla cursor-pointer"
                            >
                              ✓ Resolver
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {comentariosResolvidosAberto.length > 0 && (
                  <details className="pt-2 border-t border-zinc-200">
                    <summary className="cursor-pointer text-xs font-semibold text-zinc-500 hover:text-zinc-800 font-karla">
                      {comentariosResolvidosAberto.length} comentário(s) resolvido(s)
                    </summary>
                    <div className="mt-2.5 space-y-2">
                      {comentariosResolvidosAberto.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-zinc-200 bg-zinc-100/70 p-3 text-xs text-zinc-500 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-emerald-700 font-karla">✓ Resolvido</span>
                            <button
                              type="button"
                              onClick={() => handleExcluirComentario(c.id)}
                              className="text-[10px] text-zinc-400 hover:text-red-600 font-karla"
                            >
                              Remover
                            </button>
                          </div>
                          <p className="italic line-clamp-1">&ldquo;{c.trecho}&rdquo;</p>
                          <p className="text-zinc-700">{c.comentario}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>

            {/* Rodapé do Visualizador */}
            <div className="flex flex-wrap items-center justify-between border-t border-zinc-200 bg-zinc-50 px-6 py-3 text-xs text-zinc-500 font-karla shrink-0">
              <div className="flex items-center gap-4">
                <span>{contagemPalavras} palavras</span>
                <span>
                  Última atualização: {formatarDataHora(new Date(artigoAberto.atualizadoEm))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">
                  {sincronizando ? "Sincronizando alterações..." : "Sincronizado em tempo real"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

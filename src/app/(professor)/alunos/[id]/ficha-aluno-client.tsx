"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { atualizarStatusManual } from "@/lib/actions/notas";
import { finalizarSessaoMarcacoes } from "@/lib/actions/alertas";
import {
  atualizarStatusProducao,
  obterProducaoTempoRealProfessor,
  adicionarMarcacaoComentarioProfessor,
  resolverComentarioProducao,
  excluirComentarioProducao,
  type CorMarcacao,
  type ComentarioArtigo,
  type PdfHighlightRect,
  type VersaoHistoricoProducao,
} from "@/lib/actions/producao";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { PdfProducaoViewer } from "@/components/pdf-producao-viewer";

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
  versaoAtual?: number;
  pdfNomeArquivo?: string | null;
  pdfTamanhoBytes?: number | null;
  pdfTotalPaginas?: number | null;
  notaVersaoAtual?: string | null;
  historicoVersoesJson?: string | null;
  temPdf?: boolean;
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
    badgeClass:
      "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200/70",
    dotClass: "bg-emerald-500",
  },
  ATENCAO: {
    label: "ALERTA",
    badgeClass:
      "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200/70",
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
  AZUL: {
    nome: "Leve",
    bgHex: "#BFDBFE",
    dotClass: "bg-blue-400 border-blue-600",
    badgeClass: "bg-blue-100 text-blue-900 border-blue-300",
    borderClass: "border-l-blue-400",
    quoteBgClass: "bg-blue-100/80 text-blue-950",
  },
  AMARELO: {
    nome: "Moderado",
    bgHex: "#FEF08A",
    dotClass: "bg-yellow-400 border-yellow-600",
    badgeClass: "bg-yellow-100 text-yellow-900 border-yellow-300",
    borderClass: "border-l-yellow-400",
    quoteBgClass: "bg-yellow-100/80 text-yellow-950",
  },
  VERMELHO: {
    nome: "Grave",
    bgHex: "#FECACA",
    dotClass: "bg-red-400 border-red-600",
    badgeClass: "bg-red-100 text-red-900 border-red-300",
    borderClass: "border-l-red-400",
    quoteBgClass: "bg-red-100/80 text-red-950",
  },
  ROXO: {
    nome: "Alteração Opcional",
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

function parseHistoricoVersoes(
  jsonStr?: string | null
): VersaoHistoricoProducao[] {
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

function SleepyFaceIcon({ className = "h-20 w-20" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="40"
        cy="44"
        r="30"
        fill="#F4F4F5"
        stroke="#A1A1AA"
        strokeWidth="2.5"
      />
      <path
        d="M27 40C29 44 35 44 37 40"
        stroke="#52525B"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M43 40C45 44 51 44 53 40"
        stroke="#52525B"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="40" cy="55" rx="4.5" ry="6" fill="#52525B" />
      <ellipse cx="23" cy="49" rx="3.5" ry="2" fill="#E4E4E7" />
      <ellipse cx="57" cy="49" rx="3.5" ry="2" fill="#E4E4E7" />
      <g fill="#71717A" className="font-karla font-bold">
        <text x="56" y="24" fontSize="15" fontWeight="bold">
          Z
        </text>
        <text x="65" y="16" fontSize="12" fontWeight="bold">
          z
        </text>
        <text x="71" y="9" fontSize="9" fontWeight="bold">
          z
        </text>
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
  const [statusAtual, setStatusAtual] = useState<"OK" | "ATENCAO" | "CRITICO">(
    statusInicial
  );
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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
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
                <span className="font-semibold text-zinc-700 font-karla">
                  Tema:
                </span>{" "}
                {tema}
              </p>
            )}

            {contaPendente && (
              <p className="text-xs text-amber-600 font-karla font-medium pt-0.5">
                Convite enviado — aguardando criação de conta pelo aluno.
              </p>
            )}
          </div>
        </div>

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

          <div className="relative" ref={dropdownRef}>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-karla mb-1 sm:text-right">
              Status (clique para alterar)
            </span>
            <button
              type="button"
              onClick={() => setMenuAberto((prev) => !prev)}
              disabled={isPending}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold font-karla tracking-wide transition-all cursor-pointer shadow-2xs active:scale-95 ${
                config.badgeClass
              } ${isPending ? "opacity-60" : ""}`}
              title="Clique para alterar o status do aluno"
            >
              <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
              <span>{config.label}</span>
              <svg
                className={`h-3.5 w-3.5 transition-transform ${
                  menuAberto ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.25}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
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
                        selecionado
                          ? "bg-zinc-100 text-zinc-900"
                          : "text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${itemCfg.dotClass}`}
                        />
                        {itemCfg.label}
                      </span>
                      {selecionado && (
                        <svg
                          className="h-4 w-4 text-[#133C1B]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
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
  const [producoes, setProducoes] =
    useState<ProducaoFichaItem[]>(producoesIniciais);
  const [artigoAberto, setArtigoAberto] = useState<ProducaoFichaItem | null>(
    null
  );
  const [versaoVisualizada, setVersaoVisualizada] = useState<number | "ATUAL">(
    "ATUAL"
  );
  const [abaLateral, setAbaLateral] = useState<"MARCACOES" | "HISTORICO">(
    "MARCACOES"
  );
  const [comentarioFocadoId, setComentarioFocadoId] = useState<string | null>(
    null
  );
  const [sincronizando, setSincronizando] = useState(false);
  const [isPendingStatus, startStatusTransition] = useTransition();
  const [salvandoComentario, startComentarioTransition] = useTransition();

  // Contador de marcações feitas DURANTE A SESSÃO ATUAL do orientador neste artigo
  const sessaoMarcacoesRef = useRef<{ producaoId: string; contador: number }>({
    producaoId: "",
    contador: 0,
  });

  useEffect(() => {
    setProducoes(producoesIniciais);
  }, [producoesIniciais]);

  // Atualização em tempo real enquanto o modal de leitura do artigo estiver aberto
  useEffect(() => {
    if (!artigoAberto) return;

    const atualizarTempoReal = async () => {
      try {
        setSincronizando(true);
        const atualizado = await obterProducaoTempoRealProfessor(
          artigoAberto.id
        );
        setArtigoAberto((prev) =>
          prev
            ? {
                ...prev,
                status: atualizado.status as ProducaoFichaItem["status"],
                comentariosJson: atualizado.comentariosJson,
                versaoAtual: atualizado.versaoAtual,
                pdfNomeArquivo: atualizado.pdfNomeArquivo,
                pdfTamanhoBytes: atualizado.pdfTamanhoBytes,
                pdfTotalPaginas: atualizado.pdfTotalPaginas,
                notaVersaoAtual: atualizado.notaVersaoAtual,
                historicoVersoesJson: atualizado.historicoVersoesJson,
                atualizadoEm: atualizado.atualizadoEm,
              }
            : null
        );
        setProducoes((prev) =>
          prev.map((p) =>
            p.id === atualizado.id
              ? {
                  ...p,
                  status: atualizado.status as ProducaoFichaItem["status"],
                  comentariosJson: atualizado.comentariosJson,
                  versaoAtual: atualizado.versaoAtual,
                  pdfNomeArquivo: atualizado.pdfNomeArquivo,
                  pdfTamanhoBytes: atualizado.pdfTamanhoBytes,
                  pdfTotalPaginas: atualizado.pdfTotalPaginas,
                  notaVersaoAtual: atualizado.notaVersaoAtual,
                  historicoVersoesJson: atualizado.historicoVersoesJson,
                  atualizadoEm: atualizado.atualizadoEm,
                }
              : p
          )
        );
      } catch {
        // Silencioso no polling
      } finally {
        setSincronizando(false);
      }
    };

    const interval = setInterval(atualizarTempoReal, 6000);
    return () => clearInterval(interval);
  }, [artigoAberto?.id]);

  // Finaliza a sessão quando o componente desmontar se houver marcações pendentes de notificação
  useEffect(() => {
    return () => {
      if (
        sessaoMarcacoesRef.current.contador > 0 &&
        sessaoMarcacoesRef.current.producaoId
      ) {
        finalizarSessaoMarcacoes(
          sessaoMarcacoesRef.current.producaoId,
          sessaoMarcacoesRef.current.contador
        ).catch(console.error);
        sessaoMarcacoesRef.current = { producaoId: "", contador: 0 };
      }
    };
  }, []);

  function fecharVisualizadorArtigo() {
    if (
      sessaoMarcacoesRef.current.contador > 0 &&
      sessaoMarcacoesRef.current.producaoId
    ) {
      finalizarSessaoMarcacoes(
        sessaoMarcacoesRef.current.producaoId,
        sessaoMarcacoesRef.current.contador
      ).catch(console.error);
      sessaoMarcacoesRef.current = { producaoId: "", contador: 0 };
    }
    setArtigoAberto(null);
    setVersaoVisualizada("ATUAL");
    setAbaLateral("MARCACOES");
    setComentarioFocadoId(null);
  }

  function handleMudarStatusProducao(
    producaoId: string,
    novoStatus: (typeof OPCOES_STATUS_PRODUCAO)[number]
  ) {
    setProducoes((prev) =>
      prev.map((p) => (p.id === producaoId ? { ...p, status: novoStatus } : p))
    );
    if (artigoAberto?.id === producaoId) {
      setArtigoAberto((prev) =>
        prev ? { ...prev, status: novoStatus } : null
      );
    }
    startStatusTransition(async () => {
      await atualizarStatusProducao(producaoId, novoStatus);
    });
  }

  async function handleCriarMarcacaoNoPdf(dados: {
    trecho: string;
    comentario: string;
    cor: CorMarcacao;
    pagina: number;
    rects: PdfHighlightRect[];
  }) {
    if (!artigoAberto) return;
    const markId = `mark_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    sessaoMarcacoesRef.current.contador += 1;

    await new Promise<void>((resolve) => {
      startComentarioTransition(async () => {
        try {
          const res = await adicionarMarcacaoComentarioProfessor(
            artigoAberto.id,
            {
              id: markId,
              trecho: dados.trecho,
              comentario: dados.comentario,
              cor: dados.cor,
              pagina: dados.pagina,
              rects: dados.rects,
            }
          );

          const novoJson = JSON.stringify(res.comentarios);
          setArtigoAberto((prev) =>
            prev ? { ...prev, comentariosJson: novoJson } : null
          );
          setProducoes((prev) =>
            prev.map((p) =>
              p.id === artigoAberto.id
                ? { ...p, comentariosJson: novoJson }
                : p
            )
          );
          setComentarioFocadoId(markId);
          setAbaLateral("MARCACOES");
        } finally {
          resolve();
        }
      });
    });
  }

  function handleResolverComentario(comentarioId: string) {
    if (!artigoAberto || versaoVisualizada !== "ATUAL") return;
    startComentarioTransition(async () => {
      const res = await resolverComentarioProducao(
        artigoAberto.id,
        comentarioId
      );
      const novoJson = JSON.stringify(res.comentarios);
      setArtigoAberto((prev) =>
        prev ? { ...prev, comentariosJson: novoJson } : null
      );
      setProducoes((prev) =>
        prev.map((p) =>
          p.id === artigoAberto.id ? { ...p, comentariosJson: novoJson } : p
        )
      );
    });
  }

  function handleExcluirComentario(comentarioId: string) {
    if (!artigoAberto || versaoVisualizada !== "ATUAL") return;
    startComentarioTransition(async () => {
      const res = await excluirComentarioProducao(
        artigoAberto.id,
        comentarioId
      );
      const novoJson = JSON.stringify(res.comentarios);
      setArtigoAberto((prev) =>
        prev ? { ...prev, comentariosJson: novoJson } : null
      );
      setProducoes((prev) =>
        prev.map((p) =>
          p.id === artigoAberto.id ? { ...p, comentariosJson: novoJson } : p
        )
      );
    });
  }

  const versaoAtualAberto = artigoAberto?.versaoAtual || 1;
  const comentariosAtuaisAberto = parseComentarios(
    artigoAberto?.comentariosJson
  );
  const historicoVersoesAberto = parseHistoricoVersoes(
    artigoAberto?.historicoVersoesJson
  );

  const dadosVersaoHistorica =
    versaoVisualizada === "ATUAL"
      ? null
      : historicoVersoesAberto.find(
          (v) => v.versaoNumero === versaoVisualizada
        ) || null;

  const comentariosExibidos: ComentarioArtigo[] =
    versaoVisualizada === "ATUAL"
      ? comentariosAtuaisAberto
      : dadosVersaoHistorica?.comentarios || [];

  const comentariosPendentesAberto = comentariosExibidos.filter(
    (c) => !c.resolvido
  );
  const comentariosResolvidosAberto = comentariosExibidos.filter(
    (c) => c.resolvido
  );

  const pdfUrlExibido = artigoAberto
    ? versaoVisualizada === "ATUAL"
      ? `/api/producoes/${artigoAberto.id}/pdf?versao=atual&v=${versaoAtualAberto}`
      : `/api/producoes/${artigoAberto.id}/pdf?versao=${versaoVisualizada}`
    : "";

  const labelVersaoExibida =
    versaoVisualizada === "ATUAL"
      ? `Versão ${versaoAtualAberto} (Atual)${
          artigoAberto?.pdfNomeArquivo
            ? ` · ${artigoAberto.pdfNomeArquivo}`
            : ""
        }`
      : `Versão ${versaoVisualizada} (Histórico)${
          dadosVersaoHistorica?.nomeArquivo
            ? ` · ${dadosVersaoHistorica.nomeArquivo}`
            : ""
        }`;

  return (
    <section className="w-full rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 font-karla">
            Produções Acadêmicas (PDF)
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 font-spectral">
            Visualize os arquivos PDF enviados pelo orientando, destaque trechos ou figuras diretamente no documento e consulte o histórico de versões.
          </p>
        </div>
        <span className="inline-flex items-center self-start sm:self-auto rounded-full bg-[#133C1B]/10 px-3 py-1 text-xs font-bold text-[#133C1B] font-karla">
          {`${producoes.length} ${
            producoes.length === 1 ? "trabalho" : "trabalhos"
          }`}
        </span>
      </div>

      {producoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <SleepyFaceIcon className="h-20 w-20 drop-shadow-xs" />
          <p className="mt-3 text-sm font-medium text-zinc-500 font-spectral">
            O orientando ainda não enviou nenhuma produção acadêmica em PDF.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 text-left">
          {producoes.map((p) => {
            const listaComentarios = parseComentarios(p.comentariosJson);
            const pendentes = listaComentarios.filter(
              (c) => !c.resolvido
            ).length;
            const historico = parseHistoricoVersoes(p.historicoVersoesJson);
            const versaoNum = p.versaoAtual || 1;

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
                          e.target
                            .value as (typeof OPCOES_STATUS_PRODUCAO)[number]
                        )
                      }
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold font-karla cursor-pointer focus:outline-none ${getStatusProducaoStyle(
                        p.status
                      )}`}
                      title="Alterar status da produção"
                    >
                      {OPCOES_STATUS_PRODUCAO.map((s) => (
                        <option
                          key={s}
                          value={s}
                          className="bg-white text-zinc-800"
                        >
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

                  {/* Badges de versão PDF, histórico e comentários pendentes */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#133C1B]/10 px-2.5 py-0.5 text-xs font-bold text-[#133C1B] border border-[#133C1B]/20 font-karla">
                      Versão {versaoNum} · PDF
                    </span>

                    {historico.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 border border-zinc-200/90 font-karla">
                        {historico.length}{" "}
                        {historico.length === 1
                          ? "versão no histórico"
                          : "versões no histórico"}
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold font-karla border ${
                        pendentes > 0
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : "bg-zinc-100 text-zinc-600 border-zinc-200/80"
                      }`}
                    >
                      <svg
                        className="h-3.5 w-3.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                        />
                      </svg>
                      {`${pendentes} ${
                        pendentes === 1
                          ? "marcação pendente"
                          : "marcações pendentes"
                      }`}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500 font-karla">
                    <span className="truncate font-medium text-zinc-700">
                      {p.pdfNomeArquivo || `${p.titulo}.pdf`}
                    </span>
                    {p.pdfTotalPaginas ? (
                      <span>· {p.pdfTotalPaginas} pág(s)</span>
                    ) : null}
                  </div>
                </div>

                <div className="border-t border-zinc-200/60 pt-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-zinc-500 font-spectral">
                    {p.prazoSubmissao ? (
                      <div className="flex items-center gap-1 text-amber-700 font-medium">
                        <svg
                          className="h-4 w-4 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.75}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>
                          Prazo: {formatarData(new Date(p.prazoSubmissao))}
                        </span>
                      </div>
                    ) : (
                      <span>Sem prazo definido</span>
                    )}
                    <span>Criado em {formatarData(new Date(p.criadoEm))}</span>
                  </div>

                  {/* Botões de Ação do Card */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-zinc-100">
                    <a
                      href={`/api/producoes/${p.id}/pdf?download=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors font-karla"
                    >
                      <span>Baixar PDF</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          sessaoMarcacoesRef.current.contador > 0 &&
                          sessaoMarcacoesRef.current.producaoId
                        ) {
                          finalizarSessaoMarcacoes(
                            sessaoMarcacoesRef.current.producaoId,
                            sessaoMarcacoesRef.current.contador
                          ).catch(console.error);
                        }
                        sessaoMarcacoesRef.current = {
                          producaoId: p.id,
                          contador: 0,
                        };
                        setVersaoVisualizada("ATUAL");
                        setAbaLateral("MARCACOES");
                        setComentarioFocadoId(null);
                        setArtigoAberto(p);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#133C1B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1a4f24] active:scale-95 transition-all font-karla cursor-pointer"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                      <span>Revisar PDF e Comentar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Revisão de PDF + Marcação de Trechos/Figuras + Histórico de Versões */}
      {artigoAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/55 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              fecharVisualizadorArtigo();
            }
          }}
        >
          <div className="relative flex flex-col w-full max-w-7xl h-[93vh] rounded-2xl bg-white shadow-2xl border border-zinc-200 overflow-hidden text-left">
            {/* Cabeçalho do Visualizador */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-3.5 shrink-0">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-zinc-900 font-karla truncate">
                    {artigoAberto.titulo}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold font-karla ${getStatusProducaoStyle(
                      artigoAberto.status
                    )}`}
                  >
                    {ROTULOS_STATUS_PRODUCAO[artigoAberto.status]}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#133C1B]/10 px-2.5 py-0.5 text-xs font-bold text-[#133C1B] font-karla">
                    Versão {versaoAtualAberto} (Atual)
                  </span>
                </div>

                {/* Seletor rápido de versões no cabeçalho quando há histórico */}
                {historicoVersoesAberto.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="font-karla text-[11px] font-bold uppercase tracking-wider text-zinc-500 mr-1">
                      Versão:
                    </span>
                    <button
                      type="button"
                      onClick={() => setVersaoVisualizada("ATUAL")}
                      className={`px-2.5 py-0.5 rounded-md font-karla text-xs font-bold transition-colors cursor-pointer ${
                        versaoVisualizada === "ATUAL"
                          ? "bg-[#133C1B] text-white"
                          : "bg-zinc-200/70 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      v{versaoAtualAberto} (Atual ·{" "}
                      {comentariosAtuaisAberto.length})
                    </button>
                    {historicoVersoesAberto.map((hv) => (
                      <button
                        key={hv.id}
                        type="button"
                        onClick={() => setVersaoVisualizada(hv.versaoNumero)}
                        className={`px-2.5 py-0.5 rounded-md font-karla text-xs font-bold transition-colors cursor-pointer ${
                          versaoVisualizada === hv.versaoNumero
                            ? "bg-amber-700 text-white"
                            : "bg-zinc-200/70 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        v{hv.versaoNumero} (Histórico ·{" "}
                        {hv.comentarios?.length || 0})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setAbaLateral((prev) =>
                      prev === "HISTORICO" ? "MARCACOES" : "HISTORICO"
                    )
                  }
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold font-karla transition-colors cursor-pointer ${
                    abaLateral === "HISTORICO"
                      ? "border-[#133C1B] bg-[#133C1B]/10 text-[#133C1B]"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  Histórico de Versões ({historicoVersoesAberto.length + 1})
                </button>

                <button
                  type="button"
                  onClick={fecharVisualizadorArtigo}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700 transition-colors cursor-pointer"
                  aria-label="Fechar visualizador"
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Conteúdo dividido: Visualizador PDF à esquerda + Painel de Marcações/Histórico à direita */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              <div className="flex-1 h-full overflow-hidden p-3 bg-zinc-100">
                <PdfProducaoViewer
                  pdfUrl={pdfUrlExibido}
                  comentarios={comentariosExibidos}
                  permitirMarcacao={versaoVisualizada === "ATUAL"}
                  comentarioFocadoId={comentarioFocadoId}
                  onSelecionarComentario={(id) => {
                    setComentarioFocadoId(id);
                    setAbaLateral("MARCACOES");
                  }}
                  onCriarMarcacao={handleCriarMarcacaoNoPdf}
                  salvandoMarcacao={salvandoComentario}
                  versaoLabel={labelVersaoExibida}
                  somenteLeituraHistorico={versaoVisualizada !== "ATUAL"}
                />
              </div>

              {/* Coluna Direita: Abas de Marcações e Histórico de Versões */}
              <div className="w-full lg:w-88 xl:w-96 bg-zinc-50/70 border-l border-zinc-200 flex flex-col overflow-hidden shrink-0">
                <div className="grid grid-cols-2 border-b border-zinc-200 bg-white shrink-0">
                  <button
                    type="button"
                    onClick={() => setAbaLateral("MARCACOES")}
                    className={`py-3 px-3 font-karla text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                      abaLateral === "MARCACOES"
                        ? "border-[#133C1B] text-[#133C1B]"
                        : "border-transparent text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    Marcações ({comentariosExibidos.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbaLateral("HISTORICO")}
                    className={`py-3 px-3 font-karla text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                      abaLateral === "HISTORICO"
                        ? "border-[#133C1B] text-[#133C1B]"
                        : "border-transparent text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    Histórico ({historicoVersoesAberto.length + 1})
                  </button>
                </div>

                {abaLateral === "MARCACOES" ? (
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {versaoVisualizada !== "ATUAL" && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 font-spectral">
                        Visualizando marcações preservadas da{" "}
                        <strong className="font-karla">
                          Versão {versaoVisualizada}
                        </strong>{" "}
                        do histórico.
                      </div>
                    )}

                    {comentariosPendentesAberto.length === 0 ? (
                      <p className="text-xs text-zinc-500 font-spectral py-8 text-center px-3">
                        {versaoVisualizada === "ATUAL"
                          ? "Nenhuma marcação pendente nesta versão. Selecione um trecho de texto ou marque uma área no PDF à esquerda e clique em “Comentar”."
                          : "Nenhuma marcação pendente registrada nesta versão arquivada."}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {comentariosPendentesAberto.map((c) => {
                          const corCfg =
                            CORES_MARCACAO[c.cor] ?? CORES_MARCACAO.AMARELO;
                          const focado = comentarioFocadoId === c.id;
                          return (
                            <div
                              key={c.id}
                              onClick={() => setComentarioFocadoId(c.id)}
                              className={`rounded-xl border border-zinc-200 border-l-4 ${
                                corCfg.borderClass
                              } bg-white p-3.5 shadow-2xs space-y-2 cursor-pointer transition-all ${
                                focado ? "ring-2 ring-[#133C1B]" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold font-karla ${corCfg.badgeClass}`}
                                  >
                                    <span
                                      className={`h-2 w-2 rounded-full ${corCfg.dotClass}`}
                                    />
                                    {corCfg.nome}
                                  </span>
                                  <span className="rounded-full bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[10px] font-bold font-karla text-zinc-700">
                                    Pág. {c.pagina || 1}
                                  </span>
                                </div>
                                <span className="text-[10px] text-zinc-400 font-spectral">
                                  {formatarDataHora(new Date(c.criadoEm))}
                                </span>
                              </div>

                              <blockquote
                                className={`rounded-lg px-2.5 py-1.5 text-xs font-spectral italic line-clamp-3 ${corCfg.quoteBgClass}`}
                              >
                                &ldquo;{c.trecho}&rdquo;
                              </blockquote>

                              <p className="text-xs sm:text-sm text-zinc-800 font-spectral">
                                {c.comentario}
                              </p>

                              {versaoVisualizada === "ATUAL" && (
                                <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-100">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExcluirComentario(c.id);
                                    }}
                                    disabled={salvandoComentario}
                                    className="text-[11px] font-semibold text-zinc-400 hover:text-red-600 font-karla cursor-pointer"
                                  >
                                    Excluir
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleResolverComentario(c.id);
                                    }}
                                    disabled={salvandoComentario}
                                    className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-[#133C1B] hover:bg-emerald-100 font-karla cursor-pointer"
                                  >
                                    ✓ Resolver
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {comentariosResolvidosAberto.length > 0 && (
                      <details className="pt-2 border-t border-zinc-200">
                        <summary className="cursor-pointer text-xs font-semibold text-zinc-500 hover:text-zinc-800 font-karla">
                          {comentariosResolvidosAberto.length} marcação(ões)
                          resolvida(s)
                        </summary>
                        <div className="mt-2.5 space-y-2">
                          {comentariosResolvidosAberto.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => setComentarioFocadoId(c.id)}
                              className="rounded-xl border border-zinc-200 bg-zinc-100/70 p-3 text-xs text-zinc-500 space-y-1 cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-emerald-700 font-karla">
                                  ✓ Resolvido · Pág. {c.pagina || 1}
                                </span>
                                {versaoVisualizada === "ATUAL" && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExcluirComentario(c.id);
                                    }}
                                    className="text-[10px] text-zinc-400 hover:text-red-600 font-karla"
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                              <p className="italic line-clamp-1">
                                &ldquo;{c.trecho}&rdquo;
                              </p>
                              <p className="text-zinc-700">{c.comentario}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ) : (
                  /* Aba de Histórico de Versões do PDF */
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div
                      onClick={() => setVersaoVisualizada("ATUAL")}
                      className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
                        versaoVisualizada === "ATUAL"
                          ? "border-[#133C1B] bg-[#133C1B]/[0.05] ring-1 ring-[#133C1B]"
                          : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-karla font-bold text-xs text-[#133C1B]">
                          Versão {versaoAtualAberto} (Atual)
                        </span>
                        <span className="rounded-full bg-[#133C1B]/10 px-2 py-0.5 font-karla text-[10px] font-bold text-[#133C1B]">
                          {comentariosAtuaisAberto.length} marcação(ões)
                        </span>
                      </div>
                      <p className="font-karla text-xs text-zinc-800 truncate">
                        {artigoAberto.pdfNomeArquivo ||
                          `${artigoAberto.titulo}.pdf`}
                      </p>
                      {artigoAberto.notaVersaoAtual && (
                        <p className="font-spectral italic text-xs text-zinc-600 mt-1">
                          &ldquo;{artigoAberto.notaVersaoAtual}&rdquo;
                        </p>
                      )}
                    </div>

                    {historicoVersoesAberto.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center">
                        <p className="font-karla text-xs font-bold text-zinc-600">
                          Sem versões anteriores
                        </p>
                        <p className="font-spectral text-xs text-zinc-500 mt-1">
                          Quando o orientando enviar um novo PDF atualizado, a versão anterior e suas marcações ficarão arquivadas aqui.
                        </p>
                      </div>
                    ) : (
                      historicoVersoesAberto.map((hv) => {
                        const ativa = versaoVisualizada === hv.versaoNumero;
                        return (
                          <div
                            key={hv.id}
                            onClick={() =>
                              setVersaoVisualizada(hv.versaoNumero)
                            }
                            className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
                              ativa
                                ? "border-amber-600 bg-amber-50/50 ring-1 ring-amber-600"
                                : "border-zinc-200 bg-white hover:border-zinc-300"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-karla font-bold text-xs text-zinc-900">
                                Versão {hv.versaoNumero} (Arquivada)
                              </span>
                              <span className="rounded-full bg-zinc-100 border border-zinc-200 px-2 py-0.5 font-karla text-[10px] font-bold text-zinc-700">
                                {hv.comentarios?.length || 0} marcação(ões)
                              </span>
                            </div>
                            <p className="font-karla text-xs text-zinc-700 truncate">
                              {hv.nomeArquivo}
                            </p>
                            {hv.nota && (
                              <p className="font-spectral italic text-xs text-zinc-600 mt-1">
                                &ldquo;{hv.nota}&rdquo;
                              </p>
                            )}
                            <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500 font-karla">
                              <span>
                                Arquivada em{" "}
                                {formatarDataHora(new Date(hv.arquivadoEm))}
                              </span>
                              <span className="font-bold text-[#133C1B]">
                                Abrir versão →
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé do Visualizador */}
            <div className="flex flex-wrap items-center justify-between border-t border-zinc-200 bg-zinc-50 px-5 py-2.5 text-xs text-zinc-500 font-karla shrink-0">
              <div className="flex items-center gap-4">
                <span>
                  Última atualização:{" "}
                  {formatarDataHora(new Date(artigoAberto.atualizadoEm))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">
                  {sincronizando
                    ? "Sincronizando alterações..."
                    : "Sincronizado em tempo real"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

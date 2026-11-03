"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { formatarData } from "@/lib/datas";
import { criarProducaoAcademica } from "@/lib/actions/producao";

export interface ProducaoItem {
  id: string;
  titulo: string;
  venue: string | null;
  status: "EM_ESCRITA" | "SUBMETIDO" | "EM_REVISAO" | "ACEITO" | "PUBLICADO";
  prazoSubmissao: Date | null;
  comentariosJson?: string | null;
  versaoAtual?: number;
  pdfNomeArquivo?: string | null;
  pdfTamanhoBytes?: number | null;
  pdfTotalPaginas?: number | null;
  notaVersaoAtual?: string | null;
  historicoVersoesJson?: string | null;
  temPdf?: boolean;
  criadoEm: Date;
}

const ROTULOS_STATUS: Record<string, string> = {
  EM_ESCRITA: "Em escrita",
  SUBMETIDO: "Submetido",
  EM_REVISAO: "Em revisão",
  ACEITO: "Aceito",
  PUBLICADO: "Publicado",
};

function contarComentariosPendentes(jsonStr?: string | null): number {
  if (!jsonStr) return 0;
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return 0;
    return parsed.filter((c: { resolvido?: boolean }) => !c.resolvido).length;
  } catch {
    return 0;
  }
}

function contarVersoesHistorico(jsonStr?: string | null): number {
  if (!jsonStr) return 0;
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function formatarTamanhoArquivo(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getStatusBadgeStyle(status: string) {
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

function SleepyFaceIcon({ className = "h-24 w-24" }: { className?: string }) {
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

export function ProducaoContent({ producoes }: { producoes: ProducaoItem[] }) {
  const [modalAberto, setModalAberto] = useState(false);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && modalAberto) {
        setModalAberto(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalAberto]);

  useEffect(() => {
    if (modalAberto) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [modalAberto]);

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await criarProducaoAcademica(formData);
        setModalAberto(false);
        setArquivoSelecionado(null);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setErro(err.message);
        } else {
          setErro("Ocorreu um erro ao adicionar o trabalho.");
        }
      }
    });
  }

  return (
    <div className="relative min-h-[calc(100vh-12rem)] flex flex-col pb-24 text-left">
      <div className="mb-6 sm:mb-8 text-left w-full">
        <p className="text-sm sm:text-base text-zinc-600 font-spectral leading-relaxed text-left">
          Envie o arquivo PDF dos seus artigos e manuscritos em desenvolvimento, acompanhe as marcações e comentários do orientador diretamente sobre o PDF e gerencie o histórico de versões.
        </p>
      </div>

      {producoes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20 sm:py-28 text-center my-auto">
          <SleepyFaceIcon className="h-24 w-24 sm:h-28 sm:w-28 drop-shadow-xs transition-transform hover:scale-105 duration-300" />
          <p className="mt-5 text-base sm:text-lg font-medium text-zinc-600 font-spectral">
            Não tem nada aqui, pode ir dormir
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 text-left">
          {producoes.map((p) => {
            const pendentes = contarComentariosPendentes(p.comentariosJson);
            const qtdHistorico = contarVersoesHistorico(p.historicoVersoesJson);
            const versaoNum = p.versaoAtual || 1;
            const tamanhoStr = formatarTamanhoArquivo(p.pdfTamanhoBytes);

            return (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-xs hover:shadow-md transition-shadow space-y-4 text-left"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h2 className="text-base sm:text-lg font-bold text-zinc-900 font-karla leading-snug">
                      {p.titulo}
                    </h2>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold font-karla ${getStatusBadgeStyle(
                        p.status
                      )}`}
                    >
                      {ROTULOS_STATUS[p.status]}
                    </span>
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

                  {/* Badges de versão PDF, histórico e marcações */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[#133C1B]/10 px-2.5 py-0.5 text-xs font-bold text-[#133C1B] border border-[#133C1B]/20 font-karla">
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
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                      Versão {versaoNum} · PDF
                    </span>

                    {qtdHistorico > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 border border-zinc-200/90 font-karla">
                        {qtdHistorico}{" "}
                        {qtdHistorico === 1
                          ? "versão anterior no histórico"
                          : "versões anteriores no histórico"}
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
                      {pendentes}{" "}
                      {pendentes === 1
                        ? "marcação pendente"
                        : "marcações pendentes"}
                    </span>
                  </div>

                  {/* Informações do arquivo PDF atual */}
                  <div className="mt-2.5 flex items-center gap-2 text-xs text-zinc-500 font-karla">
                    <span className="truncate font-medium text-zinc-700">
                      {p.pdfNomeArquivo || `${p.titulo}.pdf`}
                    </span>
                    {p.pdfTotalPaginas ? (
                      <span>
                        · {p.pdfTotalPaginas}{" "}
                        {p.pdfTotalPaginas === 1 ? "pág." : "págs."}
                      </span>
                    ) : null}
                    {tamanhoStr ? <span>· {tamanhoStr}</span> : null}
                  </div>
                </div>

                <div className="border-t border-zinc-100 pt-3 flex flex-col gap-3">
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

                  {/* Botões de Ação */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-zinc-50">
                    <a
                      href={`/api/producoes/${p.id}/pdf?download=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors font-karla"
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
                          d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      <span>Baixar PDF</span>
                    </a>

                    <Link
                      href={`/producao/${p.id}`}
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
                      <span>Ver PDF e Marcações</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botão fixo no canto inferior direito */}
      <button
        type="button"
        onClick={() => {
          setErro(null);
          setArquivoSelecionado(null);
          setModalAberto(true);
        }}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 flex items-center gap-2 rounded-full bg-[#133C1B] px-5 py-3.5 text-sm sm:text-base font-semibold text-white shadow-xl hover:bg-[#1a4f24] hover:shadow-2xl active:scale-95 transition-all font-karla tracking-wide cursor-pointer focus:outline-none focus:ring-4 focus:ring-[#133C1B]/30"
        aria-label="Adicionar Trabalho"
      >
        <svg
          className="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
        <span>Adicionar Trabalho</span>
      </button>

      {/* Modal para Adicionar Trabalho via upload de PDF */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalAberto(false);
            }
          }}
        >
          <div
            ref={modalRef}
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-5 text-left max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 font-karla">
                  Adicionar Trabalho (PDF)
                </h2>
                <p className="text-xs text-zinc-500 font-spectral">
                  Envie o PDF da primeira versão do seu artigo ou manuscrito para revisão do orientador.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
                aria-label="Fechar"
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

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {erro && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 font-karla">
                  {erro}
                </p>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 font-karla">
                  Título do trabalho *
                </label>
                <input
                  name="titulo"
                  placeholder="Ex: Análise comparativa de algoritmos de roteamento"
                  required
                  disabled={isPending}
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all font-spectral disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 font-karla">
                  Venue (Revista / Evento)
                </label>
                <input
                  name="venue"
                  placeholder="Ex: Simpósio Brasileiro de Redes de Computadores (SBRC)"
                  disabled={isPending}
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all font-spectral disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 font-karla">
                  Prazo de submissão
                </label>
                <input
                  name="prazoSubmissao"
                  type="date"
                  disabled={isPending}
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all font-spectral disabled:opacity-50"
                />
              </div>

              {/* Upload obrigatório do PDF */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 font-karla">
                  Arquivo PDF do Trabalho (Versão 1) *
                </label>
                <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#133C1B]/35 bg-[#133C1B]/[0.03] hover:bg-[#133C1B]/[0.06] p-5 text-center transition-colors cursor-pointer">
                  <svg
                    className="h-8 w-8 text-[#133C1B] mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                  <span className="font-karla text-sm font-bold text-[#133C1B]">
                    {arquivoSelecionado
                      ? arquivoSelecionado.name
                      : "Clique para selecionar o arquivo .PDF"}
                  </span>
                  <span className="font-spectral text-xs text-zinc-500 mt-1">
                    {arquivoSelecionado
                      ? `${formatarTamanhoArquivo(arquivoSelecionado.size)} · Pronto para envio`
                      : "Apenas arquivos em formato PDF (máx. 20 MB)"}
                  </span>
                  <input
                    type="file"
                    name="arquivoPdf"
                    accept=".pdf,application/pdf"
                    required
                    disabled={isPending}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setArquivoSelecionado(f);
                    }}
                    className="sr-only"
                  />
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 font-karla">
                  Nota desta versão (opcional)
                </label>
                <input
                  name="notaVersao"
                  placeholder="Ex: Rascunho inicial com introdução e referencial teórico"
                  disabled={isPending}
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2 text-sm focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all font-spectral disabled:opacity-50"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  disabled={isPending}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer font-karla disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-[#133C1B] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1a4f24] active:scale-[0.99] transition-all font-karla cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      <span>Enviando PDF...</span>
                    </>
                  ) : (
                    <span>Adicionar Produção</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

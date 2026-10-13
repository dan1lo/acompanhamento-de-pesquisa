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
  googleDocsUrl?: string | null;
  conteudo?: string | null;
  criadoEm: Date;
}

const ROTULOS_STATUS: Record<string, string> = {
  EM_ESCRITA: "Em escrita",
  SUBMETIDO: "Submetido",
  EM_REVISAO: "Em revisão",
  ACEITO: "Aceito",
  PUBLICADO: "Publicado",
};

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

export function ProducaoContent({ producoes }: { producoes: ProducaoItem[] }) {
  const [modalAberto, setModalAberto] = useState(false);
  const [vincularDocs, setVincularDocs] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const modalRef = useRef<HTMLDivElement>(null);

  // Fechar com a tecla ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && modalAberto) {
        setModalAberto(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalAberto]);

  // Bloquear rolagem do body quando modal estiver aberto
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
        setVincularDocs(false);
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
      {/* Descrição da página alinhada à esquerda logo abaixo da topbar */}
      <div className="mb-6 sm:mb-8 text-left w-full">
        <p className="text-sm sm:text-base text-zinc-600 font-spectral leading-relaxed text-left">
          Organize, acompanhe e desenvolva seus trabalhos em produção com o(s) seu(s) orientador(es) aqui.
        </p>
      </div>

      {/* Conteúdo principal: estado vazio ou lista de produções */}
      {producoes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20 sm:py-28 text-center my-auto">
          <SleepyFaceIcon className="h-24 w-24 sm:h-28 sm:w-28 drop-shadow-xs transition-transform hover:scale-105 duration-300" />
          <p className="mt-5 text-base sm:text-lg font-medium text-zinc-600 font-spectral">
            Não tem nada aqui, pode ir dormir
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 text-left">
          {producoes.map((p) => (
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

                {/* Badges de vinculação */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {p.googleDocsUrl ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200/80">
                      <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM13 3.5L18.5 9H13V3.5zM16 17H8v-2h8v2zm0-4H8v-2h8v2z" />
                      </svg>
                      Google Docs Vinculado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 border border-zinc-200/80">
                      <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                      </svg>
                      Editor Scholab
                    </span>
                  )}
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
                      <span>Prazo: {formatarData(new Date(p.prazoSubmissao))}</span>
                    </div>
                  ) : (
                    <span>Sem prazo definido</span>
                  )}
                  <span>Criado em {formatarData(new Date(p.criadoEm))}</span>
                </div>

                {/* Botões de Ação */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-50">
                  {p.googleDocsUrl && (
                    <a
                      href={p.googleDocsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors font-karla"
                      title="Abrir arquivo original no Google Docs"
                    >
                      <svg className="h-3.5 w-3.5 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM13 3.5L18.5 9H13V3.5zM16 17H8v-2h8v2zm0-4H8v-2h8v2z" />
                      </svg>
                      <span>Abrir Docs</span>
                      <svg className="h-3 w-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}

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
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                      />
                    </svg>
                    <span>Editar Artigo</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botão verde escuro sempre presente no canto inferior direito */}
      <button
        type="button"
        onClick={() => {
          setErro(null);
          setVincularDocs(false);
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        <span>Adicionar Trabalho</span>
      </button>

      {/* Modal para Adicionar Trabalho */}
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
              <h2 className="text-lg font-bold text-zinc-900 font-karla">
                Adicionar Trabalho
              </h2>
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {erro && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
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

              {/* Opção Vincular com Google Docs */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 space-y-3 transition-colors">
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 shrink-0">
                      <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM13 3.5L18.5 9H13V3.5zM16 17H8v-2h8v2zm0-4H8v-2h8v2z" />
                      </svg>
                    </div>
                    <div>
                      <span className="block text-sm font-semibold text-zinc-900 font-karla">
                        Vincular com Google Docs
                      </span>
                      <span className="block text-xs text-zinc-500 font-spectral">
                        Sincronize com um documento já existente
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    name="vincularGoogleDocs"
                    value="true"
                    checked={vincularDocs}
                    onChange={(e) => setVincularDocs(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-zinc-300 text-[#133C1B] focus:ring-[#133C1B] cursor-pointer"
                    disabled={isPending}
                  />
                </label>

                {vincularDocs ? (
                  <div className="pt-2 border-t border-zinc-200/80 space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 font-karla">
                      URL do Documento *
                    </label>
                    <input
                      name="googleDocsUrl"
                      type="url"
                      required={vincularDocs}
                      placeholder="https://docs.google.com/document/d/.../edit"
                      disabled={isPending}
                      className="w-full rounded-xl border border-zinc-300 px-3.5 py-2 text-sm focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all font-spectral disabled:opacity-50"
                    />
                    <p className="text-[11px] text-zinc-500 font-spectral leading-relaxed">
                      💡 O documento deve estar configurado para &quot;Qualquer pessoa com o link pode ler/editar&quot; para permitir a sincronização automática.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 font-spectral pt-1">
                    Sem vínculo com o Docs, você poderá escrever e editar seu artigo diretamente no editor integrado da nossa plataforma.
                  </p>
                )}
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
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Adicionando...</span>
                    </>
                  ) : (
                    <span>Adicionar</span>
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

"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  enviarNovaVersaoPdfProducao,
  obterComentariosProducaoAluno,
  resolverComentarioProducao,
  type ComentarioArtigo,
  type CorMarcacao,
  type VersaoHistoricoProducao,
} from "@/lib/actions/producao";
import { PdfProducaoViewer } from "@/components/pdf-producao-viewer";

interface ProducaoDetalhe {
  id: string;
  titulo: string;
  venue: string | null;
  status: string;
  prazoSubmissao?: Date | null;
  comentariosJson?: string | null;
  versaoAtual?: number;
  pdfNomeArquivo?: string | null;
  pdfTamanhoBytes?: number | null;
  pdfTotalPaginas?: number | null;
  notaVersaoAtual?: string | null;
  historicoVersoesJson?: string | null;
  temPdf?: boolean;
  atualizadoEm: Date;
}

const COR_CONFIG: Record<
  CorMarcacao,
  {
    bg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    label: string;
  }
> = {
  AZUL: {
    bg: "bg-blue-50/70",
    border: "border-blue-300",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800",
    label: "Leve",
  },
  AMARELO: {
    bg: "bg-amber-50/80",
    border: "border-amber-300",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-900",
    label: "Moderado",
  },
  VERMELHO: {
    bg: "bg-red-50/70",
    border: "border-red-300",
    badgeBg: "bg-red-100",
    badgeText: "text-red-800",
    label: "Grave",
  },
  ROXO: {
    bg: "bg-purple-50/70",
    border: "border-purple-300",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
    label: "Alteração Opcional",
  },
};

function parseComentariosIniciais(jsonStr?: string | null): ComentarioArtigo[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseHistoricoInicial(
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

function formatarTamanhoArquivo(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function EditorContent({ producao }: { producao: ProducaoDetalhe }) {
  const [versaoAtual, setVersaoAtual] = useState<number>(
    producao.versaoAtual || 1
  );
  const [pdfNomeArquivo, setPdfNomeArquivo] = useState<string | null>(
    producao.pdfNomeArquivo || null
  );
  const [pdfTamanhoBytes, setPdfTamanhoBytes] = useState<number | null>(
    producao.pdfTamanhoBytes || null
  );
  const [pdfTotalPaginas, setPdfTotalPaginas] = useState<number>(
    producao.pdfTotalPaginas || 1
  );
  const [notaVersaoAtual, setNotaVersaoAtual] = useState<string | null>(
    producao.notaVersaoAtual || null
  );

  const [comentariosAtuais, setComentariosAtuais] = useState<ComentarioArtigo[]>(
    () => parseComentariosIniciais(producao.comentariosJson)
  );
  const [historicoVersoes, setHistoricoVersoes] = useState<
    VersaoHistoricoProducao[]
  >(() => parseHistoricoInicial(producao.historicoVersoesJson));

  // Controle de qual versão está sendo visualizada ("ATUAL" ou número de versão histórica)
  const [versaoVisualizada, setVersaoVisualizada] = useState<number | "ATUAL">(
    "ATUAL"
  );
  const [abaLateral, setAbaLateral] = useState<"MARCACOES" | "HISTORICO">(
    "MARCACOES"
  );
  const [comentarioFocadoId, setComentarioFocadoId] = useState<string | null>(
    null
  );
  const [resolvendoId, setResolvendoId] = useState<string | null>(null);

  // Modal de envio de nova versão PDF
  const [modalNovaVersao, setModalNovaVersao] = useState<boolean>(false);
  const [novoArquivoPdf, setNovoArquivoPdf] = useState<File | null>(null);
  const [notaNovaVersao, setNotaNovaVersao] = useState<string>("");
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [isPendingUpload, startUploadTransition] = useTransition();
  const [cacheBuster, setCacheBuster] = useState<number>(1);

  // Polling periódico para buscar novas marcações do orientador em tempo real
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await obterComentariosProducaoAluno(producao.id);
        if (res) {
          setComentariosAtuais(parseComentariosIniciais(res.comentariosJson));
          setVersaoAtual(res.versaoAtual);
          setPdfNomeArquivo(res.pdfNomeArquivo);
          setPdfTamanhoBytes(res.pdfTamanhoBytes);
          setPdfTotalPaginas(res.pdfTotalPaginas);
          setNotaVersaoAtual(res.notaVersaoAtual);
          setHistoricoVersoes(parseHistoricoInicial(res.historicoVersoesJson));
        }
      } catch {
        // Silencioso em background
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [producao.id]);

  // Determina a versão e os comentários exibidos no momento
  const dadosVersaoHistorica =
    versaoVisualizada === "ATUAL"
      ? null
      : historicoVersoes.find((v) => v.versaoNumero === versaoVisualizada) ||
        null;

  const comentariosExibidos: ComentarioArtigo[] =
    versaoVisualizada === "ATUAL"
      ? comentariosAtuais
      : dadosVersaoHistorica?.comentarios || [];

  const comentariosPendentesExibidos = comentariosExibidos.filter(
    (c) => !c.resolvido
  );
  const comentariosResolvidosExibidos = comentariosExibidos.filter(
    (c) => c.resolvido
  );

  const pdfUrlExibido =
    versaoVisualizada === "ATUAL"
      ? `/api/producoes/${producao.id}/pdf?versao=atual&t=${versaoAtual}-${cacheBuster}`
      : `/api/producoes/${producao.id}/pdf?versao=${versaoVisualizada}`;

  const labelVersaoExibida =
    versaoVisualizada === "ATUAL"
      ? `Versão ${versaoAtual} (Atual)${
          pdfNomeArquivo ? ` · ${pdfNomeArquivo}` : ""
        }`
      : `Versão ${versaoVisualizada} (Histórico)${
          dadosVersaoHistorica?.nomeArquivo
            ? ` · ${dadosVersaoHistorica.nomeArquivo}`
            : ""
        }`;

  async function handleResolverComentario(comentarioId: string) {
    if (versaoVisualizada !== "ATUAL") return;
    setResolvendoId(comentarioId);
    try {
      const res = await resolverComentarioProducao(
        producao.id,
        comentarioId
      );
      setComentariosAtuais(res.comentarios);
    } catch (e) {
      console.error(e);
    } finally {
      setResolvendoId(null);
    }
  }

  function handleEnviarNovaVersaoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroUpload(null);
    if (!novoArquivoPdf) {
      setErroUpload("Selecione o novo arquivo PDF atualizado.");
      return;
    }

    startUploadTransition(async () => {
      try {
        const arrayBuf = await novoArquivoPdf.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const arquivoBase64 = window.btoa(binary);

        const res = await enviarNovaVersaoPdfProducao(producao.id, {
          nomeArquivo: novoArquivoPdf.name,
          arquivoBase64,
          notaVersao: notaNovaVersao,
        });
        setVersaoAtual(res.versaoAtual);
        setPdfNomeArquivo(res.pdfNomeArquivo);
        setPdfTamanhoBytes(res.pdfTamanhoBytes);
        setPdfTotalPaginas(res.pdfTotalPaginas);
        setNotaVersaoAtual(res.notaVersaoAtual);
        setComentariosAtuais([]);
        setHistoricoVersoes(parseHistoricoInicial(res.historicoVersoesJson));
        setVersaoVisualizada("ATUAL");
        setCacheBuster((prev) => prev + 1);
        setModalNovaVersao(false);
        setNovoArquivoPdf(null);
        setNotaNovaVersao("");
        setMensagemSucesso(
          `Versão ${res.versaoAtual} enviada com sucesso! A versão anterior e suas marcações foram salvas no histórico.`
        );
        setTimeout(() => setMensagemSucesso(null), 6000);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setErroUpload(err.message);
        } else {
          setErroUpload("Erro ao enviar nova versão do PDF.");
        }
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-8 text-left">
      {/* Cabeçalho da produção */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl border border-zinc-200/90 p-4 sm:p-5 shadow-xs">
        <div className="flex items-start gap-3 min-w-0">
          <Link
            href="/producao"
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
            title="Voltar para Produções"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
          </Link>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-zinc-900 font-karla truncate">
                {producao.titulo}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#133C1B]/10 px-2.5 py-0.5 text-xs font-bold text-[#133C1B] font-karla">
                Versão {versaoAtual} (Atual)
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500 font-spectral">
              {producao.venue && <span>{producao.venue}</span>}
              {pdfNomeArquivo && (
                <span className="font-karla font-medium text-zinc-700">
                  Arquivo: {pdfNomeArquivo}
                  {pdfTamanhoBytes
                    ? ` (${formatarTamanhoArquivo(pdfTamanhoBytes)})`
                    : ""}
                </span>
              )}
              {notaVersaoAtual && (
                <span className="italic text-zinc-600">
                  Nota: &ldquo;{notaVersaoAtual}&rdquo;
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Botões principais: Histórico e Enviar Nova Versão PDF */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAbaLateral("HISTORICO")}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold font-karla transition-colors cursor-pointer ${
              abaLateral === "HISTORICO"
                ? "border-[#133C1B] bg-[#133C1B]/10 text-[#133C1B]"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Histórico de Versões ({historicoVersoes.length + 1})
          </button>

          <button
            type="button"
            onClick={() => {
              setErroUpload(null);
              setNovoArquivoPdf(null);
              setNotaNovaVersao("");
              setModalNovaVersao(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#133C1B] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#1a4f24] transition-all font-karla cursor-pointer"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            Enviar Nova Versão (PDF)
          </button>
        </div>
      </div>

      {/* Feedback de sucesso ao enviar nova versão */}
      {mensagemSucesso && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900 font-karla font-semibold flex items-center justify-between">
          <span>{mensagemSucesso}</span>
          <button
            type="button"
            onClick={() => setMensagemSucesso(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Barra seletora rápida de versão quando há histórico */}
      {historicoVersoes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white border border-zinc-200/90 px-4 py-2.5 shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-karla text-xs font-bold uppercase tracking-wider text-zinc-500 mr-1">
              Versão exibida:
            </span>
            <button
              type="button"
              onClick={() => setVersaoVisualizada("ATUAL")}
              className={`px-3 py-1 rounded-lg font-karla text-xs font-bold transition-colors cursor-pointer ${
                versaoVisualizada === "ATUAL"
                  ? "bg-[#133C1B] text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              Versão {versaoAtual} (Atual · {comentariosAtuais.length}{" "}
              {comentariosAtuais.length === 1 ? "marcação" : "marcações"})
            </button>

            {historicoVersoes.map((hv) => (
              <button
                key={hv.id}
                type="button"
                onClick={() => setVersaoVisualizada(hv.versaoNumero)}
                className={`px-3 py-1 rounded-lg font-karla text-xs font-bold transition-colors cursor-pointer ${
                  versaoVisualizada === hv.versaoNumero
                    ? "bg-amber-700 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Versão {hv.versaoNumero} ({hv.comentarios?.length || 0}{" "}
                {(hv.comentarios?.length || 0) === 1
                  ? "marcação"
                  : "marcações"}
                )
              </button>
            ))}
          </div>

          {versaoVisualizada !== "ATUAL" && (
            <button
              type="button"
              onClick={() => setVersaoVisualizada("ATUAL")}
              className="font-karla text-xs font-bold text-[#133C1B] hover:underline cursor-pointer"
            >
              Voltar para a versão atual →
            </button>
          )}
        </div>
      )}

      {/* Área principal: PDF Viewer à esquerda + Barra lateral de Marcações e Histórico à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 h-[calc(100vh-14.5rem)] min-h-[620px]">
          <PdfProducaoViewer
            pdfUrl={pdfUrlExibido}
            comentarios={comentariosExibidos}
            permitirMarcacao={false}
            comentarioFocadoId={comentarioFocadoId}
            onSelecionarComentario={(id) => {
              setComentarioFocadoId(id);
              setAbaLateral("MARCACOES");
            }}
            versaoLabel={labelVersaoExibida}
            somenteLeituraHistorico={versaoVisualizada !== "ATUAL"}
          />
        </div>

        {/* Painel lateral: Marcações do Orientador e Histórico de Versões */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-zinc-200/90 shadow-xs flex flex-col h-[calc(100vh-14.5rem)] min-h-[620px] overflow-hidden">
          {/* Abas do painel lateral */}
          <div className="grid grid-cols-2 border-b border-zinc-200 bg-zinc-50/70 shrink-0">
            <button
              type="button"
              onClick={() => setAbaLateral("MARCACOES")}
              className={`py-3 px-3 font-karla text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                abaLateral === "MARCACOES"
                  ? "border-[#133C1B] text-[#133C1B] bg-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Marcações no PDF ({comentariosExibidos.length})
            </button>
            <button
              type="button"
              onClick={() => setAbaLateral("HISTORICO")}
              className={`py-3 px-3 font-karla text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                abaLateral === "HISTORICO"
                  ? "border-[#133C1B] text-[#133C1B] bg-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Histórico de Versões ({historicoVersoes.length + 1})
            </button>
          </div>

          {abaLateral === "MARCACOES" ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {versaoVisualizada !== "ATUAL" && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 font-spectral">
                  Você está visualizando as marcações registradas na{" "}
                  <strong className="font-karla">
                    Versão {versaoVisualizada}
                  </strong>{" "}
                  do histórico.
                </div>
              )}

              {comentariosExibidos.length === 0 ? (
                <div className="py-16 text-center px-4">
                  <p className="font-karla font-bold text-sm text-zinc-700 mb-1">
                    Nenhuma marcação nesta versão
                  </p>
                  <p className="font-spectral text-xs text-zinc-500 leading-relaxed">
                    Quando o orientador selecionar trechos do seu PDF e adicionar apontamentos, eles aparecerão destacados no documento e listados aqui.
                  </p>
                </div>
              ) : (
                <>
                  {comentariosPendentesExibidos.map((c) => {
                    const cfg = COR_CONFIG[c.cor] || COR_CONFIG.AMARELO;
                    const focado = comentarioFocadoId === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setComentarioFocadoId(c.id)}
                        className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
                          cfg.bg
                        } ${cfg.border} ${
                          focado ? "ring-2 ring-[#133C1B] shadow-sm" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-karla ${cfg.badgeBg} ${cfg.badgeText}`}
                            >
                              {cfg.label}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-white/80 border border-zinc-200 text-[10px] font-bold font-karla text-zinc-700">
                              Página {c.pagina || 1}
                            </span>
                          </div>

                          {versaoVisualizada === "ATUAL" && (
                            <button
                              type="button"
                              disabled={resolvendoId === c.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResolverComentario(c.id);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#133C1B] hover:bg-[#1a4f24] text-white font-karla text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {resolvendoId === c.id
                                ? "Resolvendo..."
                                : "✓ Resolver"}
                            </button>
                          )}
                        </div>

                        {c.trecho && (
                          <blockquote className="mb-2 pl-2.5 border-l-2 border-zinc-400 font-spectral italic text-xs text-zinc-700 line-clamp-3">
                            &ldquo;{c.trecho}&rdquo;
                          </blockquote>
                        )}

                        <p className="font-spectral text-sm text-zinc-900 leading-snug">
                          {c.comentario}
                        </p>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500 font-karla">
                          <span>{c.autorNome || "Orientador"}</span>
                          <span>
                            {new Date(c.criadoEm).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {comentariosResolvidosExibidos.length > 0 && (
                    <div className="pt-3 border-t border-zinc-200 space-y-2">
                      <p className="font-karla text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Marcações Resolvidas (
                        {comentariosResolvidosExibidos.length})
                      </p>
                      {comentariosResolvidosExibidos.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => setComentarioFocadoId(c.id)}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 opacity-75 hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-karla text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              Resolvido · Pág. {c.pagina || 1}
                            </span>
                          </div>
                          {c.trecho && (
                            <p className="font-spectral italic text-xs text-zinc-500 line-through truncate">
                              &ldquo;{c.trecho}&rdquo;
                            </p>
                          )}
                          <p className="font-spectral text-xs text-zinc-700 mt-1">
                            {c.comentario}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* Aba de Histórico de Versões */
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Card da Versão Atual */}
              <div
                onClick={() => setVersaoVisualizada("ATUAL")}
                className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
                  versaoVisualizada === "ATUAL"
                    ? "border-[#133C1B] bg-[#133C1B]/[0.04] ring-1 ring-[#133C1B]"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 font-karla font-bold text-xs text-[#133C1B]">
                    <span className="h-2 w-2 rounded-full bg-[#133C1B]" />
                    Versão {versaoAtual} (Atual)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#133C1B]/10 text-[#133C1B] font-karla text-[10px] font-bold">
                    {comentariosAtuais.length}{" "}
                    {comentariosAtuais.length === 1 ? "marcação" : "marcações"}
                  </span>
                </div>

                <p className="font-karla text-xs font-medium text-zinc-800 truncate">
                  {pdfNomeArquivo || `${producao.titulo}.pdf`}
                </p>
                {notaVersaoAtual && (
                  <p className="font-spectral italic text-xs text-zinc-600 mt-1">
                    &ldquo;{notaVersaoAtual}&rdquo;
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500 font-karla">
                  <span>{pdfTotalPaginas} pág(s)</span>
                  <span>Versão ativa</span>
                </div>
              </div>

              {/* Versões Anteriores Arquivadas */}
              {historicoVersoes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 p-5 text-center">
                  <p className="font-karla text-xs font-bold text-zinc-600">
                    Nenhuma versão anterior arquivada
                  </p>
                  <p className="font-spectral text-xs text-zinc-500 mt-1">
                    Ao enviar um novo PDF atualizado, a versão atual e todas as marcações feitas pelo orientador ficarão salvas aqui para consulta.
                  </p>
                </div>
              ) : (
                historicoVersoes.map((hv) => {
                  const selecionada = versaoVisualizada === hv.versaoNumero;
                  const totalComs = hv.comentarios?.length || 0;
                  return (
                    <div
                      key={hv.id}
                      onClick={() => setVersaoVisualizada(hv.versaoNumero)}
                      className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
                        selecionada
                          ? "border-amber-600 bg-amber-50/40 ring-1 ring-amber-600"
                          : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-karla font-bold text-xs text-zinc-900">
                          Versão {hv.versaoNumero} (Arquivada)
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700 font-karla text-[10px] font-bold">
                          {totalComs}{" "}
                          {totalComs === 1
                            ? "marcação preservada"
                            : "marcações preservadas"}
                        </span>
                      </div>

                      <p className="font-karla text-xs font-medium text-zinc-700 truncate">
                        {hv.nomeArquivo}
                      </p>

                      {hv.nota && (
                        <p className="font-spectral italic text-xs text-zinc-600 mt-1">
                          &ldquo;{hv.nota}&rdquo;
                        </p>
                      )}

                      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500 font-karla">
                        <span>
                          Arquivada em{" "}
                          {new Date(hv.arquivadoEm).toLocaleDateString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </span>
                        <span className="font-bold text-[#133C1B]">
                          Ver PDF e marcações →
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

      {/* Modal para enviar nova versão PDF */}
      {modalNovaVersao && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPendingUpload) {
              setModalNovaVersao(false);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 font-karla">
                  Enviar Nova Versão do PDF (Versão {versaoAtual + 1})
                </h2>
                <p className="text-xs text-zinc-500 font-spectral">
                  A Versão {versaoAtual} atual e todas as suas marcações ({comentariosAtuais.length}) serão preservadas automaticamente no Histórico de Versões.
                </p>
              </div>
              <button
                type="button"
                disabled={isPendingUpload}
                onClick={() => setModalNovaVersao(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEnviarNovaVersaoSubmit} className="space-y-4">
              {erroUpload && (
                <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 font-karla font-semibold">
                  {erroUpload}
                </p>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 font-karla mb-1.5">
                  Novo arquivo PDF atualizado *
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
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  <span className="font-karla text-sm font-bold text-[#133C1B]">
                    {novoArquivoPdf
                      ? novoArquivoPdf.name
                      : "Clique para selecionar o novo arquivo .PDF"}
                  </span>
                  <span className="font-spectral text-xs text-zinc-500 mt-1">
                    {novoArquivoPdf
                      ? `${formatarTamanhoArquivo(novoArquivoPdf.size)} · Pronto para envio`
                      : "Formato PDF (máx. 20 MB)"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    required
                    disabled={isPendingUpload}
                    onChange={(e) =>
                      setNovoArquivoPdf(e.target.files?.[0] ?? null)
                    }
                    className="sr-only"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 font-karla mb-1">
                  Resumo das alterações realizadas (opcional)
                </label>
                <textarea
                  rows={3}
                  value={notaNovaVersao}
                  onChange={(e) => setNotaNovaVersao(e.target.value)}
                  disabled={isPendingUpload}
                  placeholder="Ex: Ajustada a seção de metodologia e corrigidas as referências apontadas na Versão anterior..."
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2 text-sm font-spectral focus:border-[#133C1B] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  disabled={isPendingUpload}
                  onClick={() => setModalNovaVersao(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 font-karla cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingUpload || !novoArquivoPdf}
                  className="rounded-xl bg-[#133C1B] px-5 py-2 text-xs font-bold text-white hover:bg-[#1a4f24] disabled:opacity-50 font-karla cursor-pointer"
                >
                  {isPendingUpload
                    ? "Arquivando versão anterior e enviando..."
                    : `Publicar Versão ${versaoAtual + 1}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

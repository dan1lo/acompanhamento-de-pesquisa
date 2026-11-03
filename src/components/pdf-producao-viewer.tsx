"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type {
  ComentarioArtigo,
  CorMarcacao,
  PdfHighlightRect,
} from "@/lib/actions/producao";

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

export interface SelecaoPdfPendente {
  trecho: string;
  pagina: number;
  rects: PdfHighlightRect[];
}

interface PdfProducaoViewerProps {
  pdfUrl: string;
  comentarios: ComentarioArtigo[];
  permitirMarcacao?: boolean;
  comentarioFocadoId?: string | null;
  onSelecionarComentario?: (comentarioId: string) => void;
  onCriarMarcacao?: (dados: {
    trecho: string;
    comentario: string;
    cor: CorMarcacao;
    pagina: number;
    rects: PdfHighlightRect[];
  }) => Promise<void>;
  salvandoMarcacao?: boolean;
  versaoLabel?: string;
  somenteLeituraHistorico?: boolean;
}

const CORES_DESTAQUE: Record<
  CorMarcacao,
  {
    bg: string;
    border: string;
    hex: string;
    label: string;
    desc: string;
  }
> = {
  AZUL: {
    bg: "rgba(59, 130, 246, 0.28)",
    border: "#2563EB",
    hex: "#BFDBFE",
    label: "Leve",
    desc: "Ajuste pontual ou sugestão",
  },
  AMARELO: {
    bg: "rgba(250, 204, 21, 0.36)",
    border: "#CA8A04",
    hex: "#FEF08A",
    label: "Moderado",
    desc: "Requer revisão de conteúdo",
  },
  VERMELHO: {
    bg: "rgba(239, 68, 68, 0.30)",
    border: "#DC2626",
    hex: "#FECACA",
    label: "Grave",
    desc: "Correção obrigatória",
  },
  ROXO: {
    bg: "rgba(168, 85, 247, 0.28)",
    border: "#9333EA",
    hex: "#E9D5FF",
    label: "Alteração Opcional",
    desc: "Melhoria estilística opcional",
  },
};

let pdfJsLoadPromise: Promise<any> | null = null;

function carregarPdfJs(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("SSR"));
  }
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.js";
    return Promise.resolve(window.pdfjsLib);
  }
  if (pdfJsLoadPromise) return pdfJsLoadPromise;

  pdfJsLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-pdfjs="true"]');
    if (existing && window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.js";
      resolve(window.pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src = "/pdfjs/pdf.js";
    script.async = true;
    script.dataset.pdfjs = "true";
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.js";
        resolve(window.pdfjsLib);
      } else {
        reject(new Error("pdfjsLib não inicializado."));
      }
    };
    script.onerror = () => reject(new Error("Falha ao carregar /pdfjs/pdf.js"));
    document.head.appendChild(script);
  });

  return pdfJsLoadPromise;
}

function mesclarRectsPorLinha(rects: PdfHighlightRect[]): PdfHighlightRect[] {
  if (rects.length <= 1) return rects;
  const ordenados = [...rects].sort((a, b) =>
    Math.abs(a.y - b.y) < 0.8 ? a.x - b.x : a.y - b.y
  );
  const resultado: PdfHighlightRect[] = [];

  for (const r of ordenados) {
    if (r.width < 0.1 || r.height < 0.1) continue;
    const ultimo = resultado[resultado.length - 1];
    if (
      ultimo &&
      Math.abs(ultimo.y - r.y) < 0.9 &&
      Math.abs(ultimo.height - r.height) < 1.2 &&
      r.x <= ultimo.x + ultimo.width + 1.5
    ) {
      const novoFimX = Math.max(ultimo.x + ultimo.width, r.x + r.width);
      ultimo.x = Math.min(ultimo.x, r.x);
      ultimo.width = novoFimX - ultimo.x;
      ultimo.y = Math.min(ultimo.y, r.y);
      ultimo.height = Math.max(ultimo.height, r.height);
    } else {
      resultado.push({ ...r });
    }
  }
  return resultado;
}

export function PdfProducaoViewer({
  pdfUrl,
  comentarios,
  permitirMarcacao = false,
  comentarioFocadoId = null,
  onSelecionarComentario,
  onCriarMarcacao,
  salvandoMarcacao = false,
  versaoLabel,
  somenteLeituraHistorico = false,
}: PdfProducaoViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erroPdf, setErroPdf] = useState<string | null>(null);
  const [escala, setEscala] = useState<number>(1.2);
  const [modoMarcacao, setModoMarcacao] = useState<"TEXTO" | "AREA">("TEXTO");

  // Seleção de texto ou área pendente
  const [selecaoPendente, setSelecaoPendente] = useState<{
    trecho: string;
    pagina: number;
    rects: PdfHighlightRect[];
    anchorX: number;
    anchorY: number;
  } | null>(null);

  const [cardComentarioAberto, setCardComentarioAberto] = useState<boolean>(false);
  const [corEscolhida, setCorEscolhida] = useState<CorMarcacao>("AMARELO");
  const [textoComentario, setTextoComentario] = useState<string>("");
  const [trechoEditavel, setTrechoEditavel] = useState<string>("");

  // Estado para arrastar retângulo no modo AREA
  const [arrastandoArea, setArrastandoArea] = useState<{
    pagina: number;
    startX: number;
    startY: number;
    currX: number;
    currY: number;
  } | null>(null);

  const pdfDocRef = useRef<any>(null);
  const containerScrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Carrega o documento PDF quando pdfUrl muda
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErroPdf(null);
    setSelecaoPendente(null);
    setCardComentarioAberto(false);

    async function initPdf() {
      try {
        const pdfjsLib = await carregarPdfJs();
        const res = await fetch(pdfUrl, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Erro HTTP ${res.status} ao carregar o PDF.`);
        }
        const arrayBuffer = await res.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);

        const loadingTask = pdfjsLib.getDocument({ data: uint8 });
        const pdfDoc = await loadingTask.promise;
        if (cancelado) return;

        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages || 1);
        setCarregando(false);
      } catch (err: any) {
        if (cancelado) return;
        console.error("Erro ao renderizar PDF:", err);
        setErroPdf(
          err?.message || "Não foi possível carregar o arquivo PDF desta produção."
        );
        setCarregando(false);
      }
    }

    initPdf();

    return () => {
      cancelado = true;
    };
  }, [pdfUrl]);

  // Rola até a página do comentário focado quando selecionado na barra lateral
  useEffect(() => {
    if (!comentarioFocadoId) return;
    const com = comentarios.find((c) => c.id === comentarioFocadoId);
    if (!com) return;
    const pag = com.pagina || 1;
    const pageEl = pageRefs.current[pag];
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [comentarioFocadoId, comentarios]);

  // Captura seleção de texto nativa nas páginas do PDF
  const handleMouseUpContainer = useCallback(() => {
    if (!permitirMarcacao || modoMarcacao !== "TEXTO") return;
    if (cardComentarioAberto) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const texto = sel.toString().replace(/\s+/g, " ").trim();
    if (!texto || texto.length < 2) return;

    const range = sel.getRangeAt(0);
    const anchorNode = range.commonAncestorContainer;
    const elementoBase =
      anchorNode.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as HTMLElement)
        : anchorNode.parentElement;

    const pageWrapper = elementoBase?.closest(
      "[data-pdf-page]"
    ) as HTMLElement | null;
    if (!pageWrapper) return;

    const paginaNum = Number(pageWrapper.dataset.pdfPage) || 1;
    const pageRect = pageWrapper.getBoundingClientRect();
    if (pageRect.width <= 0 || pageRect.height <= 0) return;

    const clientRects = Array.from(range.getClientRects());
    const rectsRelativos: PdfHighlightRect[] = clientRects
      .map((r) => ({
        x: Math.max(0, Math.min(100, ((r.left - pageRect.left) / pageRect.width) * 100)),
        y: Math.max(0, Math.min(100, ((r.top - pageRect.top) / pageRect.height) * 100)),
        width: Math.max(
          0.5,
          Math.min(100, (r.width / pageRect.width) * 100)
        ),
        height: Math.max(
          0.5,
          Math.min(100, (r.height / pageRect.height) * 100)
        ),
      }))
      .filter((r) => r.width > 0.2 && r.height > 0.2);

    const rectsMesclados = mesclarRectsPorLinha(rectsRelativos);
    if (rectsMesclados.length === 0) return;

    const primeiro = rectsMesclados[0];
    setSelecaoPendente({
      trecho: texto.slice(0, 600),
      pagina: paginaNum,
      rects: rectsMesclados,
      anchorX: Math.min(85, Math.max(15, primeiro.x + primeiro.width / 2)),
      anchorY: Math.max(4, primeiro.y),
    });
    setTrechoEditavel(texto.slice(0, 600));
  }, [permitirMarcacao, modoMarcacao, cardComentarioAberto]);

  async function handleConfirmarMarcacao() {
    if (!selecaoPendente || !onCriarMarcacao || !textoComentario.trim()) return;
    await onCriarMarcacao({
      trecho:
        trechoEditavel.trim() ||
        selecaoPendente.trecho ||
        `Trecho marcado na página ${selecaoPendente.pagina}`,
      comentario: textoComentario.trim(),
      cor: corEscolhida,
      pagina: selecaoPendente.pagina,
      rects: selecaoPendente.rects,
    });
    window.getSelection()?.removeAllRanges();
    setSelecaoPendente(null);
    setCardComentarioAberto(false);
    setTextoComentario("");
    setTrechoEditavel("");
  }

  function cancelarSelecao() {
    window.getSelection()?.removeAllRanges();
    setSelecaoPendente(null);
    setCardComentarioAberto(false);
    setTextoComentario("");
    setTrechoEditavel("");
  }

  return (
    <div className="flex flex-col h-full bg-[#E8EAE6] rounded-[12px] border border-[#E5E7EB] overflow-hidden">
      {/* Barra de ferramentas superior do visualizador PDF */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-white border-b border-[#E5E7EB] shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#133C1B]/10 text-[#133C1B] font-karla font-bold text-[12px]">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            {versaoLabel || "Documento PDF"}
          </span>

          {numPages > 0 && (
            <span className="font-karla text-[12px] text-[#6B7280] font-medium">
              {numPages} {numPages === 1 ? "página" : "páginas"}
            </span>
          )}

          {somenteLeituraHistorico && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-karla text-[11px] font-bold">
              Versão arquivada (somente leitura)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Seletor de modo de marcação para o orientador */}
          {permitirMarcacao && !somenteLeituraHistorico && (
            <div className="flex items-center bg-[#F3F4F6] p-0.5 rounded-[8px] border border-[#E5E7EB] mr-1">
              <button
                type="button"
                onClick={() => {
                  setModoMarcacao("TEXTO");
                  cancelarSelecao();
                }}
                className={`px-2.5 py-1 rounded-[6px] font-karla text-[11px] font-bold transition-colors cursor-pointer ${
                  modoMarcacao === "TEXTO"
                    ? "bg-[#133C1B] text-white shadow-xs"
                    : "text-[#4B5563] hover:text-[#111827]"
                }`}
                title="Selecione qualquer texto do PDF com o cursor para grifar e comentar"
              >
                Selecionar Texto
              </button>
              <button
                type="button"
                onClick={() => {
                  setModoMarcacao("AREA");
                  cancelarSelecao();
                }}
                className={`px-2.5 py-1 rounded-[6px] font-karla text-[11px] font-bold transition-colors cursor-pointer ${
                  modoMarcacao === "AREA"
                    ? "bg-[#133C1B] text-white shadow-xs"
                    : "text-[#4B5563] hover:text-[#111827]"
                }`}
                title="Arraste um retângulo sobre figuras, tabelas, equações ou trechos para comentar"
              >
                Marcar Área / Figura
              </button>
            </div>
          )}

          {/* Controles de Zoom */}
          <div className="flex items-center gap-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] px-1.5 py-0.5">
            <button
              type="button"
              onClick={() =>
                setEscala((prev) => Math.max(0.75, Number((prev - 0.15).toFixed(2))))
              }
              className="w-6 h-6 flex items-center justify-center rounded text-[#374151] hover:bg-[#E5E7EB] font-karla font-bold text-[14px] cursor-pointer"
              title="Diminuir zoom"
            >
              −
            </button>
            <span className="font-karla text-[11px] font-bold text-[#374151] min-w-[42px] text-center">
              {Math.round(escala * 100)}%
            </span>
            <button
              type="button"
              onClick={() =>
                setEscala((prev) => Math.min(2.0, Number((prev + 0.15).toFixed(2))))
              }
              className="w-6 h-6 flex items-center justify-center rounded text-[#374151] hover:bg-[#E5E7EB] font-karla font-bold text-[14px] cursor-pointer"
              title="Aumentar zoom"
            >
              +
            </button>
          </div>

          {/* Botão abrir/baixar PDF */}
          <a
            href={`${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}download=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] border border-[#D1D5DB] bg-white hover:bg-[#F9FAFB] text-[#374151] font-karla text-[12px] font-semibold transition-colors"
            title="Baixar arquivo PDF desta versão"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Baixar PDF
          </a>
        </div>
      </div>

      {/* Dica de instrução para o orientador */}
      {permitirMarcacao && !somenteLeituraHistorico && (
        <div className="px-4 py-1.5 bg-[#133C1B]/5 border-b border-[#133C1B]/15 flex items-center justify-between gap-2 shrink-0">
          <p className="font-karla text-[12px] text-[#133C1B] font-medium">
            {modoMarcacao === "TEXTO"
              ? "Selecione qualquer trecho de texto diretamente no PDF abaixo para destacar e adicionar um comentário."
              : "Clique e arraste sobre qualquer área, figura, equação ou parágrafo do PDF para destacar e comentar."}
          </p>
          {selecaoPendente && !cardComentarioAberto && (
            <button
              type="button"
              onClick={() => setCardComentarioAberto(true)}
              className="px-3 py-1 rounded-[6px] bg-[#111827] text-white font-karla text-[11px] font-bold hover:bg-black transition-colors cursor-pointer shrink-0"
            >
              Comentar seleção (Pág. {selecaoPendente.pagina})
            </button>
          )}
        </div>
      )}

      {/* Área de rolagem das páginas do PDF */}
      <div
        ref={containerScrollRef}
        onMouseUp={handleMouseUpContainer}
        className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center gap-6 relative"
      >
        {carregando && (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#4B5563]">
            <div className="w-8 h-8 border-3 border-[#133C1B] border-t-transparent rounded-full animate-spin" />
            <p className="font-karla text-[13px] font-medium">
              Renderizando páginas do PDF...
            </p>
          </div>
        )}

        {erroPdf && !carregando && (
          <div className="my-12 max-w-md bg-white border border-red-200 rounded-[12px] p-6 text-center shadow-xs">
            <p className="font-karla font-bold text-[15px] text-red-700 mb-1">
              Não foi possível abrir o PDF
            </p>
            <p className="font-spectral text-[13px] text-[#4B5563] mb-4">
              {erroPdf}
            </p>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 rounded-[8px] bg-[#133C1B] text-white font-karla text-[12px] font-bold"
            >
              Abrir PDF em nova guia
            </a>
          </div>
        )}

        {!carregando &&
          !erroPdf &&
          Array.from({ length: numPages }, (_, idx) => idx + 1).map((pageNumber) => (
            <PdfPageCanvas
              key={`${pdfUrl}-page-${pageNumber}`}
              pdfDoc={pdfDocRef.current}
              pageNumber={pageNumber}
              escala={escala}
              comentariosPagina={comentarios.filter(
                (c) => (c.pagina || 1) === pageNumber
              )}
              comentarioFocadoId={comentarioFocadoId}
              onSelecionarComentario={onSelecionarComentario}
              permitirMarcacao={permitirMarcacao && !somenteLeituraHistorico}
              modoMarcacao={modoMarcacao}
              selecaoPendente={
                selecaoPendente?.pagina === pageNumber ? selecaoPendente : null
              }
              arrastandoArea={
                arrastandoArea?.pagina === pageNumber ? arrastandoArea : null
              }
              onIniciarArrasteArea={(x, y) => {
                setSelecaoPendente(null);
                setCardComentarioAberto(false);
                setArrastandoArea({
                  pagina: pageNumber,
                  startX: x,
                  startY: y,
                  currX: x,
                  currY: y,
                });
              }}
              onMoverArrasteArea={(x, y) => {
                setArrastandoArea((prev) =>
                  prev && prev.pagina === pageNumber
                    ? { ...prev, currX: x, currY: y }
                    : prev
                );
              }}
              onFinalizarArrasteArea={() => {
                if (!arrastandoArea || arrastandoArea.pagina !== pageNumber) return;
                const x = Math.min(arrastandoArea.startX, arrastandoArea.currX);
                const y = Math.min(arrastandoArea.startY, arrastandoArea.currY);
                const width = Math.abs(
                  arrastandoArea.currX - arrastandoArea.startX
                );
                const height = Math.abs(
                  arrastandoArea.currY - arrastandoArea.startY
                );
                setArrastandoArea(null);
                if (width < 1.5 || height < 1.0) return;

                const defaultLabel = `Área destacada na página ${pageNumber}`;
                setSelecaoPendente({
                  trecho: defaultLabel,
                  pagina: pageNumber,
                  rects: [{ x, y, width, height }],
                  anchorX: Math.min(85, Math.max(15, x + width / 2)),
                  anchorY: Math.max(4, y),
                });
                setTrechoEditavel(defaultLabel);
              }}
              onAbrirCardComentario={() => setCardComentarioAberto(true)}
              onCancelarSelecao={cancelarSelecao}
              registerPageRef={(el) => {
                pageRefs.current[pageNumber] = el;
              }}
            />
          ))}
      </div>

      {/* Modal / Card flutuante de personalização da marcação do orientador */}
      {cardComentarioAberto && selecaoPendente && permitirMarcacao && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-2xl w-full max-w-[480px] p-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#133C1B]/10 text-[#133C1B] font-karla text-[11px] font-bold">
                  Página {selecaoPendente.pagina}
                </span>
                <h4 className="font-karla font-bold text-[16px] text-[#111827]">
                  Adicionar Marcação no PDF
                </h4>
              </div>
              <button
                type="button"
                onClick={cancelarSelecao}
                className="text-[#6B7280] hover:text-[#111827] font-karla text-[18px] leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Trecho marcado */}
            <div className="mb-3">
              <label className="block font-karla text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mb-1">
                Trecho / Referência Destacada
              </label>
              <input
                type="text"
                value={trechoEditavel}
                onChange={(e) => setTrechoEditavel(e.target.value)}
                className="w-full px-3 py-2 rounded-[8px] border border-[#D1D5DB] bg-[#F9FAFB] font-spectral italic text-[13px] text-[#374151] focus:outline-none focus:border-[#133C1B]"
              />
            </div>

            {/* Escolha da cor / severidade */}
            <div className="mb-3">
              <label className="block font-karla text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mb-1.5">
                Classificação da Marcação
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CORES_DESTAQUE) as CorMarcacao[]).map((corKey) => {
                  const info = CORES_DESTAQUE[corKey];
                  const selecionado = corEscolhida === corKey;
                  return (
                    <button
                      key={corKey}
                      type="button"
                      onClick={() => setCorEscolhida(corKey)}
                      className={`flex items-center gap-2.5 p-2 rounded-[8px] border text-left transition-all cursor-pointer ${
                        selecionado
                          ? "border-[#111827] bg-[#F9FAFB] shadow-xs ring-1 ring-[#111827]"
                          : "border-[#E5E7EB] hover:border-[#D1D5DB]"
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full shrink-0 border"
                        style={{
                          backgroundColor: info.hex,
                          borderColor: info.border,
                        }}
                      />
                      <div className="min-w-0">
                        <p className="font-karla font-bold text-[12px] text-[#111827] leading-tight">
                          {info.label}
                        </p>
                        <p className="font-karla text-[10px] text-[#6B7280] truncate">
                          {info.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comentário do orientador */}
            <div className="mb-4">
              <label className="block font-karla text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mb-1">
                Comentário / Orientação
              </label>
              <textarea
                rows={4}
                value={textoComentario}
                onChange={(e) => setTextoComentario(e.target.value)}
                placeholder="Descreva a correção, ajuste ou sugestão para este trecho do PDF..."
                autoFocus
                className="w-full px-3 py-2 rounded-[8px] border border-[#D1D5DB] font-spectral text-[14px] text-[#111827] focus:outline-none focus:border-[#133C1B]"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelarSelecao}
                disabled={salvandoMarcacao}
                className="px-4 py-2 rounded-[8px] border border-[#D1D5DB] font-karla text-[13px] font-semibold text-[#374151] hover:bg-[#F3F4F6] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvandoMarcacao || !textoComentario.trim()}
                onClick={handleConfirmarMarcacao}
                className="px-4 py-2 rounded-[8px] bg-[#133C1B] hover:bg-[#1a4f24] disabled:opacity-50 text-white font-karla text-[13px] font-bold transition-colors cursor-pointer"
              >
                {salvandoMarcacao ? "Salvando..." : "Salvar Marcação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PdfPageCanvasProps {
  pdfDoc: any;
  pageNumber: number;
  escala: number;
  comentariosPagina: ComentarioArtigo[];
  comentarioFocadoId?: string | null;
  onSelecionarComentario?: (comentarioId: string) => void;
  permitirMarcacao: boolean;
  modoMarcacao: "TEXTO" | "AREA";
  selecaoPendente: {
    trecho: string;
    pagina: number;
    rects: PdfHighlightRect[];
    anchorX: number;
    anchorY: number;
  } | null;
  arrastandoArea: {
    pagina: number;
    startX: number;
    startY: number;
    currX: number;
    currY: number;
  } | null;
  onIniciarArrasteArea: (x: number, y: number) => void;
  onMoverArrasteArea: (x: number, y: number) => void;
  onFinalizarArrasteArea: () => void;
  onAbrirCardComentario: () => void;
  onCancelarSelecao: () => void;
  registerPageRef: (el: HTMLDivElement | null) => void;
}

function PdfPageCanvas({
  pdfDoc,
  pageNumber,
  escala,
  comentariosPagina,
  comentarioFocadoId,
  onSelecionarComentario,
  permitirMarcacao,
  modoMarcacao,
  selecaoPendente,
  arrastandoArea,
  onIniciarArrasteArea,
  onMoverArrasteArea,
  onFinalizarArrasteArea,
  onAbrirCardComentario,
  onCancelarSelecao,
  registerPageRef,
}: PdfPageCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [dimensoes, setDimensoes] = useState<{ width: number; height: number }>({
    width: 720,
    height: 1018,
  });
  const [rectsInferidosPorTexto, setRectsInferidosPorTexto] = useState<
    Record<string, PdfHighlightRect[]>
  >({});

  useEffect(() => {
    registerPageRef(wrapperRef.current);
    return () => registerPageRef(null);
  }, [registerPageRef]);

  useEffect(() => {
    let cancelado = false;
    if (!pdfDoc) return;

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelado) return;

        const viewport = page.getViewport(escala);
        setDimensoes({
          width: Math.round(viewport.width),
          height: Math.round(viewport.height),
        });

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.round(viewport.width)}px`;
          canvas.style.height = `${Math.round(viewport.height)}px`;

          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            await page.render({
              canvasContext: ctx,
              viewport,
            }).promise;
          }
        }

        if (cancelado) return;

        const textLayerDiv = textLayerRef.current;
        if (textLayerDiv && window.pdfjsLib) {
          textLayerDiv.innerHTML = "";
          textLayerDiv.style.width = `${Math.round(viewport.width)}px`;
          textLayerDiv.style.height = `${Math.round(viewport.height)}px`;

          const textContent = await page.getTextContent();
          if (cancelado) return;

          const task = window.pdfjsLib.renderTextLayer({
            textContent,
            container: textLayerDiv,
            viewport,
            textDivs: [],
            enhanceTextSelection: true,
          });
          if (task?.promise) {
            await task.promise;
          }
        }
      } catch (e) {
        if (!cancelado) {
          console.error(`Erro ao renderizar página ${pageNumber}:`, e);
        }
      }
    }

    renderPage();

    return () => {
      cancelado = true;
    };
  }, [pdfDoc, pageNumber, escala]);

  // Caso algum comentário legado não possua rects salvos, infere a posição procurando no textLayer
  useEffect(() => {
    const semRects = comentariosPagina.filter(
      (c) => (!c.rects || c.rects.length === 0) && c.trecho
    );
    if (semRects.length === 0) return;

    const timer = setTimeout(() => {
      const textLayerDiv = textLayerRef.current;
      const pageEl = wrapperRef.current;
      if (!textLayerDiv || !pageEl) return;

      const pageRect = pageEl.getBoundingClientRect();
      if (pageRect.width <= 0 || pageRect.height <= 0) return;

      const spans = Array.from(textLayerDiv.querySelectorAll("span"));
      const novoMapa: Record<string, PdfHighlightRect[]> = {};

      for (const com of semRects) {
        const alvo = com.trecho.trim().toLowerCase().slice(0, 60);
        if (!alvo) continue;
        const encontrados: PdfHighlightRect[] = [];

        for (const sp of spans) {
          const txt = (sp.textContent || "").trim().toLowerCase();
          if (txt && (txt.includes(alvo) || alvo.includes(txt)) && txt.length >= 3) {
            const r = sp.getBoundingClientRect();
            encontrados.push({
              x: ((r.left - pageRect.left) / pageRect.width) * 100,
              y: ((r.top - pageRect.top) / pageRect.height) * 100,
              width: (r.width / pageRect.width) * 100,
              height: (r.height / pageRect.height) * 100,
            });
            if (encontrados.length >= 4) break;
          }
        }

        if (encontrados.length > 0) {
          novoMapa[com.id] = mesclarRectsPorLinha(encontrados);
        }
      }

      if (Object.keys(novoMapa).length > 0) {
        setRectsInferidosPorTexto((prev) => ({ ...prev, ...novoMapa }));
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [comentariosPagina, escala]);

  function calcularCoordenadaRelativa(e: React.MouseEvent<HTMLDivElement>) {
    const el = wrapperRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
    );
    const y = Math.max(
      0,
      Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)
    );
    return { x, y };
  }

  return (
    <div
      ref={wrapperRef}
      data-pdf-page={pageNumber}
      style={{
        width: `${dimensoes.width}px`,
        height: `${dimensoes.height}px`,
      }}
      className="relative bg-white shadow-md border border-[#D1D5DB] select-text shrink-0"
    >
      {/* Badge discreto do número da página */}
      <div className="absolute top-2 right-2 z-30 px-2 py-0.5 rounded bg-black/55 text-white font-karla text-[10px] font-bold pointer-events-none">
        Pág. {pageNumber}
      </div>

      {/* Canvas onde o PDF é desenhado */}
      <canvas ref={canvasRef} className="block pointer-events-none" />

      {/* Camada de marcações/grifos salvos */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {comentariosPagina.map((com) => {
          const corConfig = CORES_DESTAQUE[com.cor] || CORES_DESTAQUE.AMARELO;
          const isFocado = comentarioFocadoId === com.id;
          const rectsParaDesenhar =
            com.rects && com.rects.length > 0
              ? com.rects
              : rectsInferidosPorTexto[com.id] || [
                  { x: 8, y: 12, width: 84, height: 3.2 },
                ];

          return (
            <React.Fragment key={com.id}>
              {rectsParaDesenhar.map((r, rIdx) => (
                <div
                  key={`${com.id}-r-${rIdx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelecionarComentario?.(com.id);
                  }}
                  title={`${com.autorNome || "Orientador"}: ${com.comentario}`}
                  style={{
                    left: `${r.x}%`,
                    top: `${r.y}%`,
                    width: `${r.width}%`,
                    height: `${r.height}%`,
                    backgroundColor: com.resolvido
                      ? "rgba(16, 185, 129, 0.16)"
                      : corConfig.bg,
                    borderBottom: com.resolvido
                      ? "2px dashed #10B981"
                      : `2px solid ${corConfig.border}`,
                    mixBlendMode: "multiply",
                  }}
                  className={`absolute pointer-events-auto cursor-pointer rounded-[2px] transition-all ${
                    isFocado
                      ? "ring-2 ring-[#111827] shadow-md scale-[1.01]"
                      : "hover:brightness-95"
                  }`}
                />
              ))}
            </React.Fragment>
          );
        })}

        {/* Pré-visualização da seleção pendente antes de salvar */}
        {selecaoPendente &&
          selecaoPendente.rects.map((r, idx) => (
            <div
              key={`pending-${idx}`}
              style={{
                left: `${r.x}%`,
                top: `${r.y}%`,
                width: `${r.width}%`,
                height: `${r.height}%`,
                backgroundColor: "rgba(19, 60, 27, 0.24)",
                border: "1.5px dashed #133C1B",
              }}
              className="absolute rounded-[2px]"
            />
          ))}

        {/* Retângulo sendo desenhado em tempo real no modo AREA */}
        {arrastandoArea && (
          <div
            style={{
              left: `${Math.min(arrastandoArea.startX, arrastandoArea.currX)}%`,
              top: `${Math.min(arrastandoArea.startY, arrastandoArea.currY)}%`,
              width: `${Math.abs(arrastandoArea.currX - arrastandoArea.startX)}%`,
              height: `${Math.abs(arrastandoArea.currY - arrastandoArea.startY)}%`,
              backgroundColor: "rgba(19, 60, 27, 0.20)",
              border: "2px dashed #133C1B",
            }}
            className="absolute rounded-[3px]"
          />
        )}
      </div>

      {/* Camada de texto selecionável do PDF.js */}
      <div
        ref={textLayerRef}
        className={`pdf-text-layer z-20 ${
          permitirMarcacao && modoMarcacao === "AREA"
            ? "pointer-events-none select-none"
            : ""
        }`}
      />

      {/* Camada interativa para arrastar retângulo quando em modo AREA */}
      {permitirMarcacao && modoMarcacao === "AREA" && (
        <div
          onMouseDown={(e) => {
            const { x, y } = calcularCoordenadaRelativa(e);
            onIniciarArrasteArea(x, y);
          }}
          onMouseMove={(e) => {
            if (!arrastandoArea) return;
            const { x, y } = calcularCoordenadaRelativa(e);
            onMoverArrasteArea(x, y);
          }}
          onMouseUp={() => {
            onFinalizarArrasteArea();
          }}
          className="absolute inset-0 z-25 cursor-crosshair"
        />
      )}

      {/* Botão flutuante preto "Comentar" próximo à seleção na página */}
      {permitirMarcacao && selecaoPendente && (
        <div
          style={{
            left: `${selecaoPendente.anchorX}%`,
            top: `${Math.max(2, selecaoPendente.anchorY - 1)}%`,
            transform: "translate(-50%, -100%)",
          }}
          className="absolute z-40 flex items-center gap-1 bg-[#111827] text-white rounded-[8px] shadow-xl px-2.5 py-1.5 border border-black/20 animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAbrirCardComentario();
            }}
            className="flex items-center gap-1.5 font-karla font-bold text-[12px] text-white hover:text-amber-200 cursor-pointer"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 8h10M7 12h6m-6 8l-4-4V5a2 2 0 012-2h14a2 2 0 012 2v11a2 2 0 01-2 2H7z"
              />
            </svg>
            Comentar
          </button>
          <span className="text-white/30 text-[11px] mx-0.5">|</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancelarSelecao();
            }}
            className="text-white/70 hover:text-white font-karla text-[12px] px-1 cursor-pointer"
            title="Cancelar seleção"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}


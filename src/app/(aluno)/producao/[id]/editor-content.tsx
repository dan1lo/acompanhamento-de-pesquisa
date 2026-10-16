"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { formatarData } from "@/lib/datas";
import { atualizarConteudoProducao, sincronizarGoogleDocs } from "@/lib/actions/producao";

interface Producao {
  id: string;
  titulo: string;
  venue: string | null;
  status: "EM_ESCRITA" | "SUBMETIDO" | "EM_REVISAO" | "ACEITO" | "PUBLICADO";
  prazoSubmissao: Date | null;
  googleDocsUrl: string | null;
  overleafUrl?: string | null;
  conteudo: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

const ROTULOS_STATUS: Record<string, string> = {
  EM_ESCRITA: "Em escrita",
  SUBMETIDO: "Submetido",
  EM_REVISAO: "Em revisão",
  ACEITO: "Aceito",
  PUBLICADO: "Publicado",
};

function OverleafIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.8 3.2C14.6 3.2 9.5 6.1 7.1 10.8c-1.4 2.7-1.6 5.8-.5 8.4l-2.3 2.3a.75.75 0 1 0 1.06 1.06l2.28-2.28c1.4.5 3 .7 4.66.5 4.9-.6 8.5-4.9 8.5-10.3 0-2.6-.5-5.1-1-7.28zm-7.7 15.1c-1.2.15-2.35-.02-3.38-.42 1.88-1.98 4.44-4.23 7.38-5.58a.75.75 0 0 0-.62-1.36c-3.17 1.45-5.88 3.82-7.85 5.88-.58-1.8-.34-3.85.67-5.8 1.98-3.84 6.12-6.24 10.37-6.37.28 1.47.53 3.16.53 4.85 0 4.44-3.02 8.07-7.1 8.8z" />
    </svg>
  );
}

export function EditorContent({ producao }: { producao: Producao }) {
  const [conteudo, setConteudo] = useState(producao.conteudo || "");
  const [salvando, startSalvando] = useTransition();
  const [sincronizando, startSincronizando] = useTransition();
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<"editor" | "docs" | "overleaf">("editor");
  const [modificado, setModificado] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Inicializa o conteúdo do editor contentEditable
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = producao.conteudo || "<p><br></p>";
    }
  }, [producao.conteudo]);

  // Contadores
  const textoLimpo = conteudo.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const contagemPalavras = textoLimpo ? textoLimpo.split(" ").length : 0;
  const contagemCaracteres = textoLimpo.length;

  function aplicarComando(comando: string, valor?: string) {
    document.execCommand(comando, false, valor);
    if (editorRef.current) {
      setConteudo(editorRef.current.innerHTML);
      setModificado(true);
    }
  }

  function handleEditorInput() {
    if (editorRef.current) {
      setConteudo(editorRef.current.innerHTML);
      setModificado(true);
    }
  }

  function handleSalvar() {
    setMensagemErro(null);
    setMensagemSucesso(null);
    startSalvando(async () => {
      try {
        await atualizarConteudoProducao(producao.id, conteudo);
        setModificado(false);
        setMensagemSucesso("Artigo salvo com sucesso!");
        setTimeout(() => setMensagemSucesso(null), 3000);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setMensagemErro(err.message);
        } else {
          setMensagemErro("Erro ao salvar as alterações.");
        }
      }
    });
  }

  function handleSincronizarGoogleDocs() {
    if (!producao.googleDocsUrl) return;
    setMensagemErro(null);
    setMensagemSucesso(null);
    startSincronizando(async () => {
      try {
        const res = await sincronizarGoogleDocs(producao.id);
        if (res.conteudo) {
          // Converte quebras de linha em parágrafos se for texto puro
          const formatado = res.conteudo
            .split(/\r?\n\r?\n/)
            .map((p) => `<p>${p.replace(/\r?\n/g, "<br>")}</p>`)
            .join("");
          setConteudo(formatado);
          if (editorRef.current) {
            editorRef.current.innerHTML = formatado;
          }
          setModificado(false);
          setMensagemSucesso("Artigo sincronizado com o Google Docs com sucesso!");
          setTimeout(() => setMensagemSucesso(null), 4000);
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setMensagemErro(err.message);
        } else {
          setMensagemErro("Erro ao sincronizar com Google Docs.");
        }
      }
    });
  }

  function handleInserirTemplateLatex() {
    const template = [
      "<p>\\documentclass[12pt]{article}</p>",
      "<p>\\usepackage[utf8]{inputenc}</p>",
      "<p>\\usepackage[brazil]{babel}</p>",
      "<p>\\usepackage{amsmath, amssymb, graphicx}</p>",
      "<p><br></p>",
      `<p>\\title{${producao.titulo}}</p>`,
      "<p>\\author{Autor(es)}</p>",
      "<p>\\date{\\today}</p>",
      "<p><br></p>",
      "<p>\\begin{document}</p>",
      "<p>\\maketitle</p>",
      "<p><br></p>",
      "<p>\\begin{abstract}</p>",
      "<p>Escreva o resumo do seu artigo aqui...</p>",
      "<p>\\end{abstract}</p>",
      "<p><br></p>",
      "<p>\\section{Introdução}</p>",
      "<p>Desenvolva a introdução do seu trabalho...</p>",
      "<p><br></p>",
      "<p>\\section{Metodologia}</p>",
      "<p><br></p>",
      "<p>\\section{Resultados e Discussão}</p>",
      "<p><br></p>",
      "<p>\\section{Conclusão}</p>",
      "<p><br></p>",
      "<p>\\bibliographystyle{plain}</p>",
      "<p>\\bibliography{referencias}</p>",
      "<p>\\end{document}</p>",
    ].join("");

    setConteudo(template);
    if (editorRef.current) {
      editorRef.current.innerHTML = template;
    }
    setModificado(true);
    setAbaAtiva("editor");
    setMensagemSucesso("Estrutura base LaTeX inserida no editor! Clique em 'Salvar alterações' para gravar.");
    setTimeout(() => setMensagemSucesso(null), 4000);
  }

  return (
    <div className="space-y-6 pb-20 animate-fade-in text-left">
      {/* Barra superior de navegação e ações */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200/80 pb-4">
        <div className="space-y-1">
          <Link
            href="/producao"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-[#133C1B] transition-colors font-karla"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Voltar para Suas Produções
          </Link>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 font-karla">
              {producao.titulo}
            </h1>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 font-karla border border-zinc-200">
              {ROTULOS_STATUS[producao.status]}
            </span>
            {producao.overleafUrl && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-[#138A07] font-karla border border-emerald-200">
                <OverleafIcon className="h-3.5 w-3.5" />
                Overleaf Vinculado
              </span>
            )}
            {producao.googleDocsUrl && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 font-karla border border-blue-200">
                <svg className="h-3 w-3 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                </svg>
                Google Docs Vinculado
              </span>
            )}
            {!producao.overleafUrl && !producao.googleDocsUrl && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 font-karla border border-emerald-200">
                Editor Integrado
              </span>
            )}
          </div>
          {producao.venue && (
            <p className="text-xs text-zinc-500 font-spectral">
              Publicação/Evento: <span className="font-medium text-zinc-700">{producao.venue}</span>
              {producao.prazoSubmissao && ` · Prazo: ${formatarData(new Date(producao.prazoSubmissao))}`}
            </p>
          )}
        </div>

        {/* Botões de Ação do Header */}
        <div className="flex flex-wrap items-center gap-2 sm:self-end">
          {producao.overleafUrl && (
            <a
              href={producao.overleafUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-[#138A07] shadow-2xs hover:bg-emerald-100 active:scale-95 transition-all font-karla"
              title="Abrir projeto no Overleaf"
            >
              <OverleafIcon className="h-4 w-4" />
              <span>Abrir no Overleaf</span>
              <svg className="h-3.5 w-3.5 text-emerald-600/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}

          {producao.googleDocsUrl && (
            <>
              <button
                type="button"
                onClick={handleSincronizarGoogleDocs}
                disabled={sincronizando}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-800 shadow-2xs hover:bg-blue-100 active:scale-95 transition-all font-karla cursor-pointer disabled:opacity-50"
                title="Sincronizar conteúdo do Google Docs para este editor"
              >
                <svg
                  className={`h-4 w-4 text-blue-600 ${sincronizando ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                {sincronizando ? "Sincronizando..." : "Sincronizar Docs"}
              </button>

              <a
                href={producao.googleDocsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 active:scale-95 transition-all font-karla"
              >
                <span>Docs</span>
                <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </>
          )}

          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#133C1B] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-[#1a4f24] active:scale-95 transition-all font-karla cursor-pointer disabled:opacity-50"
          >
            {salvando ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>{modificado ? "Salvar alterações" : "Salvo"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alertas de Notificação */}
      {mensagemSucesso && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-sm text-emerald-800 font-spectral flex items-center justify-between animate-fade-in">
          <span>{mensagemSucesso}</span>
          <button onClick={() => setMensagemSucesso(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">×</button>
        </div>
      )}
      {mensagemErro && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-red-800 font-spectral flex items-center justify-between animate-fade-in">
          <span>{mensagemErro}</span>
          <button onClick={() => setMensagemErro(null)} className="text-red-600 hover:text-red-900 font-bold">×</button>
        </div>
      )}

      {/* Abas quando vinculado com Overleaf ou Google Docs */}
      {(producao.overleafUrl || producao.googleDocsUrl) && (
        <div className="flex border-b border-zinc-200 space-x-4">
          <button
            onClick={() => setAbaAtiva("editor")}
            className={`pb-2.5 text-sm font-semibold font-karla border-b-2 transition-colors cursor-pointer ${
              abaAtiva === "editor"
                ? "border-[#133C1B] text-[#133C1B]"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            ✍️ Editor da Aplicação
          </button>
          {producao.overleafUrl && (
            <button
              onClick={() => setAbaAtiva("overleaf")}
              className={`pb-2.5 text-sm font-semibold font-karla border-b-2 transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                abaAtiva === "overleaf"
                  ? "border-[#133C1B] text-[#133C1B]"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <OverleafIcon className="h-4 w-4 text-[#138A07]" />
              <span>Integração Overleaf</span>
            </button>
          )}
          {producao.googleDocsUrl && (
            <button
              onClick={() => setAbaAtiva("docs")}
              className={`pb-2.5 text-sm font-semibold font-karla border-b-2 transition-colors cursor-pointer ${
                abaAtiva === "docs"
                  ? "border-[#133C1B] text-[#133C1B]"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              📄 Integração Google Docs
            </button>
          )}
        </div>
      )}

      {/* Aba de Informações / Overleaf */}
      {producao.overleafUrl && abaAtiva === "overleaf" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[#138A07] border border-emerald-200/80">
              <OverleafIcon className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-900 font-karla">
                Projeto Vinculado ao Overleaf (LaTeX)
              </h3>
              <p className="text-sm text-zinc-600 font-spectral">
                Este trabalho está conectado ao seu projeto no Overleaf. Você pode abrir o ambiente LaTeX diretamente pelo link abaixo ou manter rascunhos, anotações e trechos do código <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs font-mono">.tex</code> salvos no editor integrado.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-200/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="overflow-hidden">
              <span className="text-xs font-semibold text-zinc-500 font-karla uppercase tracking-wider">
                URL do Projeto no Overleaf:
              </span>
              <p className="text-sm text-[#138A07] font-mono truncate pt-0.5">
                {producao.overleafUrl}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleInserirTemplateLatex}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-[#138A07] hover:bg-emerald-100 transition-colors font-karla cursor-pointer"
              >
                Inserir Template LaTeX no Editor
              </button>
              <a
                href={producao.overleafUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-[#138A07] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0f6e05] transition-colors font-karla inline-flex items-center gap-1"
              >
                Abrir no Overleaf ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Aba de Informações / Docs */}
      {producao.googleDocsUrl && abaAtiva === "docs" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                <path d="M8 12h8v2H8zm0 4h8v2H8zm0-8h4v2H8z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-zinc-900 font-karla">
                Documento Sincronizado com Google Docs
              </h3>
              <p className="text-sm text-zinc-600 font-spectral">
                Este artigo está conectado ao seu Google Docs. Você pode continuar escrevendo por lá e sincronizar as atualizações para cá com um clique, ou editar diretamente pelo nosso editor e salvar suas versões.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-200/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="overflow-hidden">
              <span className="text-xs font-semibold text-zinc-500 font-karla uppercase tracking-wider">
                URL do Documento:
              </span>
              <p className="text-sm text-blue-700 font-mono truncate pt-0.5">
                {producao.googleDocsUrl}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSincronizarGoogleDocs}
                disabled={sincronizando}
                className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors font-karla cursor-pointer disabled:opacity-50"
              >
                {sincronizando ? "Sincronizando..." : "Sincronizar agora"}
              </button>
              <a
                href={producao.googleDocsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors font-karla inline-flex items-center gap-1"
              >
                Abrir no Google Docs ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Editor Principal */}
      {(abaAtiva === "editor" || (!producao.googleDocsUrl && !producao.overleafUrl)) && (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
          {/* Barra de Ferramentas de Formatação */}
          <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-50/80 px-3 py-2 text-zinc-700 font-karla">
            <button
              type="button"
              onClick={() => aplicarComando("bold")}
              className="rounded p-1.5 hover:bg-zinc-200 text-sm font-bold cursor-pointer"
              title="Negrito (Ctrl+B)"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => aplicarComando("italic")}
              className="rounded p-1.5 hover:bg-zinc-200 text-sm italic cursor-pointer font-spectral"
              title="Itálico (Ctrl+I)"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => aplicarComando("underline")}
              className="rounded p-1.5 hover:bg-zinc-200 text-sm underline cursor-pointer"
              title="Sublinhado (Ctrl+U)"
            >
              U
            </button>
            <button
              type="button"
              onClick={() => aplicarComando("strikeThrough")}
              className="rounded p-1.5 hover:bg-zinc-200 text-sm line-through cursor-pointer"
              title="Tachado"
            >
              S
            </button>

            <span className="h-5 w-[1px] bg-zinc-300 mx-1"></span>

            <button
              type="button"
              onClick={() => aplicarComando("formatBlock", "<h1>")}
              className="rounded px-2 py-1 hover:bg-zinc-200 text-xs font-bold cursor-pointer"
              title="Título 1"
            >
              H1
            </button>
            <button
              type="button"
              onClick={() => aplicarComando("formatBlock", "<h2>")}
              className="rounded px-2 py-1 hover:bg-zinc-200 text-xs font-bold cursor-pointer"
              title="Título 2"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => aplicarComando("formatBlock", "<h3>")}
              className="rounded px-2 py-1 hover:bg-zinc-200 text-xs font-bold cursor-pointer"
              title="Título 3"
            >
              H3
            </button>
            <button
              type="button"
              onClick={() => aplicarComando("formatBlock", "<p>")}
              className="rounded px-2 py-1 hover:bg-zinc-200 text-xs cursor-pointer"
              title="Parágrafo Normal"
            >
              ¶ Texto
            </button>

            <span className="h-5 w-[1px] bg-zinc-300 mx-1"></span>

            <button
              type="button"
              onClick={() => aplicarComando("insertUnorderedList")}
              className="rounded p-1.5 hover:bg-zinc-200 text-sm cursor-pointer"
              title="Lista com Marcadores"
            >
              • Lista
            </button>
            <button
              type="button"
              onClick={() => aplicarComando("insertOrderedList")}
              className="rounded p-1.5 hover:bg-zinc-200 text-sm cursor-pointer"
              title="Lista Numerada"
            >
              1. Lista
            </button>
            <button
              type="button"
              onClick={() => aplicarComando("formatBlock", "<blockquote>")}
              className="rounded p-1.5 hover:bg-zinc-200 text-sm cursor-pointer font-serif"
              title="Citação"
            >
              &ldquo; Citação
            </button>

            <span className="h-5 w-[1px] bg-zinc-300 mx-1"></span>

            <button
              type="button"
              onClick={() => aplicarComando("undo")}
              className="rounded p-1.5 hover:bg-zinc-200 text-sm cursor-pointer"
              title="Desfazer"
            >
              ↩
            </button>
            <button
              type="button"
              onClick={() => aplicarComando("redo")}
              className="rounded p-1.5 hover:bg-zinc-200 text-sm cursor-pointer"
              title="Refazer"
            >
              ↪
            </button>
          </div>

          {/* Canvas do Editor */}
          <div
            ref={editorRef}
            contentEditable
            onInput={handleEditorInput}
            suppressContentEditableWarning
            className="min-h-[520px] max-w-none p-6 sm:p-8 focus:outline-none font-spectral text-zinc-900 leading-relaxed text-base sm:text-lg prose prose-zinc selection:bg-[#133C1B]/20"
            data-placeholder="Comece a redigir seu artigo acadêmico aqui..."
          />

          {/* Rodapé do Editor */}
          <div className="flex flex-wrap items-center justify-between border-t border-zinc-200 bg-zinc-50/90 px-4 py-2.5 text-xs text-zinc-500 font-karla">
            <div className="flex items-center gap-4">
              <span>{contagemPalavras} palavras</span>
              <span>{contagemCaracteres} caracteres</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${modificado ? "bg-amber-400" : "bg-emerald-500"}`}></span>
              <span>{modificado ? "Alterações não salvas" : "Tudo salvo"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

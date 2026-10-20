"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { formatarData, formatarDataHora } from "@/lib/datas";
import {
  atualizarConteudoProducao,
  sincronizarGoogleDocs,
  resolverComentarioProducao,
  obterComentariosProducaoAluno,
  type CorMarcacao,
  type ComentarioArtigo,
} from "@/lib/actions/producao";

interface Producao {
  id: string;
  titulo: string;
  venue: string | null;
  status: "EM_ESCRITA" | "SUBMETIDO" | "EM_REVISAO" | "ACEITO" | "PUBLICADO";
  prazoSubmissao: Date | null;
  googleDocsUrl: string | null;
  overleafUrl?: string | null;
  comentariosJson?: string | null;
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

const CORES_MARCACAO: Record<
  CorMarcacao,
  {
    nome: string;
    dotClass: string;
    badgeClass: string;
    borderClass: string;
    quoteBgClass: string;
  }
> = {
  AZUL: {
    nome: "Leve",
    dotClass: "bg-blue-400 border-blue-600",
    badgeClass: "bg-blue-100 text-blue-900 border-blue-300",
    borderClass: "border-l-blue-400",
    quoteBgClass: "bg-blue-100/80 text-blue-950",
  },
  AMARELO: {
    nome: "Moderado",
    dotClass: "bg-yellow-400 border-yellow-600",
    badgeClass: "bg-yellow-100 text-yellow-900 border-yellow-300",
    borderClass: "border-l-yellow-400",
    quoteBgClass: "bg-yellow-100/80 text-yellow-950",
  },
  VERMELHO: {
    nome: "Grave",
    dotClass: "bg-red-400 border-red-600",
    badgeClass: "bg-red-100 text-red-900 border-red-300",
    borderClass: "border-l-red-400",
    quoteBgClass: "bg-red-100/80 text-red-950",
  },
  ROXO: {
    nome: "Alteração Opcional",
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
  const [comentariosJson, setComentariosJson] = useState<string | null>(
    producao.comentariosJson ?? null
  );
  const [salvando, startSalvando] = useTransition();
  const [sincronizando, startSincronizando] = useTransition();
  const [resolvendo, startResolvendo] = useTransition();
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<"editor" | "docs" | "overleaf">("editor");
  const [modificado, setModificado] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const initialHtmlRef = useRef(producao.conteudo || "<p><br></p>");

  // Sincroniza novos comentários/marcações do orientador em tempo real quando o aluno não tiver edições não salvas
  useEffect(() => {
    let montado = true;
    const interval = setInterval(async () => {
      try {
        const res = await obterComentariosProducaoAluno(producao.id);
        if (!montado) return;
        if (res.comentariosJson !== comentariosJson) {
          setComentariosJson(res.comentariosJson);
          if (!modificado && res.conteudo && editorRef.current) {
            setConteudo(res.conteudo);
            if (editorRef.current.innerHTML !== res.conteudo) {
              editorRef.current.innerHTML = res.conteudo;
            }
          }
        }
      } catch {
        // Silencioso no polling
      }
    }, 6000);
    return () => {
      montado = false;
      clearInterval(interval);
    };
  }, [producao.id, comentariosJson, modificado]);

  const listaComentarios = parseComentarios(comentariosJson);
  const comentariosPendentes = listaComentarios.filter((c) => !c.resolvido);
  const comentariosResolvidos = listaComentarios.filter((c) => c.resolvido);

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

  function handleResolverComentario(comentarioId: string) {
    startResolvendo(async () => {
      try {
        // Salva primeiro o texto atual caso tenha modificações locais
        if (modificado) {
          await atualizarConteudoProducao(producao.id, conteudo);
          setModificado(false);
        }
        const res = await resolverComentarioProducao(producao.id, comentarioId);
        setComentariosJson(JSON.stringify(res.comentarios));
        if (res.conteudo !== undefined && res.conteudo !== null) {
          setConteudo(res.conteudo);
          if (editorRef.current) {
            editorRef.current.innerHTML = res.conteudo;
          }
        }
        setMensagemSucesso("Comentário marcado como resolvido!");
        setTimeout(() => setMensagemSucesso(null), 3000);
      } catch {
        setMensagemErro("Não foi possível resolver o comentário.");
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
            <span>Voltar para Suas Produções</span>
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
                <span>Overleaf Vinculado</span>
              </span>
            )}
            {producao.googleDocsUrl && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 font-karla border border-blue-200">
                <svg className="h-3 w-3 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                </svg>
                <span>Google Docs Vinculado</span>
              </span>
            )}
            {!producao.overleafUrl && !producao.googleDocsUrl && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 font-karla border border-emerald-200">
                Editor Integrado
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold font-karla border ${
                comentariosPendentes.length > 0
                  ? "bg-amber-50 text-amber-800 border-amber-300"
                  : "bg-zinc-100 text-zinc-600 border-zinc-200"
              }`}
            >
              <span>{`${comentariosPendentes.length} ${
                comentariosPendentes.length === 1
                  ? "comentário para resolver"
                  : "comentários para resolver"
              }`}</span>
            </span>
          </div>
          {producao.venue && (
            <p className="text-xs text-zinc-500 font-spectral">
              <span>Publicação/Evento: </span>
              <span className="font-medium text-zinc-700">{producao.venue}</span>
              {producao.prazoSubmissao && (
                <span>{` · Prazo: ${formatarData(new Date(producao.prazoSubmissao))}`}</span>
              )}
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

      {/* Editor Principal + Painel de Marcações e Comentários do Orientador */}
      <div
        className={`grid gap-6 lg:grid-cols-[1fr_340px] items-start ${
          abaAtiva === "editor" || (!producao.googleDocsUrl && !producao.overleafUrl)
            ? ""
            : "hidden"
        }`}
      >
          {/* Coluna Esquerda: Editor */}
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
              dangerouslySetInnerHTML={{ __html: initialHtmlRef.current }}
              className="min-h-[520px] max-w-none p-6 sm:p-8 focus:outline-none font-spectral text-zinc-900 leading-relaxed text-base sm:text-lg prose prose-zinc selection:bg-[#133C1B]/20"
              data-placeholder="Comece a redigir seu artigo acadêmico aqui..."
            />

            {/* Rodapé do Editor */}
            <div className="flex flex-wrap items-center justify-between border-t border-zinc-200 bg-zinc-50/90 px-4 py-2.5 text-xs text-zinc-500 font-karla">
              <div className="flex items-center gap-4">
                <span>{`${contagemPalavras} palavras`}</span>
                <span>{`${contagemCaracteres} caracteres`}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${modificado ? "bg-amber-400" : "bg-emerald-500"}`}></span>
                <span>{modificado ? "Alterações não salvas" : "Tudo salvo"}</span>
              </div>
            </div>
          </div>

          {/* Coluna Direita: Painel de Marcações e Comentários do Orientador */}
          <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 font-karla">
                  Comentários do Orientador
                </h2>
                <p className="text-[11px] text-zinc-500 font-spectral">
                  Trechos marcados no seu artigo
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold font-karla border ${
                  comentariosPendentes.length > 0
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-zinc-100 text-zinc-600 border-zinc-200"
                }`}
              >
                {`${comentariosPendentes.length} pendente(s)`}
              </span>
            </div>

            {comentariosPendentes.length === 0 ? (
              <div className="py-6 text-center space-y-1">
                <p className="text-xs font-medium text-zinc-600 font-spectral">
                  Nenhum comentário pendente para resolver!
                </p>
                <p className="text-[11px] text-zinc-400 font-spectral">
                  Quando seu orientador destacar um trecho com cor (Leve, Moderado, Grave ou Alteração Opcional) e comentar, ele aparecerá aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {comentariosPendentes.map((c) => {
                  const corCfg = CORES_MARCACAO[c.cor] ?? CORES_MARCACAO.AZUL;
                  return (
                    <div
                      key={c.id}
                      className={`rounded-xl border border-zinc-200 border-l-4 ${corCfg.borderClass} bg-zinc-50/60 p-3.5 space-y-2`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold font-karla ${corCfg.badgeClass}`}>
                          <span className={`h-2 w-2 rounded-full ${corCfg.dotClass}`} />
                          Marcação {corCfg.nome}
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

                      <div className="flex justify-end pt-1 border-t border-zinc-200/60">
                        <button
                          type="button"
                          onClick={() => handleResolverComentario(c.id)}
                          disabled={resolvendo}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#133C1B] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1a4f24] transition-colors font-karla cursor-pointer disabled:opacity-50"
                        >
                          ✓ Marcar como resolvido
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {comentariosResolvidos.length > 0 && (
              <details className="pt-2 border-t border-zinc-100">
                <summary className="cursor-pointer text-xs font-semibold text-zinc-500 hover:text-zinc-800 font-karla">
                  {`Ver ${comentariosResolvidos.length} comentário(s) já resolvido(s)`}
                </summary>
                <div className="mt-2.5 space-y-2">
                  {comentariosResolvidos.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-zinc-100 bg-zinc-50 p-2.5 text-xs text-zinc-400 space-y-1"
                    >
                      <span className="font-semibold text-emerald-700 font-karla">✓ Resolvido</span>
                      <p className="italic line-clamp-1">&ldquo;{c.trecho}&rdquo;</p>
                      <p className="text-zinc-600">{c.comentario}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </aside>
        </div>
    </div>
  );
}

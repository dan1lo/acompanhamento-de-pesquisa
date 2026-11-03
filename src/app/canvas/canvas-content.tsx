"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  CanvasRegistro,
  CanvasDados,
  VersaoCanvasItem,
} from "@/lib/actions/canvas";
import {
  salvarCanvas,
  listarVersoesCanvas,
  restaurarVersaoCanvas,
} from "@/lib/actions/canvas";

interface CanvasContentProps {
  canvasInicial: CanvasRegistro;
  isAluno: boolean;
  orientandos?: Array<{ id: string; nome: string; nivel: string }>;
  alunoSelecionadoId?: string;
}

export function CanvasContent({
  canvasInicial,
  isAluno,
  orientandos = [],
  alunoSelecionadoId,
}: CanvasContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estados dos dados e baseline salva
  const [dados, setDados] = useState<CanvasDados>(canvasInicial.dados);
  const [dadosSalvos, setDadosSalvos] = useState<CanvasDados>(canvasInicial.dados);

  const [versaoAtual, setVersaoAtual] = useState(canvasInicial.versaoAtual);
  const [ultimaEdicaoNome, setUltimaEdicaoNome] = useState(canvasInicial.ultimaEdicaoPorNome);
  const [ultimaEdicaoPapel, setUltimaEdicaoPapel] = useState(canvasInicial.ultimaEdicaoPorPapel);
  const [atualizadoEm, setAtualizadoEm] = useState(canvasInicial.atualizadoEm);

  // Detecção de alterações pendentes (necessário apertar em salvar)
  const temAlteracoesPendentes = useMemo(() => {
    return JSON.stringify(dados) !== JSON.stringify(dadosSalvos);
  }, [dados, dadosSalvos]);

  // Alerta antes de fechar a página se houver alterações não salvas
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (temAlteracoesPendentes) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [temAlteracoesPendentes]);

  // Feedback e modais
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [descricaoVersao, setDescricaoVersao] = useState("");
  const [modalSalvarAberto, setModalSalvarAberto] = useState(false);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [versoes, setVersoes] = useState<VersaoCanvasItem[]>([]);
  const [carregandoVersoes, setCarregandoVersoes] = useState(false);
  const [versaoVisualizando, setVersaoVisualizando] = useState<VersaoCanvasItem | null>(null);

  const atualizarCampo = (campo: keyof CanvasDados, valor: string) => {
    setDados((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleSalvar = async (notaVersao?: string) => {
    setErro(null);
    setMensagemSucesso(null);

    startTransition(async () => {
      const res = await salvarCanvas(
        canvasInicial.alunoId,
        dados,
        notaVersao || descricaoVersao
      );

      if (res.ok) {
        setVersaoAtual(res.novaVersao);
        if (res.canvas) {
          setUltimaEdicaoNome(res.canvas.ultimaEdicaoPorNome);
          setUltimaEdicaoPapel(res.canvas.ultimaEdicaoPorPapel);
          setAtualizadoEm(res.canvas.atualizadoEm);
        }
        // Atualiza a baseline de dados salvos
        setDadosSalvos({ ...dados });
        setMensagemSucesso("Canvas salvo e atualizado com sucesso!");
        setModalSalvarAberto(false);
        setDescricaoVersao("");
        router.refresh();
        setTimeout(() => setMensagemSucesso(null), 4000);
      } else {
        setErro(res.erro || "Falha ao salvar canvas");
      }
    });
  };

  const handleDescartarAlteracoes = () => {
    if (!confirm("Deseja descartar todas as alterações não salvas?")) return;
    setDados({ ...dadosSalvos });
    setMensagemSucesso("Alterações descartadas.");
    setTimeout(() => setMensagemSucesso(null), 3000);
  };

  const abrirHistorico = async () => {
    setModalHistoricoAberto(true);
    setCarregandoVersoes(true);
    setVersaoVisualizando(null);
    try {
      const lista = await listarVersoesCanvas(canvasInicial.id);
      setVersoes(lista);
    } catch {
      setErro("Não foi possível carregar o histórico de versões.");
    } finally {
      setCarregandoVersoes(false);
    }
  };

  const handleRestaurarVersao = async (versao: VersaoCanvasItem) => {
    if (
      !confirm(
        `Tem certeza que deseja restaurar a Versão ${versao.versao}? Uma nova versão com esse conteúdo será salva.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await restaurarVersaoCanvas(versao.id);
      if (res.ok) {
        setDados(versao.dados);
        setDadosSalvos(versao.dados);
        setVersaoAtual(res.novaVersao);
        if (res.canvas) {
          setUltimaEdicaoNome(res.canvas.ultimaEdicaoPorNome);
          setUltimaEdicaoPapel(res.canvas.ultimaEdicaoPorPapel);
          setAtualizadoEm(res.canvas.atualizadoEm);
        }
        setModalHistoricoAberto(false);
        setMensagemSucesso(`Versão ${versao.versao} restaurada com sucesso!`);
        router.refresh();
        setTimeout(() => setMensagemSucesso(null), 4000);
      } else {
        setErro(res.erro || "Erro ao restaurar versão");
      }
    });
  };

  const handleMudarAluno = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (
      temAlteracoesPendentes &&
      !confirm("Você tem alterações não salvas. Deseja sair sem salvar?")
    ) {
      return;
    }
    const id = e.target.value;
    router.push(`/canvas?alunoId=${id}`);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Barra de Ações Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5 shadow-xs print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {!isAluno && orientandos.length > 0 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="select-aluno-canvas"
                className="text-xs font-bold text-zinc-600 uppercase tracking-wider font-karla"
              >
                Orientando:
              </label>
              <select
                id="select-aluno-canvas"
                value={alunoSelecionadoId || canvasInicial.alunoId}
                onChange={handleMudarAluno}
                className="text-xs sm:text-sm font-semibold border border-zinc-300 rounded-xl px-3 py-1.5 bg-white text-zinc-800 font-karla shadow-xs focus:border-[#133C1B] focus:ring-2 focus:ring-[#133C1B]/20 focus:outline-none cursor-pointer"
              >
                {orientandos.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome} ({o.nivel})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-zinc-600 bg-zinc-50 border border-zinc-200/80 px-3 py-1.5 rounded-xl font-karla">
            <span className="font-bold text-[#133C1B]">v{versaoAtual}</span>
            <span className="text-zinc-300">•</span>
            <span>
              Última edição por{" "}
              <strong className="text-zinc-800">
                {ultimaEdicaoNome} ({ultimaEdicaoPapel})
              </strong>
            </span>
          </div>

          {/* Indicador de Alterações Pendentes */}
          {temAlteracoesPendentes ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200 font-karla animate-pulse">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Alterações pendentes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200 font-karla">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              Salvo
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={abrirHistorico}
            className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-zinc-700 hover:bg-zinc-50 font-karla cursor-pointer shadow-xs transition-colors inline-flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4 text-zinc-500"
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
            Histórico de Versões
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-zinc-700 hover:bg-zinc-50 font-karla cursor-pointer shadow-xs transition-colors inline-flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.72 13.829c-.24-1.077-.665-2.072-1.246-2.946M3.25 18h17.5M6 20.25h12M12 3v12m0 0l3-3m-3 3l-3-3"
              />
            </svg>
            Imprimir / PDF
          </button>

          {/* Botão de Salvar Alterações Principal */}
          <button
            type="button"
            onClick={() => setModalSalvarAberto(true)}
            disabled={isPending || !temAlteracoesPendentes}
            className={`rounded-xl px-4 py-2 sm:px-5 sm:py-2 text-xs sm:text-sm font-bold font-karla shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer ${
              temAlteracoesPendentes
                ? "bg-[#133C1B] text-white hover:bg-[#133C1B]/90 active:scale-95 ring-2 ring-[#133C1B]/20"
                : "bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed"
            }`}
          >
            {isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Salvando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Salvar Alterações
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alertas de Sucesso / Erro */}
      {mensagemSucesso && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 font-spectral flex items-center justify-between shadow-2xs">
          <span>✓ {mensagemSucesso}</span>
          <button
            type="button"
            onClick={() => setMensagemSucesso(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {erro && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 font-spectral flex items-center justify-between shadow-2xs">
          <span className="inline-flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {erro}
          </span>
          <button
            type="button"
            onClick={() => setErro(null)}
            className="text-red-700 hover:text-red-950 font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* CABEÇALHO PARA IMPRESSÃO */}
      <div className="hidden print:block mb-6 border-b border-zinc-300 pb-4">
        <h1 className="text-2xl font-bold text-zinc-900 font-karla">
          Canvas de Pesquisa Acadêmica — Scholab
        </h1>
        <p className="text-sm text-zinc-600 font-spectral mt-1">
          Orientando: <strong>{canvasInicial.alunoNome}</strong> ({canvasInicial.nivel}) |
          Orientador: <strong>{canvasInicial.orientadorNome || "N/A"}</strong> |
          Versão: {versaoAtual} | Data: {atualizadoEm}
        </p>
      </div>

      {/* QUADRO DO CANVAS - 6 SEÇÕES PRINCIPAIS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
        {/* BLOCO 1: Tema & Problema de Pesquisa */}
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#133C1B]" />
              <h2 className="text-base font-bold text-zinc-900 font-karla">
                1. Tema &amp; Problema de Pesquisa
              </h2>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-karla">
              Fundação
            </span>
          </div>

          <div className="space-y-4 flex-1 flex flex-col">
            <div>
              <label
                htmlFor="canvas-tema"
                className="block text-xs font-bold text-zinc-700 uppercase tracking-wider font-karla mb-1.5"
              >
                Tema Delimitado:
              </label>
              <textarea
                id="canvas-tema"
                rows={3}
                value={dados.tema}
                onChange={(e) => atualizarCampo("tema", e.target.value)}
                placeholder="Ex: Aplicação de Modelos de Linguagem para Triagem em Prontuários Eletrônicos..."
                className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 font-spectral placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all shadow-xs resize-y"
              />
            </div>

            <div className="flex-1 flex flex-col">
              <label
                htmlFor="canvas-problema"
                className="block text-xs font-bold text-zinc-700 uppercase tracking-wider font-karla mb-1.5"
              >
                Problema de Pesquisa (Pergunta Central):
              </label>
              <textarea
                id="canvas-problema"
                rows={4}
                value={dados.problema}
                onChange={(e) => atualizarCampo("problema", e.target.value)}
                placeholder="Qual o problema prático ou teórico a ser investigado? Formule a pergunta principal de pesquisa..."
                className="w-full flex-1 rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 font-spectral placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all shadow-xs resize-y"
              />
            </div>
          </div>
        </section>

        {/* BLOCO 2: Objetivos de Pesquisa */}
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <h2 className="text-base font-bold text-zinc-900 font-karla">
                2. Objetivos de Pesquisa
              </h2>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-karla">
              Direção
            </span>
          </div>

          <div className="space-y-4 flex-1 flex flex-col">
            <div>
              <label
                htmlFor="canvas-obj-gerais"
                className="block text-xs font-bold text-zinc-700 uppercase tracking-wider font-karla mb-1.5"
              >
                Objetivo Geral:
              </label>
              <textarea
                id="canvas-obj-gerais"
                rows={3}
                value={dados.objetivosGerais}
                onChange={(e) => atualizarCampo("objetivosGerais", e.target.value)}
                placeholder="Ex: Desenvolver e avaliar um pipeline de sumarização automatizada..."
                className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 font-spectral placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all shadow-xs resize-y"
              />
            </div>

            <div className="flex-1 flex flex-col">
              <label
                htmlFor="canvas-obj-especificos"
                className="block text-xs font-bold text-zinc-700 uppercase tracking-wider font-karla mb-1.5"
              >
                Objetivos Específicos:
              </label>
              <textarea
                id="canvas-obj-especificos"
                rows={4}
                value={dados.objetivosEspecificos}
                onChange={(e) => atualizarCampo("objetivosEspecificos", e.target.value)}
                placeholder="1. Mapear o estado da arte;&#10;2. Coletar e pré-processar os dados;&#10;3. Executar testes comparativos;&#10;4. Avaliar métricas com especialistas..."
                className="w-full flex-1 rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 font-spectral placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all shadow-xs resize-y"
              />
            </div>
          </div>
        </section>

        {/* BLOCO 3: Hipóteses & Questões Norteadoras */}
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
              <h2 className="text-base font-bold text-zinc-900 font-karla">
                3. Hipóteses &amp; Questões Norteadoras
              </h2>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-karla">
              Premissas
            </span>
          </div>

          <div className="flex-1 flex flex-col">
            <label
              htmlFor="canvas-hipoteses"
              className="block text-xs font-bold text-zinc-700 uppercase tracking-wider font-karla mb-1.5"
            >
              Hipóteses de Trabalho / Questões de Investigação:
            </label>
            <textarea
              id="canvas-hipoteses"
              rows={7}
              value={dados.hipoteses}
              onChange={(e) => atualizarCampo("hipoteses", e.target.value)}
              placeholder="H1: Modelos pré-treinados no domínio médico reduzem o tempo de análise em pelo menos 30% sem perda de precisão.&#10;H2: A validação em múltiplos prontuários garante consistência semântica..."
              className="w-full flex-1 rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 font-spectral placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all shadow-xs resize-y"
            />
          </div>
        </section>

        {/* BLOCO 4: Metodologia & Procedimentos */}
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
              <h2 className="text-base font-bold text-zinc-900 font-karla">
                4. Metodologia &amp; Procedimentos
              </h2>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-karla">
              Execução
            </span>
          </div>

          <div className="flex-1 flex flex-col">
            <label
              htmlFor="canvas-metodologia"
              className="block text-xs font-bold text-zinc-700 uppercase tracking-wider font-karla mb-1.5"
            >
              Abordagem, Coleta de Dados e Instrumentos de Análise:
            </label>
            <textarea
              id="canvas-metodologia"
              rows={7}
              value={dados.metodologia}
              onChange={(e) => atualizarCampo("metodologia", e.target.value)}
              placeholder="Natureza da pesquisa (quantitativa, qualitativa, mista), ferramentas utilizadas, critérios de amostragem, protocolo experimental e métodos estatísticos..."
              className="w-full flex-1 rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 font-spectral placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all shadow-xs resize-y"
            />
          </div>
        </section>

        {/* BLOCO 5: Mapa de Lacunas Bibliográficas & Referências-Chave */}
        <section className="lg:col-span-2 rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
              <h2 className="text-base font-bold text-zinc-900 font-karla">
                5. Lacunas Bibliográficas &amp; Referências-Chave
              </h2>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-karla">
              Literatura
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1">
            <div className="flex flex-col">
              <label
                htmlFor="canvas-lacunas"
                className="block text-xs font-bold text-zinc-700 uppercase tracking-wider font-karla mb-1.5"
              >
                Mapa de Lacunas Bibliográficas:
              </label>
              <textarea
                id="canvas-lacunas"
                rows={5}
                value={dados.lacunasBibliograficas}
                onChange={(e) =>
                  atualizarCampo("lacunasBibliograficas", e.target.value)
                }
                placeholder="O que a literatura atual ainda não respondeu adequadamente? Onde o trabalho se diferencia?"
                className="w-full flex-1 rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 font-spectral placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all shadow-xs resize-y"
              />
            </div>

            <div className="flex flex-col">
              <label
                htmlFor="canvas-referencias"
                className="block text-xs font-bold text-zinc-700 uppercase tracking-wider font-karla mb-1.5"
              >
                Referências-Chave (Autores &amp; Obras Fundamentais):
              </label>
              <textarea
                id="canvas-referencias"
                rows={5}
                value={dados.referenciasChave}
                onChange={(e) =>
                  atualizarCampo("referenciasChave", e.target.value)
                }
                placeholder="Ex: Vaswani et al. (2017) - Attention is All You Need;&#10;Devlin et al. (2019) - BERT;&#10;Silva & Santos (2023) - Prontuários Inteligentes no SUS..."
                className="w-full flex-1 rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 font-spectral placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all shadow-xs resize-y"
              />
            </div>
          </div>
        </section>
      </div>

      {/* BARRA FLUTUANTE DE AVISO DE ALTERAÇÕES PENDENTES */}
      {temAlteracoesPendentes && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 border border-zinc-700 animate-slide-up print:hidden">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs sm:text-sm font-semibold font-karla">
              Você possui alterações não salvas no Canvas.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDescartarAlteracoes}
              disabled={isPending}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white font-karla cursor-pointer transition-colors"
            >
              Descartar
            </button>

            <button
              type="button"
              onClick={() => handleSalvar()}
              disabled={isPending}
              className="rounded-xl bg-[#133C1B] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#133C1B]/90 font-karla shadow-xs cursor-pointer transition-all active:scale-95"
            >
              {isPending ? "Salvando..." : "Salvar Agora"}
            </button>
          </div>
        </div>
      )}

      {/* MODAL SALVAR VERSÃO COM NOTA */}
      {modalSalvarAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) {
              setModalSalvarAberto(false);
            }
          }}
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-5 text-left">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-bold text-zinc-900 font-karla">
                Salvar Alterações no Canvas
              </h3>
              <button
                type="button"
                onClick={() => setModalSalvarAberto(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-zinc-600 font-spectral leading-relaxed">
              As alterações serão salvas e um novo registro histórico versionado será criado (Versão{" "}
              <strong>{versaoAtual + 1}</strong>). Você pode opcionalmente descrever um resumo das mudanças.
            </p>

            <div>
              <label
                htmlFor="modal-nota-versao"
                className="block text-xs font-bold text-zinc-700 uppercase tracking-wider font-karla mb-1.5"
              >
                Resumo da Alteração (opcional):
              </label>
              <textarea
                id="modal-nota-versao"
                rows={3}
                value={descricaoVersao}
                onChange={(e) => setDescricaoVersao(e.target.value)}
                placeholder="Ex: Ajustei os objetivos específicos e atualizei a lista de referências principais..."
                className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 font-spectral placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 transition-all shadow-xs"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setModalSalvarAberto(false)}
                disabled={isPending}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-700 hover:bg-zinc-50 font-karla cursor-pointer shadow-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSalvar(descricaoVersao)}
                disabled={isPending}
                className="rounded-xl bg-[#133C1B] px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#133C1B]/90 font-karla cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                {isPending ? "Salvando..." : "Confirmar e Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTÓRICO DE VERSÕES */}
      {modalHistoricoAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) {
              setModalHistoricoAberto(false);
            }
          }}
        >
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-5 text-left max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 font-karla">
                  Histórico de Versões do Canvas
                </h3>
                <p className="text-xs text-zinc-500 font-spectral">
                  Consulte os registros anteriores e restaure qualquer estado se necessário.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalHistoricoAberto(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {carregandoVersoes ? (
              <div className="py-12 text-center text-sm text-zinc-500 font-spectral flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin text-[#133C1B]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Carregando versões anteriores...
              </div>
            ) : versoes.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500 font-spectral">
                Ainda não há versões salvas no histórico.
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {versoes.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-xl border border-zinc-200/90 bg-zinc-50/70 p-4 hover:border-zinc-300 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#133C1B] bg-white border border-zinc-200 px-2.5 py-0.5 rounded-lg font-karla">
                          v{v.versao}
                        </span>
                        <span className="text-xs text-zinc-500 font-spectral">
                          {new Date(v.criadoEm).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="text-[11px] font-bold text-[#133C1B] bg-[#133C1B]/10 px-2 py-0.5 rounded-full font-karla">
                          {v.editadoPorNome} ({v.editadoPorPapel})
                        </span>
                      </div>
                      <p className="text-xs text-zinc-700 font-spectral italic">
                        {v.descricao || "Sem descrição informada"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setVersaoVisualizando(
                            versaoVisualizando?.id === v.id ? null : v
                          )
                        }
                        className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 font-karla cursor-pointer shadow-2xs transition-colors"
                      >
                        {versaoVisualizando?.id === v.id
                          ? "Ocultar detalhes"
                          : "Ver detalhes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRestaurarVersao(v)}
                        disabled={isPending}
                        className="rounded-xl bg-[#133C1B] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#133C1B]/90 font-karla cursor-pointer shadow-2xs transition-all active:scale-95 disabled:opacity-50"
                      >
                        Restaurar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Visualização de snapshot da versão selecionada */}
            {versaoVisualizando && (
              <div className="rounded-xl bg-zinc-100 border border-zinc-200 p-4 space-y-2 text-xs text-zinc-800 font-spectral max-h-48 overflow-y-auto">
                <div className="font-bold text-zinc-900 text-sm font-karla border-b border-zinc-200 pb-1">
                  Snapshot da Versão {versaoVisualizando.versao}:
                </div>
                <div>
                  <strong>Tema:</strong> {versaoVisualizando.dados.tema || "—"}
                </div>
                <div>
                  <strong>Problema:</strong> {versaoVisualizando.dados.problema || "—"}
                </div>
                <div>
                  <strong>Objetivos Gerais:</strong> {versaoVisualizando.dados.objetivosGerais || "—"}
                </div>
                <div>
                  <strong>Metodologia:</strong> {versaoVisualizando.dados.metodologia || "—"}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setModalHistoricoAberto(false)}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-700 hover:bg-zinc-50 font-karla cursor-pointer shadow-xs transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

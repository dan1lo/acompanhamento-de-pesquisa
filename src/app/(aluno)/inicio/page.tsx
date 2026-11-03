import Link from "next/link";
import { requireAluno } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { buscarProximaReuniaoDoAluno } from "@/lib/dados-alunos";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { garantirTabelasRoadmap } from "@/lib/actions/roadmap";
import { buscarExtrasProducoes } from "@/lib/actions/producao";
import { CheckinForm } from "./checkin-form";

function SleepyFaceIcon({ className = "h-24 w-24" }: { className?: string }) {
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

interface MarcacaoOrientadorItem {
  id: string;
  producaoId: string;
  producaoTitulo: string;
  trechoCitado: string;
  comentarioOrientador: string;
  cor: "AZUL" | "AMARELO" | "VERMELHO" | "ROXO";
  criadoEm: string;
}

interface ItemPrazoProximo {
  id: string;
  tipo: "ATIVIDADE" | "SUBTAREFA" | "PRODUCAO";
  titulo: string;
  contexto?: string;
  prazo: string; // YYYY-MM-DD ou formatada
  prazoDate: Date;
  diasRestantes: number;
  link: string;
  status?: string;
}

const ROTULOS_SEVERIDADE: Record<
  string,
  { rotulo: string; badgeClass: string; dotClass: string }
> = {
  VERMELHO: {
    rotulo: "Grave / Correção Necessária",
    badgeClass: "bg-red-50 text-red-800 border-red-200",
    dotClass: "bg-red-500",
  },
  AMARELO: {
    rotulo: "Moderado / Revisão Sugerida",
    badgeClass: "bg-yellow-50 text-yellow-800 border-yellow-200",
    dotClass: "bg-yellow-500",
  },
  AZUL: {
    rotulo: "Leve / Ajuste de Texto",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
    dotClass: "bg-blue-500",
  },
  ROXO: {
    rotulo: "Opcional / Sugestão",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
    dotClass: "bg-purple-500",
  },
};

export default async function InicioAlunoPage() {
  const { aluno, temOrientador } = await requireAluno();

  if (!temOrientador) {
    return (
      <div className="relative min-h-[calc(100vh-10rem)] flex flex-col pb-24 text-left">
        <div className="flex flex-1 flex-col items-center justify-center py-20 sm:py-28 text-center my-auto">
          <SleepyFaceIcon className="h-24 w-24 sm:h-28 sm:w-28 drop-shadow-xs transition-transform hover:scale-105 duration-300" />
          <p className="mt-5 text-base sm:text-lg font-medium text-zinc-600 font-spectral">
            Não tem nada aqui, pode ir dormir
          </p>
        </div>
      </div>
    );
  }

  await garantirTabelasRoadmap();

  // 1. Dados do aluno completos com orientador
  const alunoDados = await prisma.aluno.findUnique({
    where: { id: aluno.id },
    include: {
      orientador: {
        select: {
          nome: true,
          email: true,
        },
      },
    },
  });

  // 2. Próxima reunião
  const proximaReuniao = await buscarProximaReuniaoDoAluno(aluno.id);

  // 3. Atividades do Quadro de Atividades (marco_roadmap)
  const marcos = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM marco_roadmap WHERE "alunoId" = $1 ORDER BY ordem ASC, "prazoPlanejado" ASC;`,
    aluno.id
  );

  // Subtarefas vinculadas ao aluno
  const subtarefasAluno = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, titulo, prazo, status, "marcoId" FROM tarefa WHERE "alunoId" = $1;`,
    aluno.id
  );

  // Mapeia subtarefas por atividade
  const subtarefasPorMarco = new Map<string, any[]>();
  for (const st of subtarefasAluno) {
    if (st.marcoId) {
      const lista = subtarefasPorMarco.get(st.marcoId) ?? [];
      lista.push(st);
      subtarefasPorMarco.set(st.marcoId, lista);
    }
  }

  // Identifica a Atividade Atual
  let atividadeAtual = marcos.find((m) => m.status === "EM_ANDAMENTO");
  if (!atividadeAtual) {
    atividadeAtual = marcos.find((m) => m.status !== "CONCLUIDO");
  }
  if (!atividadeAtual && marcos.length > 0) {
    // Se todas concluídas, pega a última
    atividadeAtual = marcos[marcos.length - 1];
  }

  // Estatísticas do Quadro de Atividades
  const totalMarcos = marcos.length;
  const marcosConcluidos = marcos.filter((m) => m.status === "CONCLUIDO").length;
  const somaPorcentagens = marcos.reduce((acc, m) => acc + (Number(m.porcentagem) || 0), 0);
  const porcentagemGeral = totalMarcos > 0 ? Math.round(somaPorcentagens / totalMarcos) : 0;

  // Subtarefas da atividade atual
  const subtarefasAtividadeAtual = atividadeAtual
    ? subtarefasPorMarco.get(atividadeAtual.id) ?? []
    : [];
  const subtarefasConcluidas = subtarefasAtividadeAtual.filter(
    (st) => st.status === "CONCLUIDA"
  ).length;

  // 4. Novas Marcações do Orientador nas Produções Acadêmicas
  const producoes = await prisma.producaoAcademica.findMany({
    where: { alunoId: aluno.id },
    select: {
      id: true,
      titulo: true,
      prazoSubmissao: true,
      status: true,
    },
    orderBy: { atualizadoEm: "desc" },
  });

  const extrasProducoes = await buscarExtrasProducoes(
    producoes.map((p) => p.id)
  );

  const marcacoesPendentes: MarcacaoOrientadorItem[] = [];
  for (const prod of producoes) {
    const comentariosJson = extrasProducoes[prod.id]?.comentariosJson;
    if (comentariosJson) {
      try {
        const parsed = JSON.parse(comentariosJson);
        if (Array.isArray(parsed)) {
          for (const c of parsed) {
            if (!c.resolvido) {
              marcacoesPendentes.push({
                id: c.id,
                producaoId: prod.id,
                producaoTitulo: `${prod.titulo}${
                  c.pagina ? ` · Pág. ${c.pagina}` : ""
                }`,
                trechoCitado: c.trecho || c.trechoCitado || "",
                comentarioOrientador:
                  c.comentario || c.comentarioOrientador || "",
                cor: c.cor || "AMARELO",
                criadoEm: c.criadoEm || new Date().toISOString(),
              });
            }
          }
        }
      } catch {}
    }
  }

  // Ordena marcações: mais recentes primeiro
  marcacoesPendentes.sort(
    (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
  );

  // 5. Atividades e Produções perto do prazo de término (ou atrasadas)
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  function getDiasRestantes(dataRef: Date): number {
    const d = new Date(dataRef);
    d.setHours(0, 0, 0, 0);
    const diffTime = d.getTime() - hoje.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  const itensPrazo: ItemPrazoProximo[] = [];

  // a) Atividades do Quadro de Atividades não concluídas
  for (const m of marcos) {
    if (m.status !== "CONCLUIDO" && m.prazoPlanejado) {
      const prazoDate = new Date(m.prazoPlanejado);
      const dias = getDiasRestantes(prazoDate);
      // Pega atrasadas ou que vencem em até 20 dias
      if (dias <= 20) {
        itensPrazo.push({
          id: m.id,
          tipo: "ATIVIDADE",
          titulo: m.titulo,
          contexto: m.fase ? `Fase: ${m.fase}` : "Quadro de Atividades",
          prazo: formatarData(prazoDate),
          prazoDate,
          diasRestantes: dias,
          link: "/roadmap",
          status: m.status,
        });
      }
    }
  }

  // b) Subtarefas abertas com prazo
  for (const st of subtarefasAluno) {
    if (st.status === "ABERTA" && st.prazo) {
      const prazoDate = new Date(st.prazo);
      const dias = getDiasRestantes(prazoDate);
      if (dias <= 15) {
        itensPrazo.push({
          id: st.id,
          tipo: "SUBTAREFA",
          titulo: st.titulo,
          contexto: "Subtarefa / Entrega",
          prazo: formatarData(prazoDate),
          prazoDate,
          diasRestantes: dias,
          link: "/roadmap",
        });
      }
    }
  }

  // c) Produções acadêmicas com prazo de submissão
  for (const prod of producoes) {
    if (
      prod.prazoSubmissao &&
      prod.status !== "PUBLICADO" &&
      prod.status !== "ACEITO"
    ) {
      const prazoDate = new Date(prod.prazoSubmissao);
      const dias = getDiasRestantes(prazoDate);
      if (dias <= 30) {
        itensPrazo.push({
          id: prod.id,
          tipo: "PRODUCAO",
          titulo: prod.titulo,
          contexto: "Submissão de Paper / Artigo",
          prazo: formatarData(prazoDate),
          prazoDate,
          diasRestantes: dias,
          link: `/producao/${prod.id}`,
        });
      }
    }
  }

  // Ordena por dias restantes (os mais atrasados e os mais próximos primeiro)
  itensPrazo.sort((a, b) => a.diasRestantes - b.diasRestantes);

  // Formata a data atual por extenso
  const dataHojeExtenso = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const nomeAlunoPrimeiro = aluno.nome.split(" ")[0];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16 font-spectral text-left">
      {/* 1. MENSAGEM DE BEM-VINDO */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-200/90 bg-gradient-to-br from-white via-zinc-50/50 to-emerald-50/20 p-6 sm:p-8 shadow-xs">
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#133C1B] px-3 py-0.5 text-xs font-semibold text-white font-karla tracking-wide">
              {aluno.nivel}
            </span>
            <span className="text-xs text-zinc-500 font-karla capitalize">
              {dataHojeExtenso}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 font-karla tracking-tight">
            Bem-vindo de volta, {nomeAlunoPrimeiro}!
          </h1>

          <p className="text-sm sm:text-base text-zinc-600 font-spectral leading-relaxed">
            {aluno.tema ? (
              <>
                Pesquisa: <strong className="text-zinc-800 font-medium">“{aluno.tema}”</strong>
              </>
            ) : (
              "Acompanhe o andamento da sua pesquisa, anotações do seu orientador e os próximos prazos."
            )}
          </p>

          {alunoDados?.orientador?.nome && (
            <p className="text-xs text-zinc-500 font-spectral">
              Orientado por:{" "}
              <span className="font-semibold text-zinc-700 font-karla">
                {alunoDados.orientador.nome}
              </span>{" "}
              ({alunoDados.orientador.email})
            </p>
          )}
        </div>
      </section>

      {/* Grid Principal: 2 Colunas */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* COLUNA ESQUERDA (2 Colunas no Desktop) */}
        <div className="lg:col-span-2 space-y-8">
          {/* 2. PROGRESSO DA ATIVIDADE ATUAL */}
          <section className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-xs space-y-5 text-left">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[#138A07] border border-emerald-200/60">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 font-karla">
                    Progresso da Atividade Atual
                  </h2>
                  <p className="text-xs text-zinc-500 font-spectral">
                    Etapa em foco no seu Quadro de Atividades
                  </p>
                </div>
              </div>

              <Link
                href="/roadmap"
                className="text-xs font-semibold text-[#133C1B] hover:underline font-karla inline-flex items-center gap-1"
              >
                <span>Ver Quadro Completo</span>
                <span>→</span>
              </Link>
            </div>

            {atividadeAtual ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold font-karla border ${
                          atividadeAtual.status === "CONCLUIDO"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : atividadeAtual.status === "EM_ANDAMENTO"
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : "bg-zinc-100 text-zinc-700 border-zinc-200"
                        }`}
                      >
                        {atividadeAtual.status === "CONCLUIDO"
                          ? "Concluído"
                          : atividadeAtual.status === "EM_ANDAMENTO"
                          ? "Em Redação / Andamento"
                          : "A Iniciar"}
                      </span>
                      {atividadeAtual.fase && (
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 font-karla">
                          {atividadeAtual.fase}
                        </span>
                      )}
                      {atividadeAtual.estimativaPaginas && (
                        <span className="text-xs text-zinc-500 font-spectral">
                          Estimativa: {atividadeAtual.estimativaPaginas}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-zinc-900 font-karla pt-1">
                      {atividadeAtual.titulo}
                    </h3>

                    {atividadeAtual.descricao && (
                      <p className="text-xs sm:text-sm text-zinc-600 font-spectral leading-relaxed line-clamp-2">
                        {atividadeAtual.descricao}
                      </p>
                    )}
                  </div>

                  {atividadeAtual.prazoPlanejado && (
                    <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 px-3 py-2 text-right shrink-0">
                      <span className="block text-[10px] uppercase font-semibold text-zinc-400 font-karla">
                        Prazo Planejado
                      </span>
                      <span className="block text-xs font-bold text-zinc-800 font-karla mt-0.5">
                        {formatarData(new Date(atividadeAtual.prazoPlanejado))}
                      </span>
                      {(() => {
                        const dias = getDiasRestantes(new Date(atividadeAtual.prazoPlanejado));
                        return (
                          <span
                            className={`block text-[10px] font-semibold font-karla mt-0.5 ${
                              dias < 0
                                ? "text-red-600"
                                : dias <= 3
                                ? "text-amber-600"
                                : "text-emerald-700"
                            }`}
                          >
                            {dias < 0
                              ? `Atrasado há ${Math.abs(dias)}d`
                              : dias === 0
                              ? "Vence hoje"
                              : `Restam ${dias}d`}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Subtarefas associadas */}
                {subtarefasAtividadeAtual.length > 0 && (
                  <div className="rounded-xl bg-zinc-50/80 border border-zinc-200/70 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-karla">
                      <span className="font-semibold text-zinc-700">
                        Subtarefas Desta Atividade:
                      </span>
                      <span className="text-zinc-500 font-medium">
                        {subtarefasConcluidas} de {subtarefasAtividadeAtual.length} concluídas
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {subtarefasAtividadeAtual.slice(0, 3).map((st) => (
                        <div
                          key={st.id}
                          className="flex items-center justify-between text-xs font-spectral bg-white rounded-lg p-2 border border-zinc-200/50"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                st.status === "CONCLUIDA" ? "bg-emerald-500" : "bg-amber-400"
                              }`}
                            />
                            <span
                              className={`${
                                st.status === "CONCLUIDA"
                                  ? "line-through text-zinc-400"
                                  : "text-zinc-800 font-medium"
                              }`}
                            >
                              {st.titulo}
                            </span>
                          </div>
                          {st.prazo && (
                            <span className="text-[11px] text-zinc-400 font-karla">
                              {formatarData(new Date(st.prazo))}
                            </span>
                          )}
                        </div>
                      ))}
                      {subtarefasAtividadeAtual.length > 3 && (
                        <p className="text-[11px] text-zinc-500 text-center font-karla pt-1">
                          + {subtarefasAtividadeAtual.length - 3} outra(s) subtarefa(s) no Quadro
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <Link
                    href="/roadmap"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#133C1B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1a4f24] active:scale-95 transition-all font-karla shadow-xs"
                  >
                    <span>Atualizar Progresso no Quadro</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center space-y-3">
                <p className="text-sm text-zinc-600 font-spectral">
                  Você ainda não possui atividades cadastradas no seu Quadro de Atividades.
                </p>
                <Link
                  href="/roadmap"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#133C1B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1a4f24] transition-all font-karla"
                >
                  Criar Atividades da Pesquisa →
                </Link>
              </div>
            )}
          </section>

          {/* 3. NOVAS MARCAÇÕES DO ORIENTADOR */}
          <section className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-xs space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 font-karla">
                    Novas Marcações do Orientador
                  </h2>
                  <p className="text-xs text-zinc-500 font-spectral">
                    Observações e revisões pendentes nos seus artigos acadêmicos
                  </p>
                </div>
              </div>

              {marcacoesPendentes.length > 0 && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 font-karla border border-amber-200">
                  {marcacoesPendentes.length}{" "}
                  {marcacoesPendentes.length === 1 ? "anotação" : "anotações"}
                </span>
              )}
            </div>

            {marcacoesPendentes.length === 0 ? (
              <div className="rounded-xl bg-zinc-50/70 border border-zinc-200/60 p-6 text-center space-y-1.5">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-[#138A07] mb-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-zinc-800 font-karla">
                  Tudo em dia com o orientador!
                </p>
                <p className="text-xs text-zinc-500 font-spectral max-w-md mx-auto">
                  Nenhuma marcação ou comentário pendente de resolução nos seus artigos. Quando o orientador destacar trechos ou sugerir revisões, elas aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {marcacoesPendentes.slice(0, 4).map((m) => {
                  const conf = ROTULOS_SEVERIDADE[m.cor] || ROTULOS_SEVERIDADE.AMARELO;
                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2.5 hover:border-zinc-300 transition-colors shadow-2xs text-left"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold font-karla border ${conf.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${conf.dotClass}`} />
                            <span>{conf.rotulo}</span>
                          </span>
                          <span className="text-xs font-semibold text-zinc-700 font-karla truncate max-w-[200px] sm:max-w-xs">
                            {m.producaoTitulo}
                          </span>
                        </div>

                        <span className="text-[11px] text-zinc-400 font-karla">
                          {formatarDataHora(new Date(m.criadoEm))}
                        </span>
                      </div>

                      {/* Trecho anotado */}
                      {m.trechoCitado && (
                        <blockquote className="rounded-lg bg-zinc-50 border-l-2 border-zinc-300 px-3 py-1.5 text-xs italic text-zinc-600 font-spectral">
                          “{m.trechoCitado}”
                        </blockquote>
                      )}

                      {/* Comentário do Orientador */}
                      <p className="text-xs text-zinc-800 font-spectral leading-relaxed">
                        <strong className="text-zinc-900 font-karla">Orientador: </strong>
                        {m.comentarioOrientador}
                      </p>

                      <div className="flex justify-end pt-1">
                        <Link
                          href={`/producao/${m.producaoId}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#133C1B] hover:underline font-karla"
                        >
                          <span>Revisar no Editor</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}

                {marcacoesPendentes.length > 4 && (
                  <div className="text-center pt-2">
                    <Link
                      href="/producao"
                      className="text-xs font-semibold text-[#133C1B] hover:underline font-karla"
                    >
                      Ver todas as {marcacoesPendentes.length} marcações nas produções →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 4. ATIVIDADES / PRODUÇÕES PERTO DO PRAZO DE TÉRMINO */}
          <section className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-xs space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-700 border border-red-200/60">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 font-karla">
                    Prazos Próximos & Entregas
                  </h2>
                  <p className="text-xs text-zinc-500 font-spectral">
                    Atividades do quadro, subtarefas e submissões com vencimento iminente
                  </p>
                </div>
              </div>

              {itensPrazo.length > 0 && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 font-karla border border-zinc-200">
                  {itensPrazo.length} {itensPrazo.length === 1 ? "prazo" : "prazos"}
                </span>
              )}
            </div>

            {itensPrazo.length === 0 ? (
              <div className="rounded-xl bg-zinc-50/70 border border-zinc-200/60 p-6 text-center space-y-1">
                <p className="text-sm font-semibold text-zinc-800 font-karla">
                  Nenhum prazo urgente se aproximando!
                </p>
                <p className="text-xs text-zinc-500 font-spectral">
                  Você não tem atividades do quadro ou produções vencendo nos próximos 15 dias.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {itensPrazo.slice(0, 5).map((item) => {
                  const atrasado = item.diasRestantes < 0;
                  const hoje = item.diasRestantes === 0;
                  const urgente = item.diasRestantes > 0 && item.diasRestantes <= 3;

                  return (
                    <div
                      key={`${item.tipo}-${item.id}`}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl border border-zinc-200/90 bg-white p-3.5 gap-3 hover:border-zinc-300 transition-colors shadow-2xs text-left"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 font-karla">
                            {item.tipo === "ATIVIDADE"
                              ? "Quadro de Atividades"
                              : item.tipo === "SUBTAREFA"
                              ? "Subtarefa"
                              : "Submissão de Paper"}
                          </span>
                          {item.contexto && (
                            <span className="text-[11px] text-zinc-500 font-spectral">
                              · {item.contexto}
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-bold text-zinc-900 font-karla truncate">
                          {item.titulo}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100">
                        <div className="text-left sm:text-right">
                          <span className="block text-[11px] text-zinc-400 font-karla">
                            Prazo: {item.prazo}
                          </span>
                          <span
                            className={`block text-xs font-bold font-karla ${
                              atrasado
                                ? "text-red-700"
                                : hoje
                                ? "text-red-600 animate-pulse"
                                : urgente
                                ? "text-amber-700"
                                : "text-zinc-600"
                            }`}
                          >
                            {atrasado
                              ? `Atrasado há ${Math.abs(item.diasRestantes)} ${
                                  Math.abs(item.diasRestantes) === 1 ? "dia" : "dias"
                                }`
                              : hoje
                              ? "Termina hoje!"
                              : item.diasRestantes === 1
                              ? "Termina amanhã"
                              : `Em ${item.diasRestantes} dias`}
                          </span>
                        </div>

                        <Link
                          href={item.link}
                          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 font-karla transition-colors"
                        >
                          Ver →
                        </Link>
                      </div>
                    </div>
                  );
                })}

                {itensPrazo.length > 5 && (
                  <div className="text-center pt-1">
                    <Link
                      href="/roadmap"
                      className="text-xs font-semibold text-[#133C1B] hover:underline font-karla"
                    >
                      Ver todos os prazos no cronograma →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* COLUNA DIREITA (1 Coluna no Desktop) */}
        <div className="space-y-6">
          {/* CARD: PRÓXIMA REUNIÃO & CHECK-IN */}
          <section className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-xs space-y-4 text-left">
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200/60">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 font-karla">
                  Próxima Reunião
                </h2>
                <p className="text-xs text-zinc-500 font-spectral">
                  Com seu orientador de pesquisa
                </p>
              </div>
            </div>

            {proximaReuniao ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-50/50 border border-emerald-200/70 p-4 space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#138A07] font-karla block">
                    Agendada com sucesso
                  </span>
                  <p className="text-sm font-bold text-zinc-900 font-karla">
                    {formatarDataHora(proximaReuniao.data)}
                  </p>
                  {proximaReuniao.meetLink && (
                    <a
                      href={proximaReuniao.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline font-karla pt-1"
                    >
                      <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5zm4 4h-2v-6h2v6zm0-8h-2V7h2v2z" />
                      </svg>
                      <span>Entrar no Google Meet ↗</span>
                    </a>
                  )}
                </div>

                {/* Formulário de Check-in */}
                <div className="border-t border-zinc-100 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 font-karla">
                      Check-in Pré-reunião
                    </span>
                    {proximaReuniao.checkin?.preenchidoEm && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-karla">
                        Enviado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 font-spectral mb-3">
                    Compartilhe com seu orientador o que foi realizado, dúvidas e bloqueios para otimizar o encontro.
                  </p>
                  <CheckinForm
                    reuniaoId={proximaReuniao.id}
                    valores={
                      proximaReuniao.checkin
                        ? {
                            oQueFez: proximaReuniao.checkin.oQueFez,
                            duvidas: proximaReuniao.checkin.duvidas,
                            bloqueios: proximaReuniao.checkin.bloqueios,
                          }
                        : null
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-200 p-5 text-center space-y-3">
                <p className="text-xs text-zinc-500 font-spectral">
                  Nenhuma reunião agendada no momento.
                </p>
                <Link
                  href="/agendar"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#133C1B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1a4f24] font-karla shadow-xs"
                >
                  Agendar com Orientador →
                </Link>
              </div>
            )}
          </section>

          {/* CARD: ATALHOS RÁPIDOS DA PESQUISA */}
          <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-xs space-y-3 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-karla">
              Acesso Rápido
            </h3>
            <div className="grid gap-2 text-xs font-karla font-semibold">
              <Link
                href="/roadmap"
                className="flex items-center justify-between rounded-xl bg-zinc-50 p-2.5 text-zinc-800 hover:bg-emerald-50 hover:text-[#133C1B] transition-colors border border-zinc-200/60"
              >
                <span>Quadro de Atividades</span>
                <span>→</span>
              </Link>
              <Link
                href="/canvas"
                className="flex items-center justify-between rounded-xl bg-zinc-50 p-2.5 text-zinc-800 hover:bg-emerald-50 hover:text-[#133C1B] transition-colors border border-zinc-200/60"
              >
                <span>Canvas de Pesquisa</span>
                <span>→</span>
              </Link>
              <Link
                href="/producao"
                className="flex items-center justify-between rounded-xl bg-zinc-50 p-2.5 text-zinc-800 hover:bg-emerald-50 hover:text-[#133C1B] transition-colors border border-zinc-200/60"
              >
                <span>Produção Científica</span>
                <span>→</span>
              </Link>
              <Link
                href="/reunioes"
                className="flex items-center justify-between rounded-xl bg-zinc-50 p-2.5 text-zinc-800 hover:bg-emerald-50 hover:text-[#133C1B] transition-colors border border-zinc-200/60"
              >
                <span>Histórico de Reuniões</span>
                <span>→</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

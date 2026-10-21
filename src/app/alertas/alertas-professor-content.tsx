"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatarDataHora } from "@/lib/datas";
import {
  resolverAlerta,
  resolverTodosAlertasProfessor,
  gerarAlertasAgora,
} from "@/lib/actions/alertas";
import {
  aceitarConviteReuniao,
  recusarConviteReuniao,
} from "@/lib/actions/calendario";

export interface AlertaProfessorItem {
  id: string;
  conviteReuniaoId?: string;
  tipo: string;
  tipoRotulo: string;
  mensagem: string;
  criadoEm: string;
  resolvido: boolean;
  alunoId: string;
  alunoNome: string;
}

const ESTILOS_TIPO: Record<
  string,
  {
    borderClass: string;
    badgeClass: string;
    dotClass: string;
  }
> = {
  DIAS_SEM_REUNIAO: {
    borderClass: "border-l-amber-500",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-200",
    dotClass: "bg-amber-500",
  },
  TAREFA_ATRASADA: {
    borderClass: "border-l-red-500",
    badgeClass: "bg-red-100 text-red-900 border-red-200",
    dotClass: "bg-red-500",
  },
  PRAZO_PROXIMO: {
    borderClass: "border-l-yellow-400",
    badgeClass: "bg-yellow-100 text-yellow-900 border-yellow-200",
    dotClass: "bg-yellow-500",
  },
  FALTA_SEM_AVISO: {
    borderClass: "border-l-red-500",
    badgeClass: "bg-red-100 text-red-900 border-red-200",
    dotClass: "bg-red-500",
  },
  CHECKIN_NAO_PREENCHIDO: {
    borderClass: "border-l-blue-500",
    badgeClass: "bg-blue-100 text-blue-900 border-blue-200",
    dotClass: "bg-blue-500",
  },
  CONVITE_REUNIAO: {
    borderClass: "border-l-[#133C1B]",
    badgeClass: "bg-emerald-100 text-[#133C1B] border-emerald-300",
    dotClass: "bg-[#138A07]",
  },
  RESPOSTA_CONVITE_REUNIAO: {
    borderClass: "border-l-blue-500",
    badgeClass: "bg-blue-50 text-blue-900 border-blue-200",
    dotClass: "bg-blue-500",
  },
};

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
        <text x="56" y="24" fontSize="15" fontWeight="bold">Z</text>
        <text x="65" y="16" fontSize="12" fontWeight="bold">z</text>
        <text x="71" y="9" fontSize="9" fontWeight="bold">z</text>
      </g>
    </svg>
  );
}

export function AlertasProfessorContent({
  alertasIniciais,
}: {
  alertasIniciais: AlertaProfessorItem[];
}) {
  const router = useRouter();
  const [alertas, setAlertas] = useState<AlertaProfessorItem[]>(alertasIniciais);
  const [filtro, setFiltro] = useState<"TODOS" | "PENDENTES" | "RESOLVIDOS">("PENDENTES");
  const [isPending, startTransition] = useTransition();
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Modal de recusa de convite de reunião
  const [alertaParaRecusar, setAlertaParaRecusar] = useState<AlertaProfessorItem | null>(null);
  const [justificativaRecusa, setJustificativaRecusa] = useState("");
  const [erroRecusa, setErroRecusa] = useState("");
  const [enviandoRecusa, setEnviandoRecusa] = useState(false);

  useEffect(() => {
    setAlertas(alertasIniciais);
  }, [alertasIniciais]);

  const pendentes = alertas.filter((a) => !a.resolvido);
  const resolvidos = alertas.filter((a) => a.resolvido);

  const alertasFiltrados =
    filtro === "PENDENTES"
      ? pendentes
      : filtro === "RESOLVIDOS"
      ? resolvidos
      : alertas;

  function handleResolverAlerta(alertaId: string) {
    setAlertas((prev) =>
      prev.map((a) => (a.id === alertaId ? { ...a, resolvido: true } : a))
    );
    startTransition(async () => {
      try {
        await resolverAlerta(alertaId);
      } catch {
        setAlertas(alertasIniciais);
      }
    });
  }

  function handleAceitarConviteReuniao(alerta: AlertaProfessorItem) {
    setAlertas((prev) =>
      prev.map((a) =>
        a.id === alerta.id
          ? { ...a, resolvido: true, mensagem: `${a.mensagem} (Convite aceito)` }
          : a
      )
    );
    startTransition(async () => {
      try {
        const res = await aceitarConviteReuniao(alerta.conviteReuniaoId ?? alerta.id);
        if (res.ok) {
          setMensagemSucesso("Convite de reunião aceito! A reunião foi agendada no calendário.");
          setTimeout(() => setMensagemSucesso(null), 4000);
          router.refresh();
        } else {
          setAlertas(alertasIniciais);
        }
      } catch {
        setAlertas(alertasIniciais);
      }
    });
  }

  function handleResolverTodos() {
    setAlertas((prev) =>
      prev.map((a) => (a.tipo === "CONVITE_REUNIAO" ? a : { ...a, resolvido: true }))
    );
    setMensagemSucesso("Todos os alertas foram marcados como lidos!");
    setTimeout(() => setMensagemSucesso(null), 3500);
    startTransition(async () => {
      try {
        await resolverTodosAlertasProfessor();
      } catch {
        setAlertas(alertasIniciais);
      }
    });
  }

  function handleGerarAlertasAgora() {
    startTransition(async () => {
      try {
        await gerarAlertasAgora();
        setMensagemSucesso("Alertas gerados e atualizados com sucesso!");
        setTimeout(() => setMensagemSucesso(null), 3500);
      } catch {
        // Silencioso
      }
    });
  }

  return (
    <div className="relative min-h-[calc(100vh-10rem)] flex flex-col pb-24 text-left">
      {/* Descrição da página alinhada à esquerda abaixo da topbar */}
      <div className="mb-6 sm:mb-8 text-left w-full">
        <p className="text-sm sm:text-base text-zinc-600 font-spectral leading-relaxed text-left">
          Acompanhe convites de reunião, dias sem reunião, tarefas atrasadas e prazos próximos dos seus orientandos.
        </p>
      </div>

      {mensagemSucesso && (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-sm text-emerald-800 font-spectral flex items-center justify-between animate-fade-in">
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

      {/* Barra de controle: Abas de filtro + Botões de ação */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-200/80 pb-4 mb-6">
        {/* Abas */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltro("PENDENTES")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold font-karla transition-all cursor-pointer ${
              filtro === "PENDENTES"
                ? "bg-[#133C1B] text-white shadow-xs"
                : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {`Pendentes (${pendentes.length})`}
          </button>
          <button
            type="button"
            onClick={() => setFiltro("RESOLVIDOS")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold font-karla transition-all cursor-pointer ${
              filtro === "RESOLVIDOS"
                ? "bg-[#133C1B] text-white shadow-xs"
                : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {`Lidos (${resolvidos.length})`}
          </button>
          <button
            type="button"
            onClick={() => setFiltro("TODOS")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold font-karla transition-all cursor-pointer ${
              filtro === "TODOS"
                ? "bg-[#133C1B] text-white shadow-xs"
                : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {`Todos (${alertas.length})`}
          </button>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2">
          {pendentes.length > 0 && (
            <button
              type="button"
              onClick={handleResolverTodos}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 active:scale-95 transition-all font-karla cursor-pointer disabled:opacity-50"
              title="Marcar todos os alertas como lidos"
            >
              <svg className="h-4 w-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span>Limpar tudo</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleGerarAlertasAgora}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#133C1B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1a4f24] active:scale-95 transition-all font-karla cursor-pointer disabled:opacity-50"
          >
            <svg
              className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>{isPending ? "Gerando alertas..." : "Gerar alertas agora"}</span>
          </button>
        </div>
      </div>

      {/* Conteúdo principal */}
      {alertasFiltrados.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20 sm:py-28 text-center my-auto">
          <SleepyFaceIcon className="h-24 w-24 sm:h-28 sm:w-28 drop-shadow-xs transition-transform hover:scale-105 duration-300" />
          <p className="mt-5 text-base sm:text-lg font-medium text-zinc-600 font-spectral">
            {filtro === "PENDENTES"
              ? "Nenhum alerta pendente. Tudo sob controle!"
              : filtro === "RESOLVIDOS"
              ? "Nenhum alerta lido arquivado."
              : "Não há alertas registrados no momento."}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5 max-w-4xl w-full">
          {alertasFiltrados.map((alerta) => {
            const estilo = ESTILOS_TIPO[alerta.tipo] ?? {
              borderClass: "border-l-zinc-400",
              badgeClass: "bg-zinc-100 text-zinc-800 border-zinc-200",
              dotClass: "bg-zinc-500",
            };

            return (
              <div
                key={alerta.id}
                className={`rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5 shadow-xs border-l-4 ${estilo.borderClass} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all hover:shadow-md`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold font-karla ${estilo.badgeClass}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${estilo.dotClass}`} />
                      <span>{alerta.tipoRotulo}</span>
                    </span>

                    <Link
                      href={`/alunos/${alerta.alunoId}`}
                      className="font-bold text-xs text-[#133C1B] hover:underline font-karla"
                    >
                      {alerta.alunoNome}
                    </Link>

                    {alerta.resolvido && (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 font-karla">
                        ✓ Lido
                      </span>
                    )}

                    <span className="text-xs text-zinc-400 font-spectral" suppressHydrationWarning>
                      {formatarDataHora(new Date(alerta.criadoEm))}
                    </span>
                  </div>

                  <p className="text-sm sm:text-base font-semibold text-zinc-900 font-karla leading-snug">
                    {alerta.mensagem}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 border-t border-zinc-100 sm:border-t-0 pt-2 sm:pt-0">
                  {alerta.tipo === "CONVITE_REUNIAO" ? (
                    !alerta.resolvido ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setAlertaParaRecusar(alerta);
                            setJustificativaRecusa("");
                            setErroRecusa("");
                          }}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 active:scale-95 transition-all font-karla cursor-pointer disabled:opacity-50"
                        >
                          <span>Recusar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAceitarConviteReuniao(alerta)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#133C1B] px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#1a4f24] active:scale-95 transition-all font-karla cursor-pointer disabled:opacity-50"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          <span>Aceitar convite</span>
                        </button>
                      </>
                    ) : null
                  ) : (
                    <>
                      <Link
                        href={
                          alerta.tipo === "RESPOSTA_CONVITE_REUNIAO"
                            ? "/reunioes"
                            : `/alunos/${alerta.alunoId}`
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors font-karla"
                      >
                        <span>
                          {alerta.tipo === "RESPOSTA_CONVITE_REUNIAO"
                            ? "Ver reuniões"
                            : "Acompanhar orientando"}
                        </span>
                        <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>

                      {!alerta.resolvido && (
                        <button
                          type="button"
                          onClick={() => handleResolverAlerta(alerta.id)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 rounded-xl bg-[#133C1B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#1a4f24] active:scale-95 transition-all font-karla cursor-pointer disabled:opacity-50"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          <span>Marcar como lido</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de justificativa para recusar convite de reunião */}
      {alertaParaRecusar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={() => setAlertaParaRecusar(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-zinc-900 font-karla">
                  Recusar Convite de Reunião
                </h3>
                <p className="mt-1 text-xs text-zinc-500 font-spectral">
                  Para recusar o convite de reunião, informe obrigatoriamente uma justificativa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAlertaParaRecusar(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold text-zinc-700 font-karla mb-1.5">
                Justificativa da recusa <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={3}
                value={justificativaRecusa}
                onChange={(e) => {
                  setJustificativaRecusa(e.target.value);
                  if (erroRecusa) setErroRecusa("");
                }}
                placeholder="Ex.: Estarei em banca nesse horário, podemos remarcar?"
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#133C1B] focus:bg-white focus:outline-none font-spectral resize-none"
              />
              {erroRecusa && (
                <p className="mt-1.5 text-xs font-semibold text-red-600 font-karla">
                  {erroRecusa}
                </p>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAlertaParaRecusar(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors font-karla cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={enviandoRecusa}
                onClick={async () => {
                  const just = justificativaRecusa.trim();
                  if (!just) {
                    setErroRecusa("É obrigatório informar uma justificativa para recusar a reunião.");
                    return;
                  }
                  setEnviandoRecusa(true);
                  try {
                    const res = await recusarConviteReuniao(
                      alertaParaRecusar.conviteReuniaoId ?? alertaParaRecusar.id,
                      just
                    );
                    if (!res.ok) {
                      setErroRecusa(res.erro || "Erro ao recusar convite.");
                    } else {
                      setAlertas((prev) =>
                        prev.map((a) =>
                          a.id === alertaParaRecusar.id
                            ? { ...a, resolvido: true, mensagem: `${a.mensagem} (Convite recusado)` }
                            : a
                        )
                      );
                      setAlertaParaRecusar(null);
                      setMensagemSucesso("Convite de reunião recusado.");
                      setTimeout(() => setMensagemSucesso(null), 3500);
                      router.refresh();
                    }
                  } catch {
                    setErroRecusa("Erro ao recusar convite.");
                  } finally {
                    setEnviandoRecusa(false);
                  }
                }}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors font-karla cursor-pointer"
              >
                {enviandoRecusa ? "Recusando..." : "Confirmar recusa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


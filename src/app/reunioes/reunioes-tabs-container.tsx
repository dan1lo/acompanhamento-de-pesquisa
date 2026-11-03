"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarioContent } from "./calendario-content";
import { HistoricoTimelineContent } from "./historico-timeline-content";
import { AtividadesReuniaoContent } from "./atividades-reuniao-content";
import type { DadosCalendarioResponse } from "@/lib/actions/calendario";
import type { HistoricoReunioesResponse } from "@/lib/actions/historico-reunioes";
import type { GestaoAtividadesResponse } from "@/lib/actions/atividades-reuniao";

type AbaReunioes = "calendario" | "historico" | "atividades";

interface ReunioesTabsContainerProps {
  isAluno: boolean;
  userEmail?: string | null;
  dadosCalendario: DadosCalendarioResponse;
  historico: HistoricoReunioesResponse;
  gestaoAtividades: GestaoAtividadesResponse;
  googleCallbackStatus?: string;
  abrirModalGoogleInicial?: boolean;
  abaInicial?: string;
  alunoId?: string;
}

export function ReunioesTabsContainer({
  isAluno,
  userEmail,
  dadosCalendario,
  historico,
  gestaoAtividades,
  googleCallbackStatus,
  abrirModalGoogleInicial,
  abaInicial,
  alunoId,
}: ReunioesTabsContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [abaAtiva, setAbaAtiva] = useState<AbaReunioes>(() => {
    if (abaInicial === "historico" || abaInicial === "atividades") {
      return abaInicial;
    }
    return "calendario";
  });

  useEffect(() => {
    const pAba = searchParams.get("aba");
    if (pAba === "historico" || pAba === "atividades" || pAba === "calendario") {
      setAbaAtiva(pAba);
    }
  }, [searchParams]);

  const handleTrocarAba = (novaAba: AbaReunioes) => {
    setAbaAtiva(novaAba);
    const params = new URLSearchParams(searchParams.toString());
    params.set("aba", novaAba);
    router.replace(`/reunioes?${params.toString()}`);
  };

  return (
    <div className="w-full space-y-6">
      {/* NAVEGAÇÃO ENTRE ABAS */}
      <div className="flex items-center gap-1.5 rounded-2xl border border-zinc-200/90 bg-white p-1.5 shadow-xs overflow-x-auto print:hidden">
        <button
          type="button"
          onClick={() => handleTrocarAba("calendario")}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-karla font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            abaAtiva === "calendario"
              ? "bg-[#133C1B] text-white shadow-xs"
              : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 font-semibold"
          }`}
        >
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
          Calendário de Reuniões
        </button>

        <button
          type="button"
          onClick={() => handleTrocarAba("historico")}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-karla font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            abaAtiva === "historico"
              ? "bg-[#133C1B] text-white shadow-xs"
              : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 font-semibold"
          }`}
        >
          <svg
            className="w-4 h-4 shrink-0"
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
          Histórico &amp; Timeline
          {historico.reunioes.length > 0 && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                abaAtiva === "historico"
                  ? "bg-white/20 text-white"
                  : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {historico.reunioes.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTrocarAba("atividades")}
          className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-karla font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            abaAtiva === "atividades"
              ? "bg-[#133C1B] text-white shadow-xs"
              : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 font-semibold"
          }`}
        >
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
            />
          </svg>
          Gestão de Atividades por Reunião
          {gestaoAtividades.indicadores.geral.total > 0 && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                abaAtiva === "atividades"
                  ? "bg-white/20 text-white"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {gestaoAtividades.indicadores.geral.taxaConclusao}%
            </span>
          )}
        </button>
      </div>

      {/* CONTEÚDO DA ABA ATIVA */}
      {abaAtiva === "calendario" && (
        <CalendarioContent
          isAluno={isAluno}
          userEmail={userEmail ?? undefined}
          reunioesIniciais={dadosCalendario.reunioes}
          bloqueiosIniciais={dadosCalendario.bloqueios}
          googleConectadoInicial={dadosCalendario.googleConectado}
          emailGoogleConectadoInicial={dadosCalendario.emailGoogleConectado}
          orientandosIniciais={dadosCalendario.orientandos}
          orientadorInicial={dadosCalendario.orientador}
          convitesIniciais={dadosCalendario.convites}
          googleCallbackStatus={googleCallbackStatus}
          abrirModalGoogleInicial={abrirModalGoogleInicial}
        />
      )}

      {abaAtiva === "historico" && (
        <HistoricoTimelineContent
          historicoInicial={historico}
          alunoSelecionadoId={alunoId}
        />
      )}

      {abaAtiva === "atividades" && (
        <AtividadesReuniaoContent
          gestaoInicial={gestaoAtividades}
          alunoSelecionadoId={alunoId}
        />
      )}
    </div>
  );
}


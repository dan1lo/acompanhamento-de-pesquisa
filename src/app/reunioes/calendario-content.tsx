"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  type ReuniaoCalendarioItem,
  type BloqueioCalendarioItem,
  type ConviteReuniaoDetalhado,
  aceitarConviteReuniao,
  adicionarMeetReuniao,
  bloquearDataCalendario,
  cancelarReuniaoCalendario,
  conectarContaGoogleCalendario,
  desbloquearDataCalendario,
  desconectarContaGoogleCalendario,
  enviarConviteReuniao,
  marcarReuniaoSincronizadaGoogle,
  obterDadosCalendario,
  recusarConviteReuniao,
  sincronizarReunioesGoogle,
} from "@/lib/actions/calendario";

interface CalendarioContentProps {
  isAluno: boolean;
  userEmail?: string;
  reunioesIniciais: ReuniaoCalendarioItem[];
  bloqueiosIniciais: BloqueioCalendarioItem[];
  googleConectadoInicial: boolean;
  emailGoogleConectadoInicial?: string | null;
  orientandosIniciais?: Array<{ id: string; nome: string; email: string }>;
  orientadorInicial?: { id: string; nome: string; email: string } | null;
  convitesIniciais?: ConviteReuniaoDetalhado[];
  googleCallbackStatus?: string;
  abrirModalGoogleInicial?: boolean;
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function padZero(n: number) {
  return String(n).padStart(2, "0");
}

function formatarDataIsoParaString(ano: number, mes: number, dia: number) {
  return `${ano}-${padZero(mes)}-${padZero(dia)}`;
}

function gerarCodigoMeetCliente(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const seg = (len: number) =>
    Array.from({ length: len }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `https://meet.google.com/${seg(3)}-${seg(4)}-${seg(3)}`;
}

export function CalendarioContent({
  isAluno,
  userEmail = "",
  reunioesIniciais,
  bloqueiosIniciais,
  googleConectadoInicial,
  emailGoogleConectadoInicial = null,
  orientandosIniciais = [],
  orientadorInicial = null,
  convitesIniciais = [],
  googleCallbackStatus,
  abrirModalGoogleInicial = false,
}: CalendarioContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const hoje = useMemo(() => new Date(), []);
  const [mesAtual, setMesAtual] = useState(hoje.getMonth() + 1); // 1 a 12
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());

  const hojeStr = useMemo(
    () => formatarDataIsoParaString(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate()),
    [hoje]
  );

  const [dataSelecionada, setDataSelecionada] = useState<string>(hojeStr);

  const [reunioes, setReunioes] = useState<ReuniaoCalendarioItem[]>(reunioesIniciais);
  const [bloqueios, setBloqueios] = useState<BloqueioCalendarioItem[]>(bloqueiosIniciais);
  const [convites, setConvites] = useState<ConviteReuniaoDetalhado[]>(convitesIniciais);
  const [googleConectado, setGoogleConectado] = useState(googleConectadoInicial);
  const [emailGoogleConectado, setEmailGoogleConectado] = useState<string>(
    emailGoogleConectadoInicial || userEmail || ""
  );
  const [emailGoogleInput, setEmailGoogleInput] = useState<string>(
    emailGoogleConectadoInicial || userEmail || ""
  );

  // Modais
  const [modalBloqueioAberto, setModalBloqueioAberto] = useState(false);
  const [modalReuniaoAberto, setModalReuniaoAberto] = useState(false);
  const [modalGoogleAberto, setModalGoogleAberto] = useState(abrirModalGoogleInicial);
  const [modalConvitesAberto, setModalConvitesAberto] = useState(false);
  const [abaConvites, setAbaConvites] = useState<"recebidos" | "enviados" | "todos">("recebidos");
  const [filtroStatusConvite, setFiltroStatusConvite] = useState<string>("TODOS");

  // Modal de confirmação de cancelamento de reunião
  const [reuniaoParaCancelar, setReuniaoParaCancelar] = useState<string | null>(null);

  // Modal de justificativa de recusa de convite de reunião
  const [conviteParaRecusar, setConviteParaRecusar] = useState<ConviteReuniaoDetalhado | null>(null);
  const [justificativaRecusaInput, setJustificativaRecusaInput] = useState("");
  const [erroRecusa, setErroRecusa] = useState("");
  const [enviandoRecusa, setEnviandoRecusa] = useState(false);

  // Formulário de Bloqueio
  const [dataBloqueioInput, setDataBloqueioInput] = useState(hojeStr);
  const [motivoBloqueioInput, setMotivoBloqueioInput] = useState("");
  const [erroBloqueio, setErroBloqueio] = useState<string | null>(null);

  // Formulário de Reunião / Convite + Google Meet
  const [dataReuniaoInput, setDataReuniaoInput] = useState(hojeStr);
  const [horarioReuniaoInput, setHorarioReuniaoInput] = useState("14:00");
  const [alunoSelecionadoId, setAlunoSelecionadoId] = useState(orientandosIniciais[0]?.id || "");
  const [pautaReuniaoInput, setPautaReuniaoInput] = useState("");
  const [incluirMeetInput, setIncluirMeetInput] = useState(false);
  const [meetLinkInput, setMeetLinkInput] = useState("");
  const [sincronizarGoogleInput, setSincronizarGoogleInput] = useState(true);
  const [erroReuniao, setErroReuniao] = useState<string | null>(null);

  // Feedback e Toasts
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(
    googleCallbackStatus === "conectado"
      ? "Conta do Google Calendar conectada com sucesso!"
      : googleCallbackStatus === "erro"
      ? "Não foi possível autenticar via OAuth externo. Use a conexão direta abaixo."
      : null
  );
  const [sincronizandoGoogle, setSincronizandoGoogle] = useState(false);

  // Sincroniza estado com props
  useEffect(() => {
    setReunioes(reunioesIniciais);
  }, [reunioesIniciais]);

  useEffect(() => {
    setBloqueios(bloqueiosIniciais);
  }, [bloqueiosIniciais]);

  useEffect(() => {
    setConvites(convitesIniciais);
  }, [convitesIniciais]);

  // Recarrega dados quando muda de mês ou ano
  useEffect(() => {
    let cancelado = false;
    startTransition(async () => {
      try {
        const dados = await obterDadosCalendario(mesAtual, anoAtual);
        if (!cancelado) {
          setReunioes(dados.reunioes);
          setBloqueios(dados.bloqueios);
          setConvites(dados.convites);
          setGoogleConectado(dados.googleConectado);
          if (dados.emailGoogleConectado) {
            setEmailGoogleConectado(dados.emailGoogleConectado);
          }
        }
      } catch {}
    });
    return () => {
      cancelado = true;
    };
  }, [mesAtual, anoAtual]);

  // Mapa de reuniões por dia YYYY-MM-DD
  const reunioesPorDia = useMemo(() => {
    const mapa = new Map<string, ReuniaoCalendarioItem[]>();
    for (const r of reunioes) {
      const lista = mapa.get(r.dataDia) ?? [];
      lista.push(r);
      mapa.set(r.dataDia, lista);
    }
    return mapa;
  }, [reunioes]);

  // Mapa de bloqueios por dia YYYY-MM-DD
  const bloqueiosPorDia = useMemo(() => {
    const mapa = new Map<string, BloqueioCalendarioItem>();
    for (const b of bloqueios) {
      mapa.set(b.data, b);
    }
    return mapa;
  }, [bloqueios]);

  // Matriz de dias para a grade do mês
  const gradeDias = useMemo(() => {
    const primeiroDiaDoMes = new Date(anoAtual, mesAtual - 1, 1);
    const diaDaSemanaInicio = primeiroDiaDoMes.getDay(); // 0 (Dom) a 6 (Sáb)
    const totalDiasNoMes = new Date(anoAtual, mesAtual, 0).getDate();

    // Dias do mês anterior para preencher a primeira semana
    const diasMesAnterior = new Date(anoAtual, mesAtual - 1, 0).getDate();

    const dias: Array<{
      dia: number;
      mes: number;
      ano: number;
      dataStr: string;
      pertenceAoMes: boolean;
      ehHoje: boolean;
    }> = [];

    // Preenche dias do mês anterior
    for (let i = diaDaSemanaInicio - 1; i >= 0; i--) {
      const diaNum = diasMesAnterior - i;
      const mesNum = mesAtual === 1 ? 12 : mesAtual - 1;
      const anoNum = mesAtual === 1 ? anoAtual - 1 : anoAtual;
      const dataStr = formatarDataIsoParaString(anoNum, mesNum, diaNum);
      dias.push({
        dia: diaNum,
        mes: mesNum,
        ano: anoNum,
        dataStr,
        pertenceAoMes: false,
        ehHoje: dataStr === hojeStr,
      });
    }

    // Preenche dias do mês atual
    for (let d = 1; d <= totalDiasNoMes; d++) {
      const dataStr = formatarDataIsoParaString(anoAtual, mesAtual, d);
      dias.push({
        dia: d,
        mes: mesAtual,
        ano: anoAtual,
        dataStr,
        pertenceAoMes: true,
        ehHoje: dataStr === hojeStr,
      });
    }

    // Preenche dias do próximo mês para fechar a grade (múltiplo de 7, totalizando 35 ou 42 blocos)
    const resto = dias.length % 7;
    if (resto > 0) {
      const faltam = 7 - resto;
      for (let prox = 1; prox <= faltam; prox++) {
        const mesNum = mesAtual === 12 ? 1 : mesAtual + 1;
        const anoNum = mesAtual === 12 ? anoAtual + 1 : anoAtual;
        const dataStr = formatarDataIsoParaString(anoNum, mesNum, prox);
        dias.push({
          dia: prox,
          mes: mesNum,
          ano: anoNum,
          dataStr,
          pertenceAoMes: false,
          ehHoje: dataStr === hojeStr,
        });
      }
    }

    return dias;
  }, [anoAtual, mesAtual, hojeStr]);

  // Navegação de mês
  function irParaMesAnterior() {
    if (mesAtual === 1) {
      setMesAtual(12);
      setAnoAtual((a) => a - 1);
    } else {
      setMesAtual((m) => m - 1);
    }
  }

  function irParaProximoMes() {
    if (mesAtual === 12) {
      setMesAtual(1);
      setAnoAtual((a) => a + 1);
    } else {
      setMesAtual((m) => m + 1);
    }
  }

  function irParaHoje() {
    setMesAtual(hoje.getMonth() + 1);
    setAnoAtual(hoje.getFullYear());
    setDataSelecionada(hojeStr);
  }

  // Refresh
  function handleRefresh() {
    startTransition(async () => {
      try {
        const dados = await obterDadosCalendario(mesAtual, anoAtual);
        setReunioes(dados.reunioes);
        setBloqueios(dados.bloqueios);
        setConvites(dados.convites);
        setMensagemSucesso("Calendário atualizado com sucesso!");
        setTimeout(() => setMensagemSucesso(null), 3000);
      } catch {
        setMensagemSucesso("Calendário atualizado.");
        setTimeout(() => setMensagemSucesso(null), 2500);
      }
    });
  }

  // Pular para data no calendário a partir de um convite
  function handlePularParaDataNoCalendario(dataDia: string) {
    const [ano, mes] = dataDia.split("-").map(Number);
    setAnoAtual(ano);
    setMesAtual(mes);
    setDataSelecionada(dataDia);
    setModalConvitesAberto(false);
  }

  // Abrir modal de bloqueio
  function handleAbrirModalBloqueio(dataPadrao?: string) {
    setDataBloqueioInput(dataPadrao || dataSelecionada || hojeStr);
    setMotivoBloqueioInput("");
    setErroBloqueio(null);
    setModalBloqueioAberto(true);
  }

  // Submeter bloqueio
  async function handleSalvarBloqueio(e: React.FormEvent) {
    e.preventDefault();
    setErroBloqueio(null);

    if (!motivoBloqueioInput.trim()) {
      setErroBloqueio("Por favor, escreva o motivo do bloqueio desta data.");
      return;
    }

    startTransition(async () => {
      try {
        await bloquearDataCalendario(dataBloqueioInput, motivoBloqueioInput.trim());
        const dados = await obterDadosCalendario(mesAtual, anoAtual);
        setBloqueios(dados.bloqueios);
        setModalBloqueioAberto(false);
        setMensagemSucesso("Data bloqueada com sucesso!");
        setTimeout(() => setMensagemSucesso(null), 3500);
      } catch (err) {
        setErroBloqueio(err instanceof Error ? err.message : "Erro ao bloquear data.");
      }
    });
  }

  // Desbloquear data
  async function handleDesbloquearData(bloqueioId: string) {
    startTransition(async () => {
      try {
        await desbloquearDataCalendario(bloqueioId);
        const dados = await obterDadosCalendario(mesAtual, anoAtual);
        setBloqueios(dados.bloqueios);
        setMensagemSucesso("Bloqueio removido.");
        setTimeout(() => setMensagemSucesso(null), 3000);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Não foi possível remover este bloqueio.");
      }
    });
  }

  // Abrir modal de reunião
  function handleAbrirModalReuniao(dataPadrao?: string) {
    const dataAlvo = dataPadrao || dataSelecionada || hojeStr;
    setDataReuniaoInput(dataAlvo);
    setHorarioReuniaoInput("14:00");
    setPautaReuniaoInput("");
    setIncluirMeetInput(false);
    setMeetLinkInput("");
    setSincronizarGoogleInput(true);
    setErroReuniao(null);
    setModalReuniaoAberto(true);
  }

  // Ativar Google Meet no formulário de criação de reunião
  function handleAtivarMeetFormulario() {
    setIncluirMeetInput(true);
    if (!meetLinkInput) {
      setMeetLinkInput(gerarCodigoMeetCliente());
    }
  }

  // Submeter reunião
  async function handleEnviarReuniao(e: React.FormEvent) {
    e.preventDefault();
    setErroReuniao(null);

    // Valida se a data está bloqueada
    const bloq = bloqueiosPorDia.get(dataReuniaoInput);
    if (bloq) {
      setErroReuniao(`Esta data está bloqueada: "${bloq.motivo}". Escolha outra data.`);
      return;
    }

    startTransition(async () => {
      try {
        await enviarConviteReuniao({
          alunoId: isAluno ? undefined : alunoSelecionadoId,
          dataStr: dataReuniaoInput,
          horarioStr: horarioReuniaoInput,
          pauta: pautaReuniaoInput.trim() || undefined,
          incluirMeet: incluirMeetInput,
          meetLinkCustom: incluirMeetInput ? meetLinkInput.trim() || undefined : undefined,
          sincronizarGoogle: sincronizarGoogleInput,
        });
        const dados = await obterDadosCalendario(mesAtual, anoAtual);
        setReunioes(dados.reunioes);
        setConvites(dados.convites);
        setModalReuniaoAberto(false);
        setMensagemSucesso(
          "Convite de reunião enviado! A reunião será agendada no calendário assim que for aceita."
        );
        setTimeout(() => setMensagemSucesso(null), 4500);
        router.refresh();
      } catch (err) {
        setErroReuniao(err instanceof Error ? err.message : "Erro ao enviar convite de reunião.");
      }
    });
  }

  // Aceitar convite de reunião diretamente pelo modal de convites
  function handleAceitarConviteNoModal(conviteId: string) {
    startTransition(async () => {
      try {
        const res = await aceitarConviteReuniao(conviteId);
        if (res.ok) {
          const dados = await obterDadosCalendario(mesAtual, anoAtual);
          setReunioes(dados.reunioes);
          setConvites(dados.convites);
          setMensagemSucesso("Convite aceito! A reunião foi agendada no calendário.");
          setTimeout(() => setMensagemSucesso(null), 4000);
          router.refresh();
        }
      } catch {}
    });
  }

  // Adicionar Google Meet a uma reunião já existente
  async function handleAdicionarMeetNaReuniao(reuniaoId: string) {
    startTransition(async () => {
      try {
        await adicionarMeetReuniao(reuniaoId);
        const dados = await obterDadosCalendario(mesAtual, anoAtual);
        setReunioes(dados.reunioes);
        setConvites(dados.convites);
        setMensagemSucesso("Reunião no Google Meet adicionada ao evento!");
        setTimeout(() => setMensagemSucesso(null), 3500);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao adicionar Google Meet.");
      }
    });
  }

  // Abrir modal de confirmação para cancelar reunião
  function handleCancelarReuniao(reuniaoId: string) {
    setReuniaoParaCancelar(reuniaoId);
  }

  // Confirmar cancelamento da reunião no modal customizado
  function confirmarCancelamentoReuniao() {
    if (!reuniaoParaCancelar) return;
    const idAlvo = reuniaoParaCancelar;
    setReuniaoParaCancelar(null);
    startTransition(async () => {
      try {
        await cancelarReuniaoCalendario(idAlvo);
        const dados = await obterDadosCalendario(mesAtual, anoAtual);
        setReunioes(dados.reunioes);
        setConvites(dados.convites);
        setMensagemSucesso("Reunião cancelada com sucesso.");
        setTimeout(() => setMensagemSucesso(null), 3000);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao cancelar reunião.");
      }
    });
  }

  // Conectar conta do Google Calendar
  async function handleConectarGoogle(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSincronizandoGoogle(true);
    try {
      const res = await conectarContaGoogleCalendario(emailGoogleInput);
      setGoogleConectado(true);
      setEmailGoogleConectado(res.emailGoogle);
      const dados = await obterDadosCalendario(mesAtual, anoAtual);
      setReunioes(dados.reunioes);
      setConvites(dados.convites);
      setMensagemSucesso(
        `Google Calendar conectado (${res.emailGoogle})! ${
          res.sincronizadas > 0
            ? `${res.sincronizadas} reunião(ões) sincronizada(s).`
            : "Sincronização ativa."
        }`
      );
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch {
      setMensagemSucesso("Não foi possível vincular a conta Google.");
      setTimeout(() => setMensagemSucesso(null), 3000);
    } finally {
      setSincronizandoGoogle(false);
    }
  }

  // Desconectar conta do Google Calendar
  async function handleDesconectarGoogle() {
    setSincronizandoGoogle(true);
    try {
      await desconectarContaGoogleCalendario();
      setGoogleConectado(false);
      setMensagemSucesso("Conta do Google Calendar desconectada.");
      setTimeout(() => setMensagemSucesso(null), 3000);
    } catch {
    } finally {
      setSincronizandoGoogle(false);
    }
  }

  // Sincronizar todas as reuniões com Google Calendar
  async function handleSincronizarGoogle() {
    setSincronizandoGoogle(true);
    try {
      const res = await sincronizarReunioesGoogle();
      setGoogleConectado(true);
      const dados = await obterDadosCalendario(mesAtual, anoAtual);
      setReunioes(dados.reunioes);
      setConvites(dados.convites);
      if (dados.emailGoogleConectado) {
        setEmailGoogleConectado(dados.emailGoogleConectado);
      }
      setMensagemSucesso(
        res.sincronizadas > 0
          ? `${res.sincronizadas} reunião(ões) sincronizada(s) com o Google Calendar!`
          : `Todas as ${res.total} reunião(ões) agendada(s) já estão sincronizadas com o Google Calendar!`
      );
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch {
      setMensagemSucesso("Sincronização concluída.");
      setTimeout(() => setMensagemSucesso(null), 3000);
    } finally {
      setSincronizandoGoogle(false);
    }
  }

  // Marcar reunião individual como sincronizada ao abrir no Google Calendar
  function handleMarcarSincronizadaIndividual(reuniaoId: string) {
    startTransition(async () => {
      try {
        await marcarReuniaoSincronizadaGoogle(reuniaoId);
        const dados = await obterDadosCalendario(mesAtual, anoAtual);
        setReunioes(dados.reunioes);
        setConvites(dados.convites);
      } catch {}
    });
  }

  // Exportar arquivo .ics para importação direta no Google Calendar
  function handleExportarICS() {
    const agendadas = convites.filter((c) => c.status === "AGENDADA");
    if (agendadas.length === 0) {
      alert("Não há reuniões agendadas para exportar.");
      return;
    }

    const linhas: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Scholab//Orientacao Academica//PT",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    const stamp = new Date().toISOString().replace(/-|:|\.\d\d\d/g, "");

    for (const c of agendadas) {
      const inicio = new Date(c.data);
      const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
      const dtStart = inicio.toISOString().replace(/-|:|\.\d\d\d/g, "");
      const dtEnd = fim.toISOString().replace(/-|:|\.\d\d\d/g, "");
      const sumario = c.pauta
        ? `Orientação Scholab: ${c.pauta}`
        : `Orientação Scholab — ${c.outroParticipante.nome}`;
      const desc = `Reunião de orientação via Scholab com ${c.outroParticipante.nome} (${c.outroParticipante.email}).${
        c.meetLink ? `\\nVideoconferência Google Meet: ${c.meetLink}` : ""
      }`;

      linhas.push("BEGIN:VEVENT");
      linhas.push(`UID:scholab-${c.id}@scholab.app`);
      linhas.push(`DTSTAMP:${stamp}`);
      linhas.push(`DTSTART:${dtStart}`);
      linhas.push(`DTEND:${dtEnd}`);
      linhas.push(`SUMMARY:${sumario}`);
      linhas.push(`DESCRIPTION:${desc}`);
      if (c.meetLink) {
        linhas.push(`LOCATION:${c.meetLink}`);
      }
      linhas.push("END:VEVENT");
    }

    linhas.push("END:VCALENDAR");

    const blob = new Blob([linhas.join("\r\n")], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reunioes-scholab-google-calendar.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setMensagemSucesso("Arquivo .ics gerado! Importe-o no seu Google Calendar.");
    setTimeout(() => setMensagemSucesso(null), 4000);
  }

  // Reuniões e bloqueio do dia selecionado
  const reunioesDiaSelecionado = reunioesPorDia.get(dataSelecionada) ?? [];
  const bloqueioDiaSelecionado = bloqueiosPorDia.get(dataSelecionada);

  // Formata a data selecionada para exibição em português
  const dataSelecionadaFormatada = useMemo(() => {
    if (!dataSelecionada) return "";
    const [ano, mes, dia] = dataSelecionada.split("-").map(Number);
    const d = new Date(ano, mes - 1, dia);
    return d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [dataSelecionada]);

  // Convites calculados para o modal e badge
  const convitesRecebidos = useMemo(
    () => convites.filter((c) => !c.enviadoPorMim),
    [convites]
  );
  const convitesEnviados = useMemo(
    () => convites.filter((c) => c.enviadoPorMim),
    [convites]
  );
  const convitesAgendadosRecebidos = useMemo(
    () => convitesRecebidos.filter((c) => c.status === "PENDENTE" || c.status === "AGENDADA"),
    [convitesRecebidos]
  );
  const convitesFiltrados = useMemo(() => {
    let lista = convites;
    if (abaConvites === "recebidos") {
      lista = lista.filter((c) => !c.enviadoPorMim);
    } else if (abaConvites === "enviados") {
      lista = lista.filter((c) => c.enviadoPorMim);
    }

    if (filtroStatusConvite !== "TODOS") {
      lista = lista.filter((c) => c.status === filtroStatusConvite);
    }

    return lista;
  }, [convites, abaConvites, filtroStatusConvite]);

  return (
    <div className="space-y-6 text-left">
      {mensagemSucesso && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 font-spectral flex items-center justify-between shadow-2xs animate-fade-in">
          <span>{mensagemSucesso}</span>
          <button
            type="button"
            onClick={() => setMensagemSucesso(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer ml-3"
          >
            ×
          </button>
        </div>
      )}

      {/* Estrutura: Barra de Ferramentas à esquerda + Quadro em formato de calendário */}
      <div className="flex flex-col lg:flex-row items-start gap-4 sm:gap-6">
        {/* Barra de botões pequenos à esquerda do quadro */}
        <div className="flex lg:flex-col gap-2.5 p-2 bg-white rounded-2xl border border-zinc-200/90 shadow-xs shrink-0 self-start lg:sticky lg:top-24 z-10 w-full lg:w-auto justify-between lg:justify-start">
          {/* Botão 1: Google Calendar */}
          <button
            type="button"
            onClick={() => setModalGoogleAberto(true)}
            className="group relative flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50/70 text-zinc-700 hover:bg-emerald-50/60 hover:border-emerald-300 hover:text-[#133C1B] active:scale-95 transition-all cursor-pointer"
            aria-label="Sincronizar com Google Calendar"
            title="Sincronizar com Google Calendar"
          >
            {/* Ícone estilizado Google Calendar */}
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="17" rx="3" fill="#FFFFFF" stroke="#4285F4" strokeWidth="1.8" />
              <path d="M3 9H21" stroke="#4285F4" strokeWidth="1.8" />
              <rect x="7" y="2" width="2" height="4" rx="1" fill="#EA4335" />
              <rect x="15" y="2" width="2" height="4" rx="1" fill="#EA4335" />
              <text x="12" y="16.5" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#133C1B" fontFamily="sans-serif">
                G
              </text>
            </svg>
            <span className="pointer-events-none absolute left-full ml-2 hidden lg:group-hover:block whitespace-nowrap rounded-lg bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white shadow-md z-30 font-karla">
              Google Calendar
            </span>
          </button>

          {/* Botão 2: Bloqueio de datas */}
          <button
            type="button"
            onClick={() => handleAbrirModalBloqueio()}
            className="group relative flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50/70 text-zinc-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700 active:scale-95 transition-all cursor-pointer"
            aria-label="Bloquear data"
            title="Bloquear data no calendário"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            <span className="pointer-events-none absolute left-full ml-2 hidden lg:group-hover:block whitespace-nowrap rounded-lg bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white shadow-md z-30 font-karla">
              Bloquear data
            </span>
          </button>

          {/* Botão 3: Convites de reunião com detalhes */}
          <button
            type="button"
            onClick={() => setModalConvitesAberto(true)}
            className="group relative flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50/70 text-zinc-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-[#133C1B] active:scale-95 transition-all cursor-pointer"
            aria-label="Convites de reunião"
            title="Convites de reunião com detalhes"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
            {convitesAgendadosRecebidos.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#133C1B] px-1 text-[9px] font-bold text-white shadow-xs">
                {convitesAgendadosRecebidos.length}
              </span>
            )}
            <span className="pointer-events-none absolute left-full ml-2 hidden lg:group-hover:block whitespace-nowrap rounded-lg bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white shadow-md z-30 font-karla">
              Convites de reunião
            </span>
          </button>

          {/* Botão 4: Refresh */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
            className="group relative flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50/70 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 active:scale-95 transition-all cursor-pointer"
            aria-label="Atualizar calendário"
            title="Atualizar calendário"
          >
            <svg
              className={`h-5 w-5 ${isPending ? "animate-spin text-[#133C1B]" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            <span className="pointer-events-none absolute left-full ml-2 hidden lg:group-hover:block whitespace-nowrap rounded-lg bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white shadow-md z-30 font-karla">
              Atualizar
            </span>
          </button>

          {/* Botão 5: "+" (Marcar Reunião / Enviar Convite) */}
          <button
            type="button"
            onClick={() => handleAbrirModalReuniao()}
            className="group relative flex h-11 w-11 items-center justify-center rounded-xl bg-[#133C1B] text-white shadow-sm hover:bg-[#1a4f24] active:scale-95 transition-all cursor-pointer"
            aria-label="Marcar reunião"
            title="Marcar reunião / Enviar convite"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="pointer-events-none absolute left-full ml-2 hidden lg:group-hover:block whitespace-nowrap rounded-lg bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white shadow-md z-30 font-karla">
              Marcar reunião
            </span>
          </button>
        </div>

        {/* Quadro Principal em Formato de Calendário Moderno */}
        <div className="flex-1 w-full space-y-5 min-w-0">
          <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-xs p-4 sm:p-6 space-y-5">
            {/* Cabeçalho do Calendário: Navegação do Mês + Legenda */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 font-karla tracking-tight">
                  {MESES[mesAtual - 1]} de {anoAtual}
                </h2>

                <div className="flex items-center gap-1 border border-zinc-200 rounded-xl p-0.5 bg-zinc-50/60">
                  <button
                    type="button"
                    onClick={irParaMesAnterior}
                    className="p-1.5 rounded-lg text-zinc-600 hover:bg-white hover:text-zinc-900 hover:shadow-2xs transition-all cursor-pointer"
                    aria-label="Mês anterior"
                    title="Mês anterior"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={irParaProximoMes}
                    className="p-1.5 rounded-lg text-zinc-600 hover:bg-white hover:text-zinc-900 hover:shadow-2xs transition-all cursor-pointer"
                    aria-label="Próximo mês"
                    title="Próximo mês"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={irParaHoje}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors font-karla cursor-pointer shadow-2xs"
                >
                  Hoje
                </button>
              </div>

              {/* Legenda visual sutil */}
              <div className="flex items-center gap-4 text-xs font-karla text-zinc-600">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#133C1B]" />
                  <span>Reunião marcada</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span>Data bloqueada</span>
                </div>
              </div>
            </div>

            {/* Cabeçalho dos Dias da Semana */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 text-center">
              {DIAS_SEMANA.map((diaNome, idx) => (
                <div
                  key={diaNome}
                  className={`py-1 text-xs font-bold uppercase tracking-wider font-karla ${
                    idx === 0 || idx === 6 ? "text-zinc-400" : "text-zinc-700"
                  }`}
                >
                  {diaNome}
                </div>
              ))}
            </div>

            {/* Grade de Blocos de Cada Dia do Mês */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
              {gradeDias.map((item) => {
                const reunioesDoDia = reunioesPorDia.get(item.dataStr) ?? [];
                const bloqueioDoDia = bloqueiosPorDia.get(item.dataStr);
                const selecionado = item.dataStr === dataSelecionada;

                return (
                  <div
                    key={item.dataStr}
                    onClick={() => setDataSelecionada(item.dataStr)}
                    className={`relative min-h-[5.5rem] sm:min-h-[7rem] p-2 sm:p-2.5 rounded-2xl border transition-all text-left flex flex-col justify-between cursor-pointer select-none ${
                      selecionado
                        ? "border-[#133C1B] ring-2 ring-[#133C1B]/20 bg-emerald-50/20 shadow-xs"
                        : bloqueioDoDia
                        ? "border-red-200/90 bg-red-50/40 hover:border-red-300"
                        : item.pertenceAoMes
                        ? "border-zinc-200/80 bg-white hover:border-zinc-300 hover:shadow-2xs"
                        : "border-zinc-100 bg-zinc-50/40 opacity-40 hover:opacity-75"
                    }`}
                  >
                    {/* Topo do Bloco: Número do Dia + Indicador Bloqueio */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs sm:text-sm font-bold font-karla transition-colors ${
                          item.ehHoje
                            ? "flex h-6 w-6 items-center justify-center rounded-full bg-[#133C1B] text-white shadow-xs"
                            : selecionado
                            ? "text-[#133C1B]"
                            : item.pertenceAoMes
                            ? "text-zinc-800"
                            : "text-zinc-400"
                        }`}
                      >
                        {item.dia}
                      </span>

                      {bloqueioDoDia && (
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-700"
                          title={`Data bloqueada: ${bloqueioDoDia.motivo}`}
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                            />
                          </svg>
                        </span>
                      )}
                    </div>

                    {/* Meio / Rodapé do Bloco: Marcadores de Reuniões */}
                    <div className="space-y-1 mt-1">
                      {bloqueioDoDia && (
                        <div
                          className="truncate rounded-md bg-red-100/90 border border-red-200/70 px-1.5 py-0.5 text-[10px] font-bold text-red-800 font-karla"
                          title={bloqueioDoDia.motivo}
                        >
                          {bloqueioDoDia.motivo}
                        </div>
                      )}

                      {reunioesDoDia.slice(0, 2).map((r) => (
                        <div
                          key={r.id}
                          className="truncate rounded-md bg-[#133C1B]/10 border border-[#133C1B]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#133C1B] font-karla flex items-center gap-1"
                          title={`${r.horario} - ${isAluno ? r.orientadorNome : r.alunoNome}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-[#133C1B] shrink-0" />
                          <span className="font-bold">{r.horario}</span>
                          <span className="truncate">{isAluno ? r.orientadorNome : r.alunoNome}</span>
                        </div>
                      ))}

                      {reunioesDoDia.length > 2 && (
                        <div className="text-[10px] text-zinc-400 font-karla font-semibold pl-1">
                          +{reunioesDoDia.length - 2} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Painel de Detalhes da Data Selecionada */}
          <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-zinc-900 font-karla capitalize">
                  {dataSelecionadaFormatada}
                </h3>
                <p className="text-xs text-zinc-500 font-spectral">
                  {bloqueioDiaSelecionado
                    ? "Esta data possui restrição de agendamento."
                    : reunioesDiaSelecionado.length > 0
                    ? `${reunioesDiaSelecionado.length} reunião(ões) registrada(s) para este dia.`
                    : "Nenhuma reunião marcada para este dia."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!bloqueioDiaSelecionado ? (
                  <button
                    type="button"
                    onClick={() => handleAbrirModalBloqueio(dataSelecionada)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-95 transition-all font-karla cursor-pointer shadow-2xs"
                  >
                    <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span>Bloquear data</span>
                  </button>
                ) : bloqueioDiaSelecionado.criadoPorMim ? (
                  <button
                    type="button"
                    onClick={() => handleDesbloquearData(bloqueioDiaSelecionado.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 active:scale-95 transition-all font-karla cursor-pointer shadow-2xs"
                  >
                    <span>Remover bloqueio</span>
                  </button>
                ) : (
                  <span
                    title="Apenas quem bloqueou esta data pode desbloqueá-la"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/70 px-3 py-1.5 text-xs font-semibold text-red-700/80 font-karla select-none"
                  >
                    <svg className="h-3.5 w-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span>Bloqueado por {bloqueioDiaSelecionado.usuarioNome}</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleAbrirModalReuniao(dataSelecionada)}
                  disabled={Boolean(bloqueioDiaSelecionado)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#133C1B] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1a4f24] active:scale-95 transition-all font-karla cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span>Marcar reunião</span>
                </button>
              </div>
            </div>

            {/* Aviso de Bloqueio se houver */}
            {bloqueioDiaSelecionado && (
              <div className="rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-xs font-karla text-red-900 flex items-start gap-2.5">
                <svg className="h-4 w-4 shrink-0 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <div className="flex-1">
                  <p className="font-bold">Data bloqueada para reuniões</p>
                  <p className="mt-0.5 text-red-800">
                    Motivo: &quot;{bloqueioDiaSelecionado.motivo}&quot; (por {bloqueioDiaSelecionado.usuarioNome})
                  </p>
                </div>
              </div>
            )}

            {/* Lista de reuniões marcadas no dia selecionado */}
            {reunioesDiaSelecionado.length === 0 ? (
              <p className="text-xs sm:text-sm text-zinc-500 font-spectral py-2">
                Nenhuma reunião agendada para este dia.
              </p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {reunioesDiaSelecionado.map((reuniao) => (
                  <div key={reuniao.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-[#133C1B]/10 px-2 py-0.5 text-xs font-bold text-[#133C1B] font-karla">
                          {reuniao.horario}
                        </span>
                        <span className="text-xs font-semibold text-zinc-800 font-karla">
                          {isAluno ? `Com orientador: ${reuniao.orientadorNome}` : `Com orientando: ${reuniao.alunoNome}`}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.2 text-[10px] font-bold text-zinc-600 font-karla">
                          {reuniao.status}
                        </span>
                        {reuniao.googleEventId && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.2 text-[10px] font-bold text-emerald-700 font-karla">
                            ✓ Sincronizada no Google
                          </span>
                        )}
                      </div>
                      {reuniao.pauta && (
                        <p className="text-xs text-zinc-600 font-spectral">
                          Pauta: {reuniao.pauta}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {reuniao.meetLink ? (
                        <a
                          href={reuniao.meetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors font-karla"
                        >
                          <svg className="h-3.5 w-3.5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                          </svg>
                          <span>Entrar no Meet</span>
                        </a>
                      ) : (
                        reuniao.status === "AGENDADA" && (
                          <button
                            type="button"
                            onClick={() => handleAdicionarMeetNaReuniao(reuniao.id)}
                            disabled={isPending}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors font-karla cursor-pointer"
                          >
                            <svg className="h-3.5 w-3.5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                            </svg>
                            <span>+ Adicionar Meet</span>
                          </button>
                        )
                      )}

                      {reuniao.status === "AGENDADA" && (
                        <button
                          type="button"
                          onClick={() => handleCancelarReuniao(reuniao.id)}
                          disabled={isPending}
                          className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors font-karla cursor-pointer"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal 1: Bloquear Data */}
      {modalBloqueioAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) {
              setModalBloqueioAberto(false);
            }
          }}
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-5 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <h2 className="text-lg font-bold text-zinc-900 font-karla">
                  Bloquear Data no Calendário
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalBloqueioAberto(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-zinc-500 font-spectral">
              Ao bloquear uma data, você impede que reuniões sejam marcadas nesse dia. É obrigatório informar o motivo.
            </p>

            {erroBloqueio && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 font-karla">
                {erroBloqueio}
              </div>
            )}

            <form onSubmit={handleSalvarBloqueio} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla">
                  Data a ser bloqueada
                </label>
                <input
                  type="date"
                  required
                  value={dataBloqueioInput}
                  onChange={(e) => setDataBloqueioInput(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 font-karla focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla">
                  Motivo do bloqueio <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={motivoBloqueioInput}
                  onChange={(e) => setMotivoBloqueioInput(e.target.value)}
                  placeholder="Ex: Feriado, participação em congresso acadêmico, compromisso inadiável..."
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 font-spectral placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setModalBloqueioAberto(false)}
                  className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 font-karla cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !motivoBloqueioInput.trim()}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 font-karla cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isPending ? "Bloqueando..." : "Bloquear data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Marcar Reunião / Enviar Convite */}
      {modalReuniaoAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) {
              setModalReuniaoAberto(false);
            }
          }}
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-5 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-[#133C1B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <h2 className="text-lg font-bold text-zinc-900 font-karla">
                  Marcar Reunião
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalReuniaoAberto(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-zinc-500 font-spectral">
              {isAluno
                ? "Envie um convite de reunião para o seu orientador."
                : "Selecione o orientando e defina a data e horário para a reunião."}
            </p>

            {erroReuniao && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 font-karla">
                {erroReuniao}
              </div>
            )}

            <form onSubmit={handleEnviarReuniao} className="space-y-4">
              {/* Participante */}
              {!isAluno ? (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla">
                    Orientando
                  </label>
                  <select
                    required
                    value={alunoSelecionadoId}
                    onChange={(e) => setAlunoSelecionadoId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 font-karla focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20"
                  >
                    {orientandosIniciais.length === 0 ? (
                      <option value="">Nenhum orientando disponível</option>
                    ) : (
                      orientandosIniciais.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nome} ({o.email})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla">
                    Orientador
                  </label>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-sm text-zinc-800 font-karla">
                    {orientadorInicial ? (
                      <div>
                        <p className="font-bold">{orientadorInicial.nome}</p>
                        <p className="text-xs text-zinc-500 font-spectral">{orientadorInicial.email}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700">Você ainda não possui um orientador vinculado.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Data e Horário em 2 colunas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla">
                    Data
                  </label>
                  <input
                    type="date"
                    required
                    value={dataReuniaoInput}
                    onChange={(e) => setDataReuniaoInput(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 font-karla focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla">
                    Horário
                  </label>
                  <input
                    type="time"
                    required
                    value={horarioReuniaoInput}
                    onChange={(e) => setHorarioReuniaoInput(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 font-karla focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20"
                  />
                </div>
              </div>

              {/* Pauta / Título da Reunião */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla">
                  Pauta / Assunto da reunião (opcional)
                </label>
                <input
                  type="text"
                  value={pautaReuniaoInput}
                  onChange={(e) => setPautaReuniaoInput(e.target.value)}
                  placeholder="Ex: Alinhamento sobre a metodologia e cronograma"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm text-zinc-900 font-spectral placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20"
                />
              </div>

              {/* Videoconferência do Google Meet */}
              <div className="space-y-2.5 pt-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla">
                  Videoconferência (Google Meet)
                </label>

                {!incluirMeetInput ? (
                  <button
                    type="button"
                    onClick={handleAtivarMeetFormulario}
                    className="w-full flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 px-4 py-3 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-blue-200 text-blue-600 shadow-2xs">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-blue-900 font-karla">
                          Adicionar videoconferência do Google Meet
                        </p>
                        <p className="text-[11px] text-blue-700 font-spectral">
                          Gera automaticamente um link de sala do Google Meet para a reunião
                        </p>
                      </div>
                    </div>
                    <span className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white font-karla group-hover:bg-blue-700 transition-colors">
                      + Adicionar Meet
                    </span>
                  </button>
                ) : (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                          </svg>
                        </span>
                        <span className="text-xs font-bold text-blue-900 font-karla">
                          Reunião no Google Meet ativada
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIncluirMeetInput(false);
                          setMeetLinkInput("");
                        }}
                        className="text-[11px] font-semibold text-red-600 hover:underline font-karla cursor-pointer"
                      >
                        Remover Meet
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-semibold text-blue-900 font-karla">
                        Link da sala do Google Meet (gerado automaticamente ou cole o seu):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          value={meetLinkInput}
                          onChange={(e) => setMeetLinkInput(e.target.value)}
                          placeholder="https://meet.google.com/xxx-xxxx-xxx"
                          className="flex-1 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs text-zinc-800 font-karla focus:border-blue-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setMeetLinkInput(gerarCodigoMeetCliente())}
                          title="Gerar novo código de sala"
                          className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 font-karla cursor-pointer shrink-0"
                        >
                          Gerar novo
                        </button>
                        <a
                          href="https://meet.google.com/new"
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir uma sala instantânea no Google Meet"
                          className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 font-karla shrink-0"
                        >
                          Criar no Meet ↗
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Opção de Sincronizar com Google Calendar */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5 flex items-center justify-between gap-3">
                <label
                  htmlFor="check-sync-google"
                  className="flex items-center gap-2.5 text-xs text-zinc-700 font-karla cursor-pointer select-none"
                >
                  <input
                    id="check-sync-google"
                    type="checkbox"
                    checked={sincronizarGoogleInput}
                    onChange={(e) => setSincronizarGoogleInput(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-[#133C1B] focus:ring-[#133C1B]"
                  />
                  <span>Sincronizar automaticamente com o Google Calendar</span>
                </label>
                {googleConectado && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 font-karla shrink-0">
                    Conta ativa
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setModalReuniaoAberto(false)}
                  className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 font-karla cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || (isAluno && !orientadorInicial)}
                  className="rounded-xl bg-[#133C1B] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1a4f24] font-karla cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isPending ? "Enviando convite..." : "Enviar convite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Sincronização com Google Calendar */}
      {modalGoogleAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget && !sincronizandoGoogle) {
              setModalGoogleAberto(false);
            }
          }}
        >
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-5 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 border border-blue-100">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="17" rx="3" fill="#FFFFFF" stroke="#4285F4" strokeWidth="1.8" />
                    <path d="M3 9H21" stroke="#4285F4" strokeWidth="1.8" />
                    <rect x="7" y="2" width="2" height="4" rx="1" fill="#EA4335" />
                    <rect x="15" y="2" width="2" height="4" rx="1" fill="#EA4335" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 font-karla">
                    Integração com Google Calendar &amp; Meet
                  </h2>
                  <p className="text-xs text-zinc-500 font-spectral">
                    Vincule sua conta Google, sincronize reuniões e gere salas do Google Meet.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalGoogleAberto(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Card de Conexão da Conta Google */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla block">
                    Conta Google Vinculada
                  </span>
                  {googleConectado && emailGoogleConectado ? (
                    <p className="text-sm font-bold text-zinc-900 font-karla mt-0.5">
                      {emailGoogleConectado}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500 font-spectral mt-0.5">
                      Conecte seu e-mail Google para sincronizar eventos e criar links do Google Meet automaticamente.
                    </p>
                  )}
                </div>

                {googleConectado ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 font-karla">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Conectado e Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200 font-karla">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Desconectado
                  </span>
                )}
              </div>

              {!googleConectado ? (
                <form onSubmit={handleConectarGoogle} className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 font-karla">
                      E-mail da sua conta Google
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        required
                        value={emailGoogleInput}
                        onChange={(e) => setEmailGoogleInput(e.target.value)}
                        placeholder="seuemail@gmail.com"
                        className="flex-1 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs sm:text-sm text-zinc-900 font-karla focus:border-[#133C1B] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={sincronizandoGoogle}
                        className="rounded-xl bg-[#133C1B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1a4f24] transition-all font-karla cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                      >
                        {sincronizandoGoogle ? "Conectando..." : "Conectar Conta Google"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200/70">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSincronizarGoogle}
                      disabled={sincronizandoGoogle}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#133C1B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1a4f24] transition-all font-karla cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <svg className={`h-3.5 w-3.5 ${sincronizandoGoogle ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      <span>{sincronizandoGoogle ? "Sincronizando..." : "Sincronizar todas agora"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportarICS}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-all font-karla cursor-pointer"
                    >
                      <svg className="h-3.5 w-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      <span>Exportar agenda (.ics)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleDesconectarGoogle}
                    disabled={sincronizandoGoogle}
                    className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors font-karla cursor-pointer"
                  >
                    Desconectar
                  </button>
                </div>
              )}
            </div>

            {/* Lista de Reuniões Agendadas e Status no Google Calendar / Meet */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600 font-karla">
                  Reuniões Agendadas ({reunioes.filter((r) => r.status === "AGENDADA").length})
                </h4>
                {reunioes.filter((r) => r.status === "AGENDADA").length > 0 && !googleConectado && (
                  <button
                    type="button"
                    onClick={handleExportarICS}
                    className="text-[11px] font-semibold text-[#133C1B] hover:underline font-karla cursor-pointer"
                  >
                    Baixar arquivo .ics para importar
                  </button>
                )}
              </div>

              {reunioes.filter((r) => r.status === "AGENDADA").length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center">
                  <p className="text-xs text-zinc-500 font-spectral">
                    Nenhuma reunião agendada no momento para sincronizar.
                  </p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
                  {reunioes
                    .filter((r) => r.status === "AGENDADA")
                    .map((r) => {
                      const dataReuniao = new Date(r.data);
                      const dataFim = new Date(dataReuniao.getTime() + 60 * 60 * 1000);

                      const startIso = dataReuniao
                        .toISOString()
                        .replace(/-|:|\.\d\d\d/g, "");
                      const endIso = dataFim
                        .toISOString()
                        .replace(/-|:|\.\d\d\d/g, "");

                      const titulo = encodeURIComponent(
                        r.pauta
                          ? `Orientação Scholab: ${r.pauta}`
                          : `Orientação Scholab: ${isAluno ? r.orientadorNome : r.alunoNome}`
                      );
                      const detalhes = encodeURIComponent(
                        `Reunião de orientação acadêmica agendada via Scholab.\nParticipante: ${
                          isAluno ? r.orientadorNome : r.alunoNome
                        }${r.meetLink ? `\nSala do Google Meet: ${r.meetLink}` : ""}`
                      );
                      const localizacao = encodeURIComponent(r.meetLink || "Google Meet");
                      const linkGoogleWeb = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&dates=${startIso}/${endIso}&details=${detalhes}&location=${localizacao}`;

                      return (
                        <div
                          key={r.id}
                          className="rounded-xl border border-zinc-200/90 bg-white p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-karla"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-zinc-900">
                                {r.dataDia.split("-").reverse().join("/")} às {r.horario}
                              </span>
                              {r.googleEventId ? (
                                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.2 text-[10px] font-bold text-emerald-700">
                                  ✓ Sincronizada
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.2 text-[10px] font-semibold text-amber-700">
                                  Pendente
                                </span>
                              )}
                            </div>
                            <p className="text-zinc-600 font-spectral truncate">
                              {isAluno ? `Orientador: ${r.orientadorNome}` : `Orientando: ${r.alunoNome}`}
                              {r.pauta ? ` — "${r.pauta}"` : ""}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {r.meetLink ? (
                              <a
                                href={r.meetLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                              >
                                <span>Meet</span>
                                <span>↗</span>
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAdicionarMeetNaReuniao(r.id)}
                                disabled={isPending}
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                              >
                                <span>+ Gerar Meet</span>
                              </button>
                            )}

                            <a
                              href={linkGoogleWeb}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => handleMarcarSincronizadaIndividual(r.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
                            >
                              <span>Abrir no Google Calendar</span>
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setModalGoogleAberto(false)}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 font-karla cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Convites de Reunião Detalhados */}
      {modalConvitesAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) {
              setModalConvitesAberto(false);
            }
          }}
        >
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-5 text-left max-h-[90vh] overflow-y-auto">
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[#133C1B] border border-emerald-100">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 font-karla">
                    Convites de Reunião
                  </h2>
                  <p className="text-xs text-zinc-500 font-spectral">
                    Veja todos os detalhes dos convites, participantes, pautas e links de videochamada.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalConvitesAberto(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Abas e Filtros de Status */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 pb-3">
              {/* Abas: Recebidos / Enviados / Todos */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100/80 border border-zinc-200/60 font-karla text-xs">
                <button
                  type="button"
                  onClick={() => setAbaConvites("recebidos")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    abaConvites === "recebidos"
                      ? "bg-white text-[#133C1B] shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <span>Recebidos</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      abaConvites === "recebidos"
                        ? "bg-emerald-100 text-[#133C1B]"
                        : "bg-zinc-200 text-zinc-600"
                    }`}
                  >
                    {convitesRecebidos.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAbaConvites("enviados")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    abaConvites === "enviados"
                      ? "bg-white text-[#133C1B] shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <span>Enviados</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      abaConvites === "enviados"
                        ? "bg-emerald-100 text-[#133C1B]"
                        : "bg-zinc-200 text-zinc-600"
                    }`}
                  >
                    {convitesEnviados.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAbaConvites("todos")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    abaConvites === "todos"
                      ? "bg-white text-[#133C1B] shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <span>Todos</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      abaConvites === "todos"
                        ? "bg-emerald-100 text-[#133C1B]"
                        : "bg-zinc-200 text-zinc-600"
                    }`}
                  >
                    {convites.length}
                  </span>
                </button>
              </div>

              {/* Filtro de Status */}
              <div className="flex items-center gap-1.5 font-karla text-xs">
                <span className="text-zinc-500 font-semibold text-[11px]">Filtrar:</span>
                <select
                  value={filtroStatusConvite}
                  onChange={(e) => setFiltroStatusConvite(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 font-karla focus:outline-none focus:border-[#133C1B]"
                >
                  <option value="TODOS">Todos os status</option>
                  <option value="PENDENTE">Pendentes de aceite</option>
                  <option value="AGENDADA">Agendadas</option>
                  <option value="REALIZADA">Realizadas</option>
                  <option value="RECUSADA">Recusadas</option>
                  <option value="CANCELADA">Canceladas</option>
                </select>
              </div>
            </div>

            {/* Lista de Convites Detalhados */}
            <div className="space-y-4">
              {convitesFiltrados.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-400 border border-zinc-200">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-zinc-700 font-karla">
                    Nenhum convite encontrado nesta categoria
                  </p>
                  <p className="text-xs text-zinc-500 font-spectral max-w-sm mx-auto">
                    Não há convites correspondentes aos filtros selecionados. Você pode agendar uma nova reunião usando o botão abaixo.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setModalConvitesAberto(false);
                      handleAbrirModalReuniao();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#133C1B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1a4f24] transition-all font-karla cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span>Marcar nova reunião</span>
                  </button>
                </div>
              ) : (
                convitesFiltrados.map((convite) => {
                  const dInicio = new Date(convite.data);
                  const dTermino = new Date(dInicio.getTime() + 60 * 60 * 1000);
                  const agora = new Date();
                  const diffDias = Math.round(
                    (new Date(dInicio.getFullYear(), dInicio.getMonth(), dInicio.getDate()).getTime() -
                      new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()) /
                      (1000 * 60 * 60 * 24)
                  );

                  let badgeMomento = "";
                  let corMomento = "bg-zinc-100 text-zinc-700";
                  if (diffDias === 0) {
                    badgeMomento = "Hoje";
                    corMomento = "bg-emerald-50 text-emerald-800 border-emerald-200 border";
                  } else if (diffDias === 1) {
                    badgeMomento = "Amanhã";
                    corMomento = "bg-blue-50 text-blue-800 border-blue-200 border";
                  } else if (diffDias > 1 && diffDias <= 7) {
                    badgeMomento = `Em ${diffDias} dias`;
                    corMomento = "bg-indigo-50 text-indigo-800 border-indigo-200 border";
                  } else if (diffDias < 0) {
                    badgeMomento = "Passada";
                    corMomento = "bg-zinc-100 text-zinc-600";
                  }

                  // Dados para link Google Calendar
                  const startIso = dInicio.toISOString().replace(/-|:|\.\d\d\d/g, "");
                  const endIso = dTermino.toISOString().replace(/-|:|\.\d\d\d/g, "");
                  const tit = encodeURIComponent(
                    convite.pauta
                      ? `Orientação Scholab: ${convite.pauta}`
                      : `Orientação Scholab: ${convite.outroParticipante.nome}`
                  );
                  const det = encodeURIComponent(
                    `Reunião de orientação via Scholab.\nCom: ${convite.outroParticipante.nome} (${convite.outroParticipante.email})\n${
                      convite.meetLink ? `Link do Google Meet: ${convite.meetLink}` : ""
                    }`
                  );
                  const linkGoogle = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${tit}&dates=${startIso}/${endIso}&details=${det}`;

                  return (
                    <div
                      key={convite.id}
                      className="rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5 shadow-2xs hover:border-zinc-300 transition-all space-y-4"
                    >
                      {/* Topo do Card: Participante + Status e Origem */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-100">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#133C1B] font-bold text-sm font-karla border border-emerald-100">
                            {convite.outroParticipante.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm sm:text-base text-zinc-900 font-karla">
                                {convite.outroParticipante.nome}
                              </span>
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600 font-karla">
                                {convite.outroParticipante.papel}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 font-spectral">
                              {convite.outroParticipante.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold font-karla ${
                              convite.status === "AGENDADA"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : convite.status === "PENDENTE"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : convite.status === "REALIZADA"
                                ? "bg-zinc-100 text-zinc-700 border border-zinc-200"
                                : convite.status === "CANCELADA" || convite.status === "RECUSADA"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                convite.status === "AGENDADA"
                                  ? "bg-emerald-500"
                                  : convite.status === "PENDENTE"
                                  ? "bg-amber-500"
                                  : convite.status === "REALIZADA"
                                  ? "bg-zinc-400"
                                  : convite.status === "CANCELADA" || convite.status === "RECUSADA"
                                  ? "bg-red-500"
                                  : "bg-amber-500"
                              }`}
                            />
                            {convite.status === "AGENDADA"
                              ? "Agendada"
                              : convite.status === "PENDENTE"
                              ? "Pendente de aceite"
                              : convite.status === "REALIZADA"
                              ? "Realizada"
                              : convite.status === "RECUSADA"
                              ? "Recusada"
                              : convite.status === "CANCELADA"
                              ? "Cancelada"
                              : "Falta"}
                          </span>

                          <span
                            className={`rounded-lg px-2 py-0.5 text-[11px] font-bold font-karla ${
                              convite.enviadoPorMim
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}
                          >
                            {convite.enviadoPorMim ? "Enviado por você" : "Recebido"}
                          </span>
                        </div>
                      </div>

                      {/* Bloco Central com Data, Horário e Pauta em Destaque */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-karla">
                        {/* Data e Horário */}
                        <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                              <svg className="h-3.5 w-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                              </svg>
                              <span>Data e Horário</span>
                            </div>
                            {badgeMomento && (
                              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${corMomento}`}>
                                {badgeMomento}
                              </span>
                            )}
                          </div>

                          <p className="font-bold text-sm text-zinc-900 capitalize">
                            {convite.dataCompletaPt}
                          </p>

                          <div className="flex items-center gap-2 text-zinc-700">
                            <span className="font-semibold text-zinc-900">
                              {convite.horario} às {convite.horarioFim}
                            </span>
                            <span className="text-zinc-400">•</span>
                            <span className="text-zinc-500">1 hora de duração</span>
                          </div>
                        </div>

                        {/* Pauta */}
                        <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 space-y-2">
                          <div className="flex items-center gap-1.5 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                            <svg className="h-3.5 w-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                            </svg>
                            <span>Pauta / Assunto</span>
                          </div>

                          {convite.pauta ? (
                            <p className="text-zinc-800 font-spectral text-sm italic leading-relaxed">
                              &quot;{convite.pauta}&quot;
                            </p>
                          ) : (
                            <p className="text-zinc-400 font-spectral text-xs italic">
                              Sem pauta específica definida para este encontro.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Justificativa da Recusa se houver */}
                      {convite.status === "RECUSADA" && convite.justificativaRecusa && (
                        <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs font-karla text-red-900 space-y-1">
                          <p className="font-bold text-red-800">Justificativa da recusa:</p>
                          <p className="font-spectral italic text-red-900">
                            &quot;{convite.justificativaRecusa}&quot;
                          </p>
                        </div>
                      )}

                      {/* Videochamada Google Meet (se disponível ou botão para gerar) */}
                      {convite.meetLink ? (
                        <div className="rounded-xl border border-blue-200/90 bg-blue-50/60 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                          <div className="flex items-center gap-2">
                            <svg className="h-5 w-5 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                            </svg>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-blue-900 font-karla block">
                                Sala do Google Meet disponível
                              </span>
                              <span className="text-[11px] text-blue-700 font-spectral truncate block">
                                {convite.meetLink}
                              </span>
                            </div>
                          </div>
                          <a
                            href={convite.meetLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors font-karla shadow-2xs shrink-0"
                          >
                            <span>Entrar na videochamada</span>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </a>
                        </div>
                      ) : (
                        convite.status === "AGENDADA" && (
                          <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/30 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                            <span className="text-xs text-blue-900 font-karla">
                              Esta reunião ainda não possui sala do Google Meet vinculada.
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAdicionarMeetNaReuniao(convite.id)}
                              disabled={isPending}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors font-karla cursor-pointer shrink-0"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                              </svg>
                              <span>+ Adicionar Reunião no Meet</span>
                            </button>
                          </div>
                        )
                      )}

                      {/* Rodapé do Card: Ações Rápidas */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Botão Ver no Calendário */}
                          <button
                            type="button"
                            onClick={() => handlePularParaDataNoCalendario(convite.dataDia)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-95 transition-all font-karla cursor-pointer shadow-2xs"
                          >
                            <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                            <span>Ver no calendário</span>
                          </button>

                          {/* Botão Adicionar ao Google Calendar (apenas se agendada) */}
                          {convite.status === "AGENDADA" && (
                            <a
                              href={linkGoogle}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => handleMarcarSincronizadaIndividual(convite.id)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-95 transition-all font-karla cursor-pointer shadow-2xs"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                                <rect x="3" y="4" width="18" height="17" rx="3" fill="#FFFFFF" stroke="#4285F4" strokeWidth="1.8" />
                                <path d="M3 9H21" stroke="#4285F4" strokeWidth="1.8" />
                                <rect x="7" y="2" width="2" height="4" rx="1" fill="#EA4335" />
                                <rect x="15" y="2" width="2" height="4" rx="1" fill="#EA4335" />
                              </svg>
                              <span>{convite.googleEventId ? "Sincronizada no Google (Abrir)" : "Adicionar à Agenda Google"}</span>
                            </a>
                          )}
                        </div>

                        {/* Ações dependendo do status e de quem enviou */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {convite.status === "PENDENTE" && !convite.enviadoPorMim && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setConviteParaRecusar(convite);
                                  setJustificativaRecusaInput("");
                                  setErroRecusa("");
                                }}
                                disabled={isPending}
                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors font-karla cursor-pointer"
                              >
                                Recusar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAceitarConviteNoModal(convite.id)}
                                disabled={isPending}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#133C1B] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1a4f24] transition-colors font-karla cursor-pointer shadow-2xs"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                <span>Aceitar convite</span>
                              </button>
                            </>
                          )}

                          {convite.status === "PENDENTE" && convite.enviadoPorMim && (
                            <button
                              type="button"
                              onClick={() => handleCancelarReuniao(convite.id)}
                              disabled={isPending}
                              className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors font-karla cursor-pointer"
                            >
                              Cancelar convite
                            </button>
                          )}

                          {convite.status === "AGENDADA" && (
                            <button
                              type="button"
                              onClick={() => handleCancelarReuniao(convite.id)}
                              disabled={isPending}
                              className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors font-karla cursor-pointer shrink-0"
                            >
                              Cancelar reunião
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé do Modal com Botão Fechar */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
              <span className="text-xs text-zinc-500 font-spectral">
                Total de {convitesFiltrados.length} item(ns) listado(s).
              </span>
              <button
                type="button"
                onClick={() => setModalConvitesAberto(false)}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 font-karla cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Confirmação de Cancelamento de Reunião no design do site */}
      {reuniaoParaCancelar && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => setReuniaoParaCancelar(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 border border-red-100 text-red-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-extrabold text-zinc-900 font-karla">
                  Tem certeza que quer cancelar?
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-zinc-500 font-spectral leading-relaxed">
                  Ao confirmar, esta reunião será desmarcada do calendário e não poderá ser desfeita.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setReuniaoParaCancelar(null)}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors font-karla cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={confirmarCancelamentoReuniao}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors font-karla cursor-pointer shadow-xs"
              >
                {isPending ? "Cancelando..." : "Sim, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Justificativa obrigatória para recusar convite de reunião */}
      {conviteParaRecusar && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => setConviteParaRecusar(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-zinc-900 font-karla">
                  Recusar Convite de Reunião
                </h3>
                <p className="mt-1 text-xs text-zinc-500 font-spectral">
                  Para recusar o convite de {conviteParaRecusar.outroParticipante.nome}, escreva obrigatoriamente uma justificativa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConviteParaRecusar(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 font-karla mb-1.5">
                Justificativa da recusa <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={3}
                value={justificativaRecusaInput}
                onChange={(e) => {
                  setJustificativaRecusaInput(e.target.value);
                  if (erroRecusa) setErroRecusa("");
                }}
                placeholder="Ex.: Estarei em outro compromisso nesse horário, podemos remarcar?"
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#133C1B] focus:bg-white focus:outline-none font-spectral resize-none"
              />
              {erroRecusa && (
                <p className="mt-1.5 text-xs font-semibold text-red-600 font-karla">
                  {erroRecusa}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setConviteParaRecusar(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors font-karla cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={enviandoRecusa}
                onClick={async () => {
                  const just = justificativaRecusaInput.trim();
                  if (!just) {
                    setErroRecusa("É obrigatório informar uma justificativa para recusar a reunião.");
                    return;
                  }
                  setEnviandoRecusa(true);
                  try {
                    const res = await recusarConviteReuniao(conviteParaRecusar.id, just);
                    if (!res.ok) {
                      setErroRecusa(res.erro || "Erro ao recusar convite.");
                    } else {
                      const dados = await obterDadosCalendario(mesAtual, anoAtual);
                      setReunioes(dados.reunioes);
                      setConvites(dados.convites);
                      setConviteParaRecusar(null);
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


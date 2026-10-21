import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obterOuCriarSemOrientadorId } from "@/lib/guards";
import { TopbarHeader } from "@/components/topbar-header";
import {
  obterNotificacoesAluno,
  verificarEObterAlertasProfessor,
  formatarMensagemAlertaParaAluno,
  formatarMensagemAlertaParaProfessor,
} from "@/lib/dados-alertas";
import {
  AlertasAlunoContent,
  type AlertaAlunoItem,
} from "./alertas-aluno-content";
import {
  AlertasProfessorContent,
  type AlertaProfessorItem,
} from "./alertas-professor-content";

const ROTULOS_TIPO: Record<string, string> = {
  DIAS_SEM_REUNIAO: "Dias sem reunião",
  TAREFA_ATRASADA: "Tarefa atrasada",
  PRAZO_PROXIMO: "Prazo próximo",
  FALTA_SEM_AVISO: "Falta sem aviso",
  CHECKIN_NAO_PREENCHIDO: "Check-in não preenchido",
  NOVA_MARCACAO: "Marcação em artigo",
  CONVITE_ORIENTACAO: "Convite de orientação",
};

export default async function AlertasUniversalPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    include: {
      aluno: true,
    },
  });

  if (!usuario) {
    redirect("/login");
  }

  const isAluno = usuario.papel === "ALUNO";

  if (isAluno) {
    // Busca dados do aluno
    let aluno = usuario.aluno;
    if (!aluno && usuario.email) {
      aluno = await prisma.aluno.findUnique({
        where: { email: usuario.email.toLowerCase().trim() },
      });
    }

    if (!aluno) {
      const semOrientadorId = await obterOuCriarSemOrientadorId();
      aluno = await prisma.aluno.create({
        data: {
          nome: usuario.nome,
          email: usuario.email.toLowerCase().trim(),
          nivel: "TCC",
          dataInicio: new Date(),
          orientadorId: semOrientadorId,
          usuarioId: usuario.id,
        },
      });
    }

    // Notificações para o sininho da topbar (também verifica se há alerta de 1 semana sem reunião)
    const notificacoesTopbar = await obterNotificacoesAluno(aluno.id);

    // 1. Alertas da tabela 'alerta'
    const alertasDb = await prisma.alerta.findMany({
      where: { alunoId: aluno.id },
      orderBy: { criadoEm: "desc" },
    });

    const alertasDbUnicos = alertasDb.filter((alerta, index, self) => {
      if (alerta.resolvido) return true;
      return index === self.findIndex((a) => !a.resolvido && a.tipo === alerta.tipo && a.alunoId === alerta.alunoId);
    });

    // 2. Notificações da tabela 'notificacao_aluno'
    let notificacoesDb: Array<{
      id: string;
      alunoId: string;
      producaoId: string | null;
      mensagem: string;
      lida: boolean;
      criadoEm: Date;
    }> = [];

    try {
      notificacoesDb = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          alunoId: string;
          producaoId: string | null;
          mensagem: string;
          lida: boolean;
          criadoEm: Date;
        }>
      >(
        `SELECT id, "alunoId", "producaoId", mensagem, lida, "criadoEm" FROM notificacao_aluno WHERE "alunoId" = $1 ORDER BY "criadoEm" DESC`,
        aluno.id
      );
    } catch {
      // Silencioso se tabela vazia
    }

    const itensAluno: AlertaAlunoItem[] = [
      ...alertasDbUnicos.map((a) => {
        let link: string | undefined = undefined;
        let linkRotulo: string | undefined = undefined;

        if (a.mensagem.includes("|||")) {
          const parts = a.mensagem.split("|||").map((s) => s.trim());
          const producaoId = parts[2];
          link = producaoId ? `/producao/${producaoId}` : "/producao";
          linkRotulo = "Ver produção";
        } else if (a.tipo === "CHECKIN_NAO_PREENCHIDO") {
          link = "/reunioes";
          linkRotulo = "Minhas reuniões";
        } else if (a.tipo === "TAREFA_ATRASADA" || a.tipo === "PRAZO_PROXIMO") {
          link = "/entregas";
          linkRotulo = "Ver entregas";
        } else if (a.tipo === "DIAS_SEM_REUNIAO") {
          link = "/agendar";
          linkRotulo = "Agendar reunião";
        } else if (a.tipo === "FALTA_SEM_AVISO") {
          link = "/reunioes";
          linkRotulo = "Minhas reuniões";
        }

        return {
          id: a.id,
          origem: "ALERTA" as const,
          tipo: a.tipo,
          tipoRotulo: ROTULOS_TIPO[a.tipo] ?? a.tipo,
          mensagem: formatarMensagemAlertaParaAluno(a.mensagem, aluno.nome, a.tipo),
          criadoEm: a.criadoEm.toISOString(),
          resolvido: a.resolvido,
          link,
          linkRotulo,
        };
      }),
      ...notificacoesDb.map((n) => {
        const isConvite =
          n.mensagem.includes("||| CONVITE_ORIENTACAO |||") || n.id.startsWith("conv_");

        if (isConvite) {
          const parts = n.mensagem.split("|||").map((s) => s.trim());
          return {
            id: n.id,
            origem: "NOTIFICACAO" as const,
            tipo: "CONVITE_ORIENTACAO",
            tipoRotulo: "Convite de orientação",
            mensagem: parts[0],
            criadoEm: new Date(n.criadoEm).toISOString(),
            resolvido: n.lida,
          };
        }

        return {
          id: n.id,
          origem: "NOTIFICACAO" as const,
          tipo: "NOVA_MARCACAO",
          tipoRotulo: "Marcação em artigo",
          mensagem: n.mensagem,
          criadoEm: new Date(n.criadoEm).toISOString(),
          resolvido: n.lida,
          link: n.producaoId ? `/producao/${n.producaoId}` : "/producao",
          linkRotulo: "Ver artigo",
        };
      }),
    ];

    itensAluno.sort(
      (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    );

    return (
      <div className="flex min-h-screen flex-col bg-zinc-50 font-spectral">
        <TopbarHeader
          userName={usuario.nome}
          userEmail={usuario.email}
          role="ALUNO"
          centerTitle="Alertas"
          notificacoes={notificacoesTopbar}
        />
        <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 font-spectral">
          <AlertasAlunoContent itensIniciais={itensAluno} />
        </main>
      </div>
    );
  }

  // Papel: PROFESSOR / COORIENTADOR
  const notificacoesTopbar = await verificarEObterAlertasProfessor(usuario.id);

  const alertas = await prisma.alerta.findMany({
    where: { aluno: { orientadorId: usuario.id } },
    include: { aluno: true },
    orderBy: { criadoEm: "desc" },
  });

  const alertasProfessorUnicos = alertas.filter((alerta, index, self) => {
    if (alerta.resolvido) return true;
    return index === self.findIndex((a) => !a.resolvido && a.tipo === alerta.tipo && a.alunoId === alerta.alunoId);
  });

  const itensProfessor: AlertaProfessorItem[] = alertasProfessorUnicos.map((a) => ({
    id: a.id,
    tipo: a.tipo,
    tipoRotulo: ROTULOS_TIPO[a.tipo] ?? a.tipo,
    mensagem: formatarMensagemAlertaParaProfessor(a.mensagem),
    criadoEm: a.criadoEm.toISOString(),
    resolvido: a.resolvido,
    alunoId: a.alunoId,
    alunoNome: a.aluno.nome,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-spectral">
      <TopbarHeader
        userName={usuario.nome}
        userEmail={usuario.email}
        role="PROFESSOR"
        centerTitle="Alertas"
        notificacoes={notificacoesTopbar}
      />
      <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 font-spectral">
        <AlertasProfessorContent alertasIniciais={itensProfessor} />
      </main>
    </div>
  );
}


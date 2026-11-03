import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obterOuCriarSemOrientadorId } from "@/lib/guards";
import { TopbarHeader } from "@/components/topbar-header";
import {
  obterNotificacoesAluno,
  verificarEObterAlertasProfessor,
} from "@/lib/dados-alertas";
import { obterDadosCalendario } from "@/lib/actions/calendario";
import { obterHistoricoReunioes } from "@/lib/actions/historico-reunioes";
import { obterGestaoAtividades } from "@/lib/actions/atividades-reuniao";
import { ReunioesTabsContainer } from "./reunioes-tabs-container";

export default async function ReunioesPage({
  searchParams,
}: {
  searchParams: Promise<{
    google?: string;
    modal?: string;
    aba?: string;
    alunoId?: string;
  }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;

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
  const hoje = new Date();

  const [dadosCalendario, historico, gestaoAtividades] = await Promise.all([
    obterDadosCalendario(hoje.getMonth() + 1, hoje.getFullYear()),
    obterHistoricoReunioes(params.alunoId),
    obterGestaoAtividades(params.alunoId),
  ]);

  if (isAluno) {
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

    const notificacoesTopbar = await obterNotificacoesAluno(aluno.id);

    return (
      <div className="flex min-h-screen flex-col bg-zinc-50 font-spectral">
        <TopbarHeader
          userName={usuario.nome}
          userEmail={usuario.email}
          role="ALUNO"
          centerTitle="Reuniões"
          notificacoes={notificacoesTopbar}
        />
        <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 font-spectral">
          <div className="relative min-h-[calc(100vh-10rem)] flex flex-col pb-24 text-left">
            <div className="mb-6 sm:mb-8 text-left w-full print:hidden">
              <p className="text-sm sm:text-base text-zinc-600 font-spectral leading-relaxed text-left">
                Marque e fique por dentro das reuniões marcadas com o seu orientador, visualize o histórico e gerencie as atividades combinadas.
              </p>
            </div>

            <ReunioesTabsContainer
              isAluno={true}
              userEmail={usuario.email}
              dadosCalendario={dadosCalendario}
              historico={historico}
              gestaoAtividades={gestaoAtividades}
              googleCallbackStatus={params.google}
              abrirModalGoogleInicial={
                params.modal === "google" || Boolean(params.google)
              }
              abaInicial={params.aba}
              alunoId={params.alunoId}
            />
          </div>
        </main>
      </div>
    );
  }

  // Papel: PROFESSOR / COORIENTADOR
  const notificacoesTopbar = await verificarEObterAlertasProfessor(usuario.id);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-spectral">
      <TopbarHeader
        userName={usuario.nome}
        userEmail={usuario.email}
        role="PROFESSOR"
        centerTitle="Reuniões"
        notificacoes={notificacoesTopbar}
      />
      <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 font-spectral">
        <div className="relative min-h-[calc(100vh-10rem)] flex flex-col pb-24 text-left">
          <div className="mb-6 sm:mb-8 text-left w-full print:hidden">
            <p className="text-sm sm:text-base text-zinc-600 font-spectral leading-relaxed text-left">
              Marque e acompanhe as reuniões com seus orientandos, consulte o histórico de atas e gerencie as atividades combinadas em cada encontro.
            </p>
          </div>

          <ReunioesTabsContainer
            isAluno={false}
            userEmail={usuario.email}
            dadosCalendario={dadosCalendario}
            historico={historico}
            gestaoAtividades={gestaoAtividades}
            googleCallbackStatus={params.google}
            abrirModalGoogleInicial={
              params.modal === "google" || Boolean(params.google)
            }
            abaInicial={params.aba}
            alunoId={params.alunoId}
          />
        </div>
      </main>
    </div>
  );
}

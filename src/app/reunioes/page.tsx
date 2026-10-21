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
import { CalendarioContent } from "./calendario-content";

export default async function ReunioesPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; modal?: string }>;
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
  const dadosIniciais = await obterDadosCalendario(
    hoje.getMonth() + 1,
    hoje.getFullYear()
  );

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
            <div className="mb-6 sm:mb-8 text-left w-full">
              <p className="text-sm sm:text-base text-zinc-600 font-spectral leading-relaxed text-left">
                Marque e fique por dentro das reuniões marcadas com o seu orientador.
              </p>
            </div>

            <CalendarioContent
              isAluno={true}
              userEmail={usuario.email}
              reunioesIniciais={dadosIniciais.reunioes}
              bloqueiosIniciais={dadosIniciais.bloqueios}
              googleConectadoInicial={dadosIniciais.googleConectado}
              emailGoogleConectadoInicial={dadosIniciais.emailGoogleConectado}
              orientandosIniciais={dadosIniciais.orientandos}
              orientadorInicial={dadosIniciais.orientador}
              convitesIniciais={dadosIniciais.convites}
              googleCallbackStatus={params.google}
              abrirModalGoogleInicial={
                params.modal === "google" || Boolean(params.google)
              }
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
          <div className="mb-6 sm:mb-8 text-left w-full">
            <p className="text-sm sm:text-base text-zinc-600 font-spectral leading-relaxed text-left">
              Marque e fique por dentro das reuniões marcadas com o(s) seu(s) orientando(s).
            </p>
          </div>

          <CalendarioContent
            isAluno={false}
            userEmail={usuario.email}
            reunioesIniciais={dadosIniciais.reunioes}
            bloqueiosIniciais={dadosIniciais.bloqueios}
            googleConectadoInicial={dadosIniciais.googleConectado}
            emailGoogleConectadoInicial={dadosIniciais.emailGoogleConectado}
            orientandosIniciais={dadosIniciais.orientandos}
            orientadorInicial={dadosIniciais.orientador}
            convitesIniciais={dadosIniciais.convites}
            googleCallbackStatus={params.google}
            abrirModalGoogleInicial={
              params.modal === "google" || Boolean(params.google)
            }
          />
        </div>
      </main>
    </div>
  );
}

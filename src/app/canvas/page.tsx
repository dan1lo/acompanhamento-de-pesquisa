import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopbarHeader } from "@/components/topbar-header";
import {
  obterNotificacoesAluno,
  verificarEObterAlertasProfessor,
} from "@/lib/dados-alertas";
import { obterCanvasAluno } from "@/lib/actions/canvas";
import { CanvasContent } from "./canvas-content";

export default async function CanvasPage({
  searchParams,
}: {
  searchParams: Promise<{ alunoId?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { alunoId } = await searchParams;

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    include: {
      aluno: true,
      alunosOrientados: {
        where: { arquivado: false },
        select: { id: true, nome: true, nivel: true },
      },
    },
  });

  if (!usuario) {
    redirect("/login");
  }

  const isAluno = usuario.papel === "ALUNO";

  if (isAluno) {
    if (!usuario.aluno) {
      redirect("/inicio");
    }

    const [canvasRes, notificacoes] = await Promise.all([
      obterCanvasAluno(),
      obterNotificacoesAluno(usuario.aluno.id),
    ]);

    if (!canvasRes.canvas) {
      redirect("/inicio");
    }

    return (
      <div className="flex min-h-screen flex-col bg-zinc-50 font-spectral">
        <TopbarHeader
          userName={usuario.nome}
          userEmail={usuario.email}
          role="ALUNO"
          centerTitle="Canvas de Pesquisa"
          notificacoes={notificacoes}
        />
        <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 font-spectral">
          <div className="relative min-h-[calc(100vh-10rem)] flex flex-col pb-24 text-left">
            <div className="mb-6 sm:mb-8 text-left w-full print:hidden">
              <p className="text-sm sm:text-base text-zinc-600 font-spectral leading-relaxed text-left">
                Estruture colaborativamente o tema, objetivos, metodologia, lacunas e referências do seu trabalho com seu orientador.
              </p>
            </div>

            <CanvasContent canvasInicial={canvasRes.canvas} isAluno={true} />
          </div>
        </main>
      </div>
    );
  }

  // Professor / Coorientador
  const [canvasRes, notificacoes] = await Promise.all([
    obterCanvasAluno(alunoId),
    verificarEObterAlertasProfessor(usuario.id),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-spectral">
      <TopbarHeader
        userName={usuario.nome}
        userEmail={usuario.email}
        role="PROFESSOR"
        centerTitle="Canvas de Pesquisa"
        notificacoes={notificacoes}
      />
      <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 font-spectral">
        <div className="relative min-h-[calc(100vh-10rem)] flex flex-col pb-24 text-left">
          <div className="mb-6 sm:mb-8 text-left w-full print:hidden">
            <p className="text-sm sm:text-base text-zinc-600 font-spectral leading-relaxed text-left">
              Acompanhe e co-construa os fundamentos científicos, hipóteses e metodologia da pesquisa com seus orientandos.
            </p>
          </div>

          {canvasRes.canvas ? (
            <CanvasContent
              canvasInicial={canvasRes.canvas}
              isAluno={false}
              orientandos={usuario.alunosOrientados}
              alunoSelecionadoId={alunoId}
            />
          ) : (
            <div className="p-12 text-center rounded-2xl bg-white border border-zinc-200/90 text-zinc-500 font-spectral shadow-xs">
              Nenhum orientando selecionado ou cadastrado para visualização do Canvas.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


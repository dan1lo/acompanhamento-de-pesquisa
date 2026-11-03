import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopbarHeader } from "@/components/topbar-header";
import {
  obterNotificacoesAluno,
  verificarEObterAlertasProfessor,
} from "@/lib/dados-alertas";
import { obterRoadmapAluno } from "@/lib/actions/roadmap";
import { RoadmapContent } from "./roadmap-content";

export default async function RoadmapPage({
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

    const [roadmap, notificacoes] = await Promise.all([
      obterRoadmapAluno(),
      obterNotificacoesAluno(usuario.aluno.id),
    ]);

    if (!roadmap) {
      redirect("/inicio");
    }

    return (
      <div className="flex min-h-screen flex-col bg-zinc-50 font-spectral">
        <TopbarHeader
          userName={usuario.nome}
          userEmail={usuario.email}
          role="ALUNO"
          centerTitle="Quadro de Atividades"
          notificacoes={notificacoes}
        />
        <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 font-spectral">
          <div className="relative min-h-[calc(100vh-10rem)] flex flex-col pb-24 text-left">
            <div className="mb-6 sm:mb-8 text-left w-full print:hidden">
              <p className="text-sm sm:text-base text-zinc-600 font-spectral leading-relaxed text-left">
                Organize e acompanhe o quadro de atividades, escrita de seções e capítulos, estimativa de páginas e tarefas em conjunto entre você e seu orientador.
              </p>
            </div>

            <RoadmapContent roadmapInicial={roadmap} />
          </div>
        </main>
      </div>
    );
  }

  // Professor / Coorientador
  const [roadmap, notificacoes] = await Promise.all([
    obterRoadmapAluno(alunoId),
    verificarEObterAlertasProfessor(usuario.id),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-spectral">
      <TopbarHeader
        userName={usuario.nome}
        userEmail={usuario.email}
        role="PROFESSOR"
        centerTitle="Quadro de Atividades"
        notificacoes={notificacoes}
      />
      <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 font-spectral">
        <div className="relative min-h-[calc(100vh-10rem)] flex flex-col pb-24 text-left">
          <div className="mb-6 sm:mb-8 text-left w-full print:hidden">
            <p className="text-sm sm:text-base text-zinc-600 font-spectral leading-relaxed text-left">
              Gerencie e colabore no quadro de atividades da pesquisa dos seus orientandos com visualização em colunas, cards e cronograma.
            </p>
          </div>

          {roadmap ? (
            <RoadmapContent
              roadmapInicial={roadmap}
              alunoSelecionadoId={alunoId}
            />
          ) : (
            <div className="rounded-2xl border border-zinc-200/90 bg-white p-12 text-center text-zinc-500 shadow-xs font-spectral">
              Nenhum orientando selecionado ou cadastrado para visualização do Quadro de Atividades.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


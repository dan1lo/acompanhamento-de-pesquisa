import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TopbarHeader } from "@/components/topbar-header";
import { SignOutButton } from "@/components/sign-out-button";
import { formatarData } from "@/lib/datas";

export default async function PerfilPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    include: {
      conexaoGoogle: true,
      aluno: {
        include: {
          orientador: true,
        },
      },
    },
  });

  if (!usuario) {
    redirect("/login");
  }

  const isAluno = usuario.papel === "ALUNO";

  // Se aluno e não veio no include direto, busca pelo email
  let alunoData = usuario.aluno;
  if (isAluno && !alunoData && usuario.email) {
    alunoData = await prisma.aluno.findUnique({
      where: { email: usuario.email.toLowerCase().trim() },
      include: {
        orientador: true,
      },
    });
  }

  // Se professor, conta quantos alunos ativos orienta
  let totalAlunos = 0;
  if (!isAluno) {
    totalAlunos = await prisma.aluno.count({
      where: { orientadorId: usuario.id, arquivado: false },
    });
  }

  const inicial = (usuario.nome || "U").charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-spectral">
      <TopbarHeader
        userName={usuario.nome}
        userEmail={usuario.email}
        role={isAluno ? "ALUNO" : "PROFESSOR"}
      />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 space-y-6">
        {/* Cabeçalho da página */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 font-karla">
              Meu Perfil
            </h1>
            <p className="text-sm text-zinc-500 font-karla">
              Gerencie suas informações cadastrais e dados da sua conta no Scholab
            </p>
          </div>
          <Link
            href={isAluno ? "/inicio" : "/painel"}
            className="rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 font-karla transition-colors"
          >
            ← Voltar ao início
          </Link>
        </div>

        {/* Card 1: Identificação do Usuário */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#133C1B] text-2xl font-bold text-white shadow-md ring-4 ring-[#133C1B]/10 font-karla">
              {inicial}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="truncate text-xl font-bold text-zinc-900 font-karla">
                  {usuario.nome}
                </h2>
                <span className="inline-flex items-center rounded-full bg-[#133C1B]/10 px-2.5 py-0.5 text-xs font-bold text-[#133C1B] border border-[#133C1B]/15 font-karla tracking-wide">
                  {isAluno ? "Aluno" : "Orientador"}
                </span>
              </div>

              <p className="text-sm text-zinc-600 font-karla truncate">
                {usuario.email}
              </p>

              <p className="text-xs text-zinc-400 font-karla pt-1">
                Membro desde {formatarData(usuario.criadoEm)}
              </p>
            </div>
          </div>
        </section>

        {/* Card 2: Dados específicos do Aluno ou Orientador */}
        {isAluno ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-5">
            <div className="border-b border-zinc-100 pb-3">
              <h3 className="text-base font-semibold text-zinc-900 font-karla">
                Dados da Orientação Acadêmica
              </h3>
              <p className="text-xs text-zinc-500 font-karla">
                Informações vinculadas ao seu projeto e orientador
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-karla">
              <div className="rounded-xl bg-zinc-50/80 border border-zinc-100 p-4 space-y-1">
                <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                  Nível Acadêmico
                </span>
                <p className="font-semibold text-zinc-800">
                  {alunoData?.nivel || "TCC"}
                </p>
              </div>

              <div className="rounded-xl bg-zinc-50/80 border border-zinc-100 p-4 space-y-1">
                <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                  Orientador Responsável
                </span>
                <p className="font-semibold text-zinc-800">
                  {alunoData?.orientador?.nome || "Orientador do Programa"}
                </p>
                {alunoData?.orientador?.email && (
                  <p className="text-xs text-zinc-500 truncate">
                    {alunoData.orientador.email}
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-zinc-50/80 border border-zinc-100 p-4 space-y-1 sm:col-span-2">
                <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                  Tema da Pesquisa
                </span>
                <p className="font-medium text-zinc-800">
                  {alunoData?.tema || "Ainda não definido formalmente"}
                </p>
              </div>

              {alunoData?.dataInicio && (
                <div className="rounded-xl bg-zinc-50/80 border border-zinc-100 p-4 space-y-1 sm:col-span-2">
                  <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                    Início do Acompanhamento
                  </span>
                  <p className="font-semibold text-zinc-800">
                    {formatarData(alunoData.dataInicio)}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-zinc-100 flex flex-wrap gap-2">
              <Link
                href="/inicio"
                className="rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold px-3 py-2 transition-colors font-karla"
              >
                Ir para Início
              </Link>
              <Link
                href="/reunioes"
                className="rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold px-3 py-2 transition-colors font-karla"
              >
                Minhas Reuniões
              </Link>
              <Link
                href="/agendar"
                className="rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold px-3 py-2 transition-colors font-karla"
              >
                Agendar Reunião
              </Link>
              <Link
                href="/privacidade"
                className="rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold px-3 py-2 transition-colors font-karla"
              >
                Configurações & Privacidade (LGPD)
              </Link>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-5">
            <div className="border-b border-zinc-100 pb-3">
              <h3 className="text-base font-semibold text-zinc-900 font-karla">
                Atuação e Orientações
              </h3>
              <p className="text-xs text-zinc-500 font-karla">
                Status de orientandos e integrações da docência
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-karla">
              <div className="rounded-xl bg-zinc-50/80 border border-zinc-100 p-4 space-y-1">
                <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                  Alunos Orientados Ativos
                </span>
                <p className="text-2xl font-bold text-zinc-800">
                  {totalAlunos}
                </p>
              </div>

              <div className="rounded-xl bg-zinc-50/80 border border-zinc-100 p-4 space-y-1">
                <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                  Google Calendar & Meet
                </span>
                <div className="flex items-center gap-2 pt-1">
                  {usuario.conexaoGoogle?.conectado ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                      ● Conectado
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 border border-zinc-200">
                      Não conectado
                    </span>
                  )}
                  <Link
                    href="/configuracoes/google"
                    className="text-xs font-semibold text-[#133C1B] hover:underline"
                  >
                    Gerenciar conexão →
                  </Link>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100 flex flex-wrap gap-2">
              <Link
                href="/painel"
                className="rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold px-3 py-2 transition-colors font-karla"
              >
                Painel de Alunos
              </Link>
              <Link
                href="/fila"
                className="rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold px-3 py-2 transition-colors font-karla"
              >
                Quem Contatar Hoje
              </Link>
              <Link
                href="/horarios"
                className="rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold px-3 py-2 transition-colors font-karla"
              >
                Gerenciar Horários
              </Link>
              <Link
                href="/configuracoes/alertas"
                className="rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold px-3 py-2 transition-colors font-karla"
              >
                Configurações de Alertas
              </Link>
            </div>
          </section>
        )}

        {/* Card 3: Segurança & Conta */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-zinc-100 pb-3">
            <h3 className="text-base font-semibold text-zinc-900 font-karla">
              Segurança & Acesso
            </h3>
            <p className="text-xs text-zinc-500 font-karla">
              Configurações de credenciais e encerramento de sessão
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
            <div>
              <p className="text-sm font-semibold text-zinc-800 font-karla">
                Senha da Conta
              </p>
              <p className="text-xs text-zinc-500 font-karla">
                Sua senha é protegida com criptografia hash de alta segurança.
              </p>
            </div>
            <Link
              href="/esqueci-senha"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 font-karla transition-colors shrink-0"
            >
              Redefinir senha
            </Link>
          </div>

          <div className="border-t border-zinc-100 pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-red-600 font-karla">
                Encerrar Sessão
              </p>
              <p className="text-xs text-zinc-500 font-karla">
                Desconecta sua conta com segurança deste dispositivo.
              </p>
            </div>
            <div className="shrink-0">
              <SignOutButton />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

import { requireAluno } from "@/lib/guards";
import { TopbarHeader } from "@/components/topbar-header";
import { obterNotificacoesAluno } from "@/lib/dados-alertas";

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const { usuario, aluno } = await requireAluno();
  const notificacoes = await obterNotificacoesAluno(aluno.id);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-spectral">
      <TopbarHeader
        userName={usuario.name}
        userEmail={usuario.email}
        userImage={(usuario as { image?: string | null }).image}
        role="ALUNO"
        notificacoes={notificacoes}
      />
      <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</main>
    </div>
  );
}

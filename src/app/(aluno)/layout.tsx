import { requireAluno } from "@/lib/guards";
import { TopbarHeader } from "@/components/topbar-header";

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const { usuario } = await requireAluno();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-spectral">
      <TopbarHeader
        userName={usuario.name}
        userEmail={usuario.email}
        userImage={(usuario as { image?: string | null }).image}
        role="ALUNO"
      />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

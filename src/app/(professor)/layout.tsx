import { requireProfessor } from "@/lib/guards";
import { TopbarHeader } from "@/components/topbar-header";

export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const professor = await requireProfessor();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <TopbarHeader
        userName={professor.name}
        userEmail={professor.email}
        userImage={(professor as { image?: string | null }).image}
      />
      <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 font-spectral">{children}</main>
    </div>
  );
}

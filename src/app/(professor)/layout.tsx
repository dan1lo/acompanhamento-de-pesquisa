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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

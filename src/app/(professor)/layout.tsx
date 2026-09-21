import Link from "next/link";
import { requireProfessor } from "@/lib/guards";
import { SignOutButton } from "@/components/sign-out-button";

export default async function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const professor = await requireProfessor();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/painel" className="font-semibold">
              Orientação
            </Link>
            <Link href="/painel" className="text-zinc-600 hover:text-zinc-900">
              Painel
            </Link>
            <Link href="/fila" className="text-zinc-600 hover:text-zinc-900">
              Quem contatar hoje
            </Link>
            <Link href="/alertas" className="text-zinc-600 hover:text-zinc-900">
              Alertas
            </Link>
            <Link href="/buscar" className="text-zinc-600 hover:text-zinc-900">
              Buscar
            </Link>
            <Link href="/alunos/novo" className="text-zinc-600 hover:text-zinc-900">
              Novo aluno
            </Link>
            <Link href="/horarios" className="text-zinc-600 hover:text-zinc-900">
              Horários
            </Link>
            <Link href="/configuracoes/google" className="text-zinc-600 hover:text-zinc-900">
              Google Calendar
            </Link>
            <Link href="/configuracoes/alertas" className="text-zinc-600 hover:text-zinc-900">
              Config. alertas
            </Link>
            <Link href="/coorientadores" className="text-zinc-600 hover:text-zinc-900">
              Coorientadores
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <span>{professor.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

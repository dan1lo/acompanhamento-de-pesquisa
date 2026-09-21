import Link from "next/link";
import { requireAluno } from "@/lib/guards";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AlunoLayout({ children }: { children: React.ReactNode }) {
  const { usuario } = await requireAluno();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/inicio" className="font-semibold">
              Orientação
            </Link>
            <Link href="/inicio" className="text-zinc-600 hover:text-zinc-900">
              Início
            </Link>
            <Link href="/agendar" className="text-zinc-600 hover:text-zinc-900">
              Agendar
            </Link>
            <Link href="/reunioes" className="text-zinc-600 hover:text-zinc-900">
              Minhas reuniões
            </Link>
            <Link href="/tarefas" className="text-zinc-600 hover:text-zinc-900">
              Tarefas
            </Link>
            <Link href="/entregas" className="text-zinc-600 hover:text-zinc-900">
              Entregas
            </Link>
            <Link href="/producao" className="text-zinc-600 hover:text-zinc-900">
              Produção
            </Link>
            <Link href="/privacidade" className="text-zinc-600 hover:text-zinc-900">
              Privacidade
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <span>{usuario.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

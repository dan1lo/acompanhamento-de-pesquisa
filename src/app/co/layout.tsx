import Link from "next/link";
import { requireCoorientador } from "@/lib/guards";
import { SignOutButton } from "@/components/sign-out-button";

export default async function CoorientadorLayout({ children }: { children: React.ReactNode }) {
  const coorientador = await requireCoorientador();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/co/painel" className="font-semibold">
              Orientação (somente leitura)
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <span>{coorientador.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

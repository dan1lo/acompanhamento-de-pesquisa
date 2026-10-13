import { redirect } from "next/navigation";
import Image from "next/image";
import TipoContaForm from "./tipo-form";

export const metadata = {
  title: "Tipo de Conta — SCHOLAB",
  description: "Selecione se sua conta é de Aluno ou Orientador no SCHOLAB",
};

export default async function TipoContaPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const { userId } = await searchParams;

  if (!userId) {
    redirect("/cadastro");
  }

  return (
    <main className="min-h-screen flex flex-col justify-center items-center bg-[#133C1B] px-4 py-12 sm:px-6 lg:px-8">
      {/* Card branco centralizado com todo o conteúdo dentro */}
      <div className="w-full max-w-md rounded-3xl bg-white p-7 sm:p-9 shadow-2xl border border-black/5 space-y-6">
        <div className="text-center space-y-2">
          {/* Logo / Ícone */}
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#133C1B] shadow-md ring-4 ring-[#133C1B]/15 overflow-hidden">
            <Image
              src="/icon.png"
              alt="SCHOLAB Logo"
              width={56}
              height={56}
              className="h-full w-full object-cover"
              priority
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#133C1B]/10 text-[#133C1B] text-[11px] font-semibold font-karla uppercase tracking-wider">
            Etapa 2 de 2 • Perfil
          </div>

          <h1 className="text-2xl font-bold tracking-wider text-zinc-900 font-karla">
            Qual é o seu perfil?
          </h1>
          <p className="text-sm text-zinc-600 font-spectral">
            Selecione se seu tipo de conta será de aluno ou orientador
          </p>
        </div>

        <TipoContaForm userId={userId} />
      </div>
    </main>
  );
}

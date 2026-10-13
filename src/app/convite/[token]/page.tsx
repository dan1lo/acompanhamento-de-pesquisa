import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { aceitarConvite } from "@/lib/actions/convites";
import { SubmitButton } from "@/components/submit-button";
import { FormErrorBanner } from "@/components/form-error-banner";

export const metadata = {
  title: "Ativar Cadastro — SCHOLAB",
  description: "Ative sua conta de orientando no SCHOLAB",
};

export default async function AceitarConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const convite = await prisma.convite.findUnique({
    where: { token },
    include: { aluno: true, professor: true },
  });

  if (!convite) notFound();

  const expirado = convite.expiraEm < new Date();
  const usado = Boolean(convite.usadoEm);

  if (expirado || usado) {
    return (
      <main className="min-h-screen flex flex-col justify-center items-center bg-[#133C1B] px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-3xl bg-white p-7 sm:p-9 shadow-2xl border border-black/5 text-center space-y-4">
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
          <h1 className="text-xl font-bold text-zinc-900 font-karla">Convite indisponível</h1>
          <p className="text-sm text-zinc-600 font-spectral">
            {usado
              ? "Este convite já foi utilizado para ativar uma conta."
              : "Este convite expirou. Solicite um novo convite ao seu professor orientador."}
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-block rounded-lg bg-[#133C1B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a4f24] transition-colors"
            >
              Ir para o Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col justify-center items-center bg-[#133C1B] px-4 py-12 sm:px-6 lg:px-8">
      {/* Card branco centralizado com todo o conteúdo dentro */}
      <div className="w-full max-w-md rounded-3xl bg-white p-7 sm:p-9 shadow-2xl border border-black/5 space-y-6">
        <div className="text-center space-y-2">
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
          <h1 className="text-2xl font-bold tracking-wider text-zinc-900 font-karla">
            Bem-vindo(a), {convite.aluno.nome}
          </h1>
          <p className="text-sm text-zinc-600 font-spectral">
            {convite.professor.nome} convidou você para o acompanhamento de{" "}
            <strong>{convite.nivel}</strong>. Defina sua senha para ativar sua conta.
          </p>
        </div>

        <FormErrorBanner action={aceitarConvite} className="space-y-4">
          <input type="hidden" name="token" value={token} />

          <div>
            <label
              htmlFor="senha"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 font-karla"
            >
              Senha (mínimo 8 caracteres)
            </label>
            <div className="mt-1.5">
              <input
                id="senha"
                name="senha"
                type="password"
                minLength={8}
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-3 focus:ring-[#133C1B]/15 transition-all"
              />
            </div>
          </div>

          <div className="rounded-lg bg-zinc-50 p-3.5 text-xs text-zinc-600 space-y-1.5 border border-zinc-200/60 font-spectral">
            <p className="font-semibold text-zinc-800 font-karla text-[12px]">
              Termo de Ciência e Privacidade (LGPD)
            </p>
            <p>
              Ao ativar sua conta no SCHOLAB, você concorda com o registro e acompanhamento
              das suas orientações, prazos e reuniões acadêmicas pelo orientador.
            </p>
            <label className="flex items-start gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                name="aceite"
                required
                className="mt-0.5 rounded border-zinc-300 text-[#133C1B] focus:ring-[#133C1B]"
              />
              <span className="text-zinc-700">Li e concordo com os termos de privacidade</span>
            </label>
          </div>

          <SubmitButton>Concluir cadastro e ativar conta</SubmitButton>
        </FormErrorBanner>
      </div>
    </main>
  );
}

import Link from "next/link";
import Image from "next/image";
import { solicitarRecuperacaoSenha } from "@/lib/actions/senha";
import { FormErrorBanner } from "@/components/form-error-banner";
import { SubmitButton } from "@/components/submit-button";

export const metadata = {
  title: "Recuperar Senha — SCHOLAB",
  description: "Recupere o acesso à sua conta no SCHOLAB",
};

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen flex flex-col justify-center items-center bg-[#133C1B] px-4 py-12 sm:px-6 lg:px-8">
      {/* Card branco centralizado com todo o conteúdo dentro */}
      <div className="w-full max-w-md rounded-3xl bg-white p-7 sm:p-9 shadow-2xl border border-black/5 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <Image
              src="/logo.png"
              alt="SCHOLAB"
              width={160}
              height={115}
              className="h-24 w-auto object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold tracking-wider text-zinc-900 font-karla">
            Recuperar Senha
          </h1>
          <p className="text-sm text-zinc-600 font-spectral">
            Informe seu e-mail para receber as instruções de recuperação
          </p>
        </div>

        {params.enviado && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            Se houver uma conta cadastrada com esse e-mail, enviamos o link de recuperação.
          </div>
        )}

        <FormErrorBanner action={solicitarRecuperacaoSenha} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 font-karla"
            >
              E-mail cadastrado
            </label>
            <div className="mt-1.5">
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="seu.email@exemplo.com"
                className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-3 focus:ring-[#133C1B]/15 transition-all"
              />
            </div>
          </div>
          <SubmitButton>Enviar link de recuperação</SubmitButton>
        </FormErrorBanner>

        <div className="pt-2 text-center text-xs text-zinc-500 border-t border-zinc-100">
          Lembrou sua senha?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#133C1B] hover:text-[#1a4f24] hover:underline"
          >
            Voltar ao login
          </Link>
        </div>
      </div>
    </main>
  );
}

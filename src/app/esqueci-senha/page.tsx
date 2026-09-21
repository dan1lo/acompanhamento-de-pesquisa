import Link from "next/link";
import { solicitarRecuperacaoSenha } from "@/lib/actions/senha";
import { FormErrorBanner } from "@/components/form-error-banner";
import { SubmitButton } from "@/components/submit-button";

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">Recuperar senha</h1>
          <p className="text-sm text-zinc-500">Informe seu e-mail para receber um link de redefinição.</p>
        </div>

        {params.enviado && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Se houver uma conta com esse e-mail, enviamos um link de recuperação.
          </p>
        )}

        <FormErrorBanner action={solicitarRecuperacaoSenha}>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <SubmitButton>Enviar link de recuperação</SubmitButton>
        </FormErrorBanner>

        <p className="text-center text-sm text-zinc-500">
          <Link href="/login" className="text-blue-600 hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </main>
  );
}

import { redefinirSenha } from "@/lib/actions/senha";
import { FormErrorBanner } from "@/components/form-error-banner";
import { SubmitButton } from "@/components/submit-button";

export default async function RedefinirSenhaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">Criar nova senha</h1>
        </div>

        <FormErrorBanner action={redefinirSenha}>
          <input type="hidden" name="token" value={token} />
          <div className="space-y-1">
            <label htmlFor="senha" className="text-sm font-medium">
              Nova senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              minLength={8}
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <SubmitButton>Redefinir senha</SubmitButton>
        </FormErrorBanner>
      </div>
    </main>
  );
}

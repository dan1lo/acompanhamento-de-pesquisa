import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { aceitarConvite } from "@/lib/actions/convites";
import { SubmitButton } from "@/components/submit-button";
import { FormErrorBanner } from "@/components/form-error-banner";

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
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-lg font-semibold">Convite indisponível</h1>
          <p className="text-sm text-zinc-500">
            {usado ? "Este convite já foi utilizado." : "Este convite expirou. Peça um novo convite ao seu orientador."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Bem-vindo(a), {convite.aluno.nome}</h1>
          <p className="text-sm text-zinc-500">
            {convite.professor.nome} te convidou para acompanhar sua orientação de {convite.nivel.toLowerCase()}.
            Defina uma senha para criar sua conta.
          </p>
        </div>

        <FormErrorBanner action={aceitarConvite}>
          <input type="hidden" name="token" value={token} />

          <div className="space-y-1">
            <label htmlFor="senha" className="text-sm font-medium">
              Crie uma senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              minLength={8}
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">Mínimo de 8 caracteres.</p>
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-600 space-y-2">
            <p className="font-medium text-zinc-800">Ciência sobre uso de IA e tratamento de dados</p>
            <p>
              As reuniões de orientação são gravadas e transcritas fora deste sistema (no Google Meet). O
              professor pode colar essa transcrição aqui para gerar, com apoio de inteligência artificial, um
              rascunho de resumo — que você só verá depois de revisado e publicado pelo professor. A transcrição
              bruta nunca fica visível a você. Seus dados pessoais são usados apenas para fins de orientação
              acadêmica e você pode solicitar exportação ou exclusão a qualquer momento.
            </p>
            <label className="flex items-start gap-2 pt-1">
              <input type="checkbox" name="aceite" required className="mt-1" />
              <span>Li e estou ciente das informações acima.</span>
            </label>
          </div>

          <SubmitButton>Criar minha conta</SubmitButton>
        </FormErrorBanner>
      </div>
    </main>
  );
}

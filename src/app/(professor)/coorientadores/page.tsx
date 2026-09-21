import { requireProfessor } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { FormErrorBanner } from "@/components/form-error-banner";
import { SubmitButton } from "@/components/submit-button";
import {
  convidarCoorientador,
  concederAcessoCoorientador,
  revogarAcessoCoorientador,
} from "@/lib/actions/coorientadores";

export default async function CoorientadoresPage() {
  const professor = await requireProfessor();

  const [coorientadores, alunos] = await Promise.all([
    prisma.usuario.findMany({
      where: { papel: "COORIENTADOR", coorientacoes: { some: { aluno: { orientadorId: professor.id } } } },
      include: { coorientacoes: { include: { aluno: true }, where: { aluno: { orientadorId: professor.id } } } },
    }),
    prisma.aluno.findMany({ where: { orientadorId: professor.id, arquivado: false }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Coorientadores</h1>
      <p className="text-sm text-zinc-500">Acesso somente leitura a alunos específicos.</p>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Convidar coorientador</h2>
        <FormErrorBanner action={convidarCoorientador} className="flex gap-2">
          <input name="nome" placeholder="Nome" required className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          <input name="email" type="email" placeholder="E-mail" required className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          <SubmitButton className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
            Convidar
          </SubmitButton>
        </FormErrorBanner>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Coorientadores e acessos</h2>
        {coorientadores.length === 0 && <p className="text-sm text-zinc-500">Nenhum coorientador convidado ainda.</p>}
        <div className="space-y-4">
          {coorientadores.map((c) => (
            <div key={c.id} className="rounded-md border border-zinc-100 p-3">
              <p className="text-sm font-medium">
                {c.nome} <span className="text-xs text-zinc-400">({c.email})</span>
              </p>
              <ul className="mt-2 space-y-1">
                {c.coorientacoes.map((co) => (
                  <li key={co.id} className="flex items-center justify-between text-sm">
                    <span>{co.aluno.nome}</span>
                    <form action={revogarAcessoCoorientador.bind(null, co.id)}>
                      <button className="text-xs text-red-500 hover:underline">Revogar</button>
                    </form>
                  </li>
                ))}
              </ul>
              <form className="mt-2 flex gap-2">
                {alunos.map((a) => (
                  <button
                    key={a.id}
                    formAction={concederAcessoCoorientador.bind(null, c.id, a.id)}
                    className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
                  >
                    + {a.nome}
                  </button>
                ))}
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

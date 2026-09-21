import { requireProfessor } from "@/lib/guards";
import { listarProximosHorarios } from "@/lib/dados-horarios";
import { criarHorarioLivre, removerHorarioLivre } from "@/lib/actions/horarios";
import { FormErrorBanner } from "@/components/form-error-banner";
import { SubmitButton } from "@/components/submit-button";
import { formatarDataHora, formatarHora } from "@/lib/datas";

export default async function HorariosPage() {
  const professor = await requireProfessor();

  const horarios = await listarProximosHorarios(professor.id);

  return (
    <div className="grid gap-6 md:grid-cols-[320px_1fr]">
      <section className="rounded-lg border border-zinc-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold">Abrir novo horário livre</h2>
        <FormErrorBanner action={criarHorarioLivre}>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="inicio">
              Início
            </label>
            <input
              id="inicio"
              name="inicio"
              type="datetime-local"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="fim">
              Fim
            </label>
            <input
              id="fim"
              name="fim"
              type="datetime-local"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <SubmitButton>Abrir horário</SubmitButton>
        </FormErrorBanner>
        <p className="text-xs text-zinc-500">
          Horários futuros ficam visíveis para todos os seus alunos até que alguém agende.
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Próximos horários</h2>
        <ul className="divide-y divide-zinc-100 text-sm">
          {horarios.length === 0 && <p className="text-zinc-500">Nenhum horário futuro cadastrado.</p>}
          {horarios.map((horario) => (
            <li key={horario.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">
                  {formatarDataHora(horario.inicio)} — {formatarHora(horario.fim)}
                </p>
                {horario.reservado ? (
                  <p className="text-xs text-emerald-600">
                    Reservado por {horario.reuniao?.aluno.nome ?? "aluno"}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-400">Livre</p>
                )}
              </div>
              {!horario.reservado && (
                <form action={removerHorarioLivre.bind(null, horario.id)}>
                  <button className="text-xs text-zinc-400 hover:text-red-600">Remover</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

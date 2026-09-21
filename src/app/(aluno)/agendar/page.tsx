import { requireAluno } from "@/lib/guards";
import { listarHorariosDisponiveis } from "@/lib/dados-horarios";
import { agendarReuniao } from "@/lib/actions/reunioes";
import { FormErrorBanner } from "@/components/form-error-banner";
import { SubmitButton } from "@/components/submit-button";
import { formatarDataHora, formatarHora } from "@/lib/datas";

export default async function AgendarPage() {
  const { aluno } = await requireAluno();

  const horarios = await listarHorariosDisponiveis(aluno.orientadorId);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Agendar reunião</h1>
      <p className="text-sm text-zinc-500">
        Escolha um dos horários livres do seu orientador. Agendamentos precisam de pelo menos 24h de
        antecedência.
      </p>

      {horarios.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
          Nenhum horário disponível no momento. Volte mais tarde.
        </p>
      ) : (
        <FormErrorBanner action={agendarReuniao} className="space-y-3">
          <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4">
            {horarios.map((horario) => (
              <label
                key={horario.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-zinc-200 p-3 text-sm hover:bg-zinc-50 has-[:checked]:border-zinc-900"
              >
                <input type="radio" name="horarioLivreId" value={horario.id} required />
                <span>
                  {formatarDataHora(horario.inicio)} — {formatarHora(horario.fim)}
                </span>
              </label>
            ))}
          </div>
          <SubmitButton>Confirmar agendamento</SubmitButton>
        </FormErrorBanner>
      )}
    </div>
  );
}

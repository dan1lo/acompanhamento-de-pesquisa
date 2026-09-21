import { criarAlunoEConvite } from "@/lib/actions/convites";
import { FormErrorBanner } from "@/components/form-error-banner";
import { SubmitButton } from "@/components/submit-button";

export default function NovoAlunoPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-lg font-semibold">Cadastrar novo orientando</h1>
      <p className="text-sm text-zinc-500">
        Um convite de acesso será enviado ao e-mail informado, com link de uso único válido por 7 dias.
      </p>

      <FormErrorBanner action={criarAlunoEConvite} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
        <Campo label="Nome completo" name="nome" required />
        <Campo label="E-mail" name="email" type="email" required />

        <div className="space-y-1">
          <label htmlFor="nivel" className="text-sm font-medium">
            Nível
          </label>
          <select id="nivel" name="nivel" required className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="TCC">TCC</option>
            <option value="MESTRADO">Mestrado</option>
            <option value="DOUTORADO">Doutorado</option>
          </select>
        </div>

        <Campo label="Tema (opcional)" name="tema" required={false} />
        <Campo label="Data de início" name="dataInicio" type="date" required />

        <SubmitButton>Cadastrar e enviar convite</SubmitButton>
      </FormErrorBanner>
    </div>
  );
}

function Campo({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required: boolean;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

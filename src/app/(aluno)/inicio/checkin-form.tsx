"use client";

import { FormErrorBanner } from "@/components/form-error-banner";
import { SubmitButton } from "@/components/submit-button";
import { preencherCheckin } from "@/lib/actions/reunioes";

export function CheckinForm({
  reuniaoId,
  valores,
}: {
  reuniaoId: string;
  valores: { oQueFez: string | null; duvidas: string | null; bloqueios: string | null } | null;
}) {
  const acao = preencherCheckin.bind(null, reuniaoId);

  return (
    <FormErrorBanner action={acao} className="space-y-3">
      <Campo name="oQueFez" label="O que você fez desde a última reunião?" defaultValue={valores?.oQueFez ?? ""} />
      <Campo name="duvidas" label="Dúvidas" defaultValue={valores?.duvidas ?? ""} />
      <Campo name="bloqueios" label="Algum bloqueio?" defaultValue={valores?.bloqueios ?? ""} />
      <SubmitButton className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">
        {valores ? "Atualizar check-in" : "Enviar check-in"}
      </SubmitButton>
    </FormErrorBanner>
  );
}

function Campo({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-xs font-medium text-zinc-600">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={2}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
      />
    </div>
  );
}

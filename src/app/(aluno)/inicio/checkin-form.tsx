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
    <FormErrorBanner action={acao} className="space-y-3.5">
      <Campo
        name="oQueFez"
        label="O que você realizou desde a última reunião?"
        placeholder="Descreva suas leituras, escrita, experimentos..."
        defaultValue={valores?.oQueFez ?? ""}
      />
      <Campo
        name="duvidas"
        label="Quais dúvidas você quer discutir?"
        placeholder="Pontos teóricos, metodológicos ou práticos..."
        defaultValue={valores?.duvidas ?? ""}
      />
      <Campo
        name="bloqueios"
        label="Algum bloqueio ou dificuldade técnica?"
        placeholder="Acesso a dados, ferramentas, orientações..."
        defaultValue={valores?.bloqueios ?? ""}
      />
      <div className="pt-1">
        <SubmitButton className="inline-flex items-center justify-center rounded-xl bg-[#133C1B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1a4f24] active:scale-95 transition-all font-karla cursor-pointer shadow-xs">
          {valores ? "Atualizar check-in pré-reunião" : "Enviar check-in pré-reunião"}
        </SubmitButton>
      </div>
    </FormErrorBanner>
  );
}

function Campo({
  name,
  label,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-1 text-left">
      <label htmlFor={name} className="text-xs font-semibold uppercase tracking-wider text-zinc-600 font-karla">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={2}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs text-zinc-800 focus:border-[#133C1B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#133C1B]/20 font-spectral transition-all placeholder:text-zinc-400"
      />
    </div>
  );
}

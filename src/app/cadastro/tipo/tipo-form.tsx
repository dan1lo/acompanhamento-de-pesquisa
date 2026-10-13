"use client";

import { useState } from "react";
import { definirTipoConta } from "@/lib/actions/cadastro";

export default function TipoContaForm({ userId }: { userId: string }) {
  const [tipo, setTipo] = useState<"PROFESSOR" | "ALUNO">("PROFESSOR");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("tipo", tipo);

    try {
      await definirTipoConta(formData);
    } catch (err: unknown) {
      setCarregando(false);
      if (err instanceof Error) {
        if (err.message === "NEXT_REDIRECT") {
          throw err;
        }
        setErro(err.message);
      } else {
        setErro("Erro ao definir o tipo de conta.");
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {erro}
        </div>
      )}

      <div className="space-y-3">
        {/* Opção Orientador */}
        <label
          className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
            tipo === "PROFESSOR"
              ? "border-[#133C1B] bg-[#133C1B]/5 shadow-sm"
              : "border-zinc-200 hover:border-zinc-300 bg-white"
          }`}
        >
          <input
            type="radio"
            name="tipo"
            value="PROFESSOR"
            checked={tipo === "PROFESSOR"}
            onChange={() => setTipo("PROFESSOR")}
            className="mt-1 text-[#133C1B] focus:ring-[#133C1B]"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-zinc-900 font-karla">
                Orientador(a) / Professor(a)
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#133C1B]/10 text-[#133C1B]">
                Docente
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-spectral mt-1">
              Gerencio meus orientandos de TCC, Mestrado e Doutorado, atas e reuniões.
            </p>
          </div>
        </label>

        {/* Opção Aluno */}
        <label
          className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
            tipo === "ALUNO"
              ? "border-[#133C1B] bg-[#133C1B]/5 shadow-sm"
              : "border-zinc-200 hover:border-zinc-300 bg-white"
          }`}
        >
          <input
            type="radio"
            name="tipo"
            value="ALUNO"
            checked={tipo === "ALUNO"}
            onChange={() => setTipo("ALUNO")}
            className="mt-1 text-[#133C1B] focus:ring-[#133C1B]"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-zinc-900 font-karla">
                Aluno(a) / Orientando(a)
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                Discente
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-spectral mt-1">
              Acompanho minhas orientações, produções científicas, atas e entregas.
            </p>
          </div>
        </label>
      </div>

      <button
        type="submit"
        disabled={carregando}
        className="w-full rounded-lg bg-[#133C1B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1a4f24] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#133C1B] focus:ring-offset-2 transition-all disabled:opacity-50 cursor-pointer font-karla tracking-wide mt-2"
      >
        {carregando ? "Concluindo..." : "Concluir Cadastro"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { cadastrarUsuario } from "@/lib/actions/cadastro";

export default function CadastroForm() {
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const formData = new FormData(event.currentTarget);
    try {
      await cadastrarUsuario(formData);
    } catch (err: unknown) {
      setCarregando(false);
      if (err instanceof Error) {
        if (err.message === "NEXT_REDIRECT") {
          throw err;
        }
        setErro(err.message);
      } else {
        setErro("Erro ao criar conta. Tente novamente.");
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="nome"
          className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 font-karla"
        >
          Nome
        </label>
        <div className="mt-1.5">
          <input
            id="nome"
            name="nome"
            type="text"
            required
            placeholder="Seu nome completo"
            className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-3 focus:ring-[#133C1B]/15 transition-all"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 font-karla"
        >
          E-mail
        </label>
        <div className="mt-1.5">
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="seu.email@exemplo.com"
            className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-3 focus:ring-[#133C1B]/15 transition-all"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="senha"
          className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 font-karla"
        >
          Senha
        </label>
        <div className="mt-1.5">
          <input
            id="senha"
            name="senha"
            type="password"
            minLength={8}
            required
            placeholder="Mínimo de 8 caracteres"
            className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-3 focus:ring-[#133C1B]/15 transition-all"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="confirmarSenha"
          className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 font-karla"
        >
          Confirmar Senha
        </label>
        <div className="mt-1.5">
          <input
            id="confirmarSenha"
            name="confirmarSenha"
            type="password"
            minLength={8}
            required
            placeholder="Repita sua senha"
            className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-3 focus:ring-[#133C1B]/15 transition-all"
          />
        </div>
      </div>

      {erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {erro}
        </div>
      )}

      <button
        type="submit"
        disabled={carregando}
        className="w-full rounded-lg bg-[#133C1B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1a4f24] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#133C1B] focus:ring-offset-2 transition-all disabled:opacity-50 cursor-pointer font-karla tracking-wide mt-2"
      >
        {carregando ? "Salvando dados..." : "Continuar para próxima etapa"}
      </button>

      <div className="pt-2 text-center text-xs text-zinc-500 border-t border-zinc-100">
        Já possui uma conta?{" "}
        <Link
          href="/login"
          className="font-semibold text-[#133C1B] hover:text-[#1a4f24] hover:underline"
        >
          Fazer login
        </Link>
      </div>
    </form>
  );
}

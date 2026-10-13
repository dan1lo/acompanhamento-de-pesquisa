"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const formData = new FormData(event.currentTarget);
    const resultado = await signIn("credentials", {
      email: formData.get("email"),
      senha: formData.get("senha"),
      redirect: false,
    });

    setCarregando(false);

    if (resultado?.error) {
      setErro("E-mail ou senha inválidos");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {params.get("conta") === "criada" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          Conta criada com sucesso! Faça login para continuar.
        </div>
      )}
      {params.get("senha") === "redefinida" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          Senha redefinida com sucesso! Faça login com a nova senha.
        </div>
      )}

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
            autoComplete="email"
            required
            placeholder="seu.email@exemplo.com"
            className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#133C1B] focus:outline-none focus:ring-3 focus:ring-[#133C1B]/15 transition-all"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="senha"
            className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 font-karla"
          >
            Senha
          </label>
          <Link
            href="/esqueci-senha"
            className="text-xs font-medium text-[#133C1B] hover:text-[#1a4f24] hover:underline"
          >
            Esqueceu a senha?
          </Link>
        </div>
        <div className="mt-1.5">
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
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
        {carregando ? "Acessando..." : "Entrar no sistema"}
      </button>

      <div className="pt-2 text-center text-xs text-zinc-500 border-t border-zinc-100">
        Não possui uma conta?{" "}
        <Link
          href="/cadastro"
          className="font-semibold text-[#133C1B] hover:text-[#1a4f24] hover:underline"
        >
          Criar cadastro
        </Link>
      </div>
    </form>
  );
}

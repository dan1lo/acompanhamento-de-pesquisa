import { Suspense } from "react";
import Image from "next/image";
import LoginForm from "./login-form";

export const metadata = {
  title: "Login — SCHOLAB",
  description: "Acesse sua conta no sistema SCHOLAB de gestão de orientações",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col justify-center items-center bg-[#133C1B] px-4 py-12 sm:px-6 lg:px-8">
      {/* Card branco centralizado com todo o conteúdo dentro */}
      <div className="w-full max-w-md rounded-3xl bg-white p-7 sm:p-9 shadow-2xl border border-black/5 space-y-6">
        <div className="text-center space-y-2">
          {/* Logo oficial SCHOLAB */}
          <div className="flex justify-center mb-1">
            <Image
              src="/logo.png"
              alt="SCHOLAB"
              width={160}
              height={115}
              className="h-24 w-auto object-contain"
              priority
            />
          </div>
          <p className="text-sm text-zinc-600 font-spectral">
            Gestão de Orientandos — Acesse sua conta
          </p>
        </div>

        <Suspense
          fallback={
            <div className="text-center text-sm text-zinc-500 py-6 font-spectral">
              Carregando formulário...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}

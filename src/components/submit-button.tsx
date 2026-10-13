"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "w-full rounded-lg bg-[#133C1B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1a4f24] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#133C1B] focus:ring-offset-2 transition-all disabled:opacity-50 cursor-pointer font-karla tracking-wide"
      }
    >
      {pending ? "Processando..." : children}
    </button>
  );
}

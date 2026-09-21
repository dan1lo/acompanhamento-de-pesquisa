"use client";

import { useActionState } from "react";
import { comTratamentoDeErro } from "@/lib/actions/utils";

export function FormErrorBanner({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(comTratamentoDeErro(action), { error: null });

  return (
    <form action={formAction} className={className ?? "space-y-4"}>
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {children}
    </form>
  );
}

import { ZodError } from "zod";

export type EstadoFormulario = { error: string | null };

function ehRedirectOuNotFound(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const digest = (erro as { digest?: string }).digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"));
}

export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ZodError) {
    return erro.issues[0]?.message ?? "Dados inválidos";
  }
  if (erro instanceof Error) return erro.message;
  return "Ocorreu um erro inesperado";
}

export function comTratamentoDeErro(action: (formData: FormData) => Promise<void>) {
  return async (_prevState: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> => {
    try {
      await action(formData);
      return { error: null };
    } catch (erro) {
      if (ehRedirectOuNotFound(erro)) throw erro;
      return { error: mensagemDeErro(erro) };
    }
  };
}

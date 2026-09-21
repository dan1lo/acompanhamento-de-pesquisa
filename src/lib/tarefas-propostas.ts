export interface TarefaProposta {
  titulo: string;
  responsavel?: string;
  prazo?: string;
}

export function lerTarefasPropostas(json: string | null): TarefaProposta[] {
  if (!json) return [];
  try {
    const valor = JSON.parse(json);
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

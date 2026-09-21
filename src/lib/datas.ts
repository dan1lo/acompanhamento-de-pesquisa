// Fuso horário padrão do sistema (RF/RN da seção 5 do documento de requisitos).
// America/Recife não observa horário de verão, então o offset é sempre -03:00.
export const FUSO_HORARIO = "America/Recife";
const OFFSET_RECIFE = "-03:00";

/** Converte um input <input type="date"> ("AAAA-MM-DD") para meio-dia UTC,
 * evitando que o fuso horário do servidor jogue a data para o dia anterior. */
export function parseDataLocal(dataISO: string): Date {
  return new Date(`${dataISO}T12:00:00Z`);
}

/** Converte um input <input type="datetime-local"> ("AAAA-MM-DDTHH:mm"),
 * interpretando o horário digitado como horário de Recife. */
export function parseDataHoraRecife(dataHoraLocal: string): Date {
  return new Date(`${dataHoraLocal}:00${OFFSET_RECIFE}`);
}

export function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", { timeZone: FUSO_HORARIO });
}

export function formatarHora(data: Date): string {
  return data.toLocaleTimeString("pt-BR", {
    timeZone: FUSO_HORARIO,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatarDataHora(data: Date): string {
  return data.toLocaleString("pt-BR", { timeZone: FUSO_HORARIO });
}

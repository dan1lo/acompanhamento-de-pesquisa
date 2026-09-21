import { differenceInCalendarDays } from "date-fns";
import type { NivelAluno, StatusAluno } from "@prisma/client";

export const LIMITES_PADRAO: Record<NivelAluno, { atencao: number; critico: number }> = {
  TCC: { atencao: 14, critico: 30 },
  MESTRADO: { atencao: 14, critico: 30 },
  DOUTORADO: { atencao: 14, critico: 30 },
};

export function diasDesdeUltimaReuniao(dataUltimaReuniao: Date | null, dataInicio: Date): number {
  const referencia = dataUltimaReuniao ?? dataInicio;
  return Math.max(0, differenceInCalendarDays(new Date(), referencia));
}

export function statusAutomatico(
  dias: number,
  limites: { atencao: number; critico: number }
): StatusAluno {
  if (dias >= limites.critico) return "CRITICO";
  if (dias >= limites.atencao) return "ATENCAO";
  return "OK";
}

export function statusEfetivo(
  statusManual: StatusAluno | null,
  statusSugerido: StatusAluno
): StatusAluno {
  return statusManual ?? statusSugerido;
}

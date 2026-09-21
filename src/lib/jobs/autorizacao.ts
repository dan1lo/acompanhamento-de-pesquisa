import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/** Autoriza a chamada de um job tanto via CRON_SECRET (scheduled function) quanto por um professor logado (teste manual). */
export async function autorizarChamadaDeJob(request: NextRequest): Promise<boolean> {
  const segredoConfigurado = process.env.CRON_SECRET;
  const segredoRecebido = request.headers.get("x-cron-secret");
  if (segredoConfigurado && segredoRecebido === segredoConfigurado) return true;

  const session = await auth();
  return session?.user?.papel === "PROFESSOR";
}

import { NextRequest, NextResponse } from "next/server";
import { enviarLembretesDoDia } from "@/lib/jobs/lembretes";
import { autorizarChamadaDeJob } from "@/lib/jobs/autorizacao";

export async function POST(request: NextRequest) {
  if (!(await autorizarChamadaDeJob(request))) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const resultado = await enviarLembretesDoDia();
  return NextResponse.json(resultado);
}

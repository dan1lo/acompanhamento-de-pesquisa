import { NextRequest, NextResponse } from "next/server";
import { gerarAlertas } from "@/lib/jobs/alertas";
import { autorizarChamadaDeJob } from "@/lib/jobs/autorizacao";

export async function POST(request: NextRequest) {
  if (!(await autorizarChamadaDeJob(request))) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const resultado = await gerarAlertas();
  return NextResponse.json(resultado);
}

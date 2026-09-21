import { NextResponse } from "next/server";
import { requireAluno } from "@/lib/guards";
import { montarExportacaoDados } from "@/lib/actions/lgpd";
import { registrarAuditoria } from "@/lib/auditoria";

export async function GET() {
  const { usuario, aluno } = await requireAluno();

  const dados = await montarExportacaoDados(aluno.id);

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "EXPORTAR_DADOS",
    entidade: "Aluno",
    entidadeId: aluno.id,
  });

  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="meus-dados-orientacao.json"`,
    },
  });
}

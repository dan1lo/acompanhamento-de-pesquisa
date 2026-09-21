import { prisma } from "@/lib/prisma";

export async function registrarAuditoria(params: {
  usuarioId: string;
  acao: string;
  entidade: string;
  entidadeId?: string;
  detalhes?: string;
}) {
  await prisma.logAuditoria.create({
    data: {
      usuarioId: params.usuarioId,
      acao: params.acao,
      entidade: params.entidade,
      entidadeId: params.entidadeId,
      detalhes: params.detalhes,
    },
  });
}

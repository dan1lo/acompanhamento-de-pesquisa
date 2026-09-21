import { prisma } from "@/lib/prisma";
import { diasDesdeUltimaReuniao, LIMITES_PADRAO, statusAutomatico, statusEfetivo } from "@/lib/status";
import type { StatusAluno } from "@prisma/client";

export async function buscarProximaReuniaoDoAluno(alunoId: string) {
  const agora = new Date();
  return prisma.reuniao.findFirst({
    where: { alunoId, status: "AGENDADA", data: { gte: agora } },
    orderBy: { data: "asc" },
    include: { checkin: true },
  });
}

export async function listarAlunosComStatus(professorId: string, incluirArquivados = false) {
  const [alunos, configs] = await Promise.all([
    prisma.aluno.findMany({
      where: { orientadorId: professorId, arquivado: incluirArquivados ? undefined : false },
      include: {
        reunioes: {
          where: { status: "REALIZADA" },
          orderBy: { data: "desc" },
          take: 1,
        },
      },
    }),
    prisma.configuracaoAlerta.findMany({ where: { professorId } }),
  ]);

  const configPorNivel = new Map(configs.map((c) => [c.nivel, c]));

  return alunos.map((aluno) => {
    const config = configPorNivel.get(aluno.nivel);
    const limites = config
      ? { atencao: config.diasAtencao, critico: config.diasCritico }
      : LIMITES_PADRAO[aluno.nivel];
    const ultimaReuniao = aluno.reunioes[0]?.data ?? null;
    const dias = diasDesdeUltimaReuniao(ultimaReuniao, aluno.dataInicio);
    const sugerido = statusAutomatico(dias, limites);
    const efetivo: StatusAluno = statusEfetivo(aluno.statusManual, sugerido);

    return {
      ...aluno,
      diasSemReuniao: dias,
      statusSugerido: sugerido,
      statusEfetivo: efetivo,
    };
  });
}

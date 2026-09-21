import { listarAlunosComStatus } from "@/lib/dados-alunos";
import { prisma } from "@/lib/prisma";

const PESO_STATUS = { CRITICO: 100, ATENCAO: 50, OK: 0 };
const JANELA_PRAZO_PROXIMO_DIAS = 7;

/** RF10 — fila "quem contatar hoje": prioriza por status, dias sem reunião, tarefas
 * atrasadas e prazos próximos, combinados num score de risco. */
export async function listarFilaContatoHoje(professorId: string) {
  const alunos = await listarAlunosComStatus(professorId);
  const agora = new Date();
  const emBreve = new Date(agora.getTime() + JANELA_PRAZO_PROXIMO_DIAS * 24 * 60 * 60 * 1000);

  const resultado = await Promise.all(
    alunos.map(async (aluno) => {
      const tarefas = await prisma.tarefa.findMany({
        where: { alunoId: aluno.id, status: "ABERTA" },
      });
      const tarefasAtrasadas = tarefas.filter((t) => t.prazo && t.prazo < agora).length;
      const prazosProximos = tarefas.filter((t) => t.prazo && t.prazo >= agora && t.prazo <= emBreve).length;

      const score =
        PESO_STATUS[aluno.statusEfetivo] +
        aluno.diasSemReuniao +
        tarefasAtrasadas * 20 +
        prazosProximos * 5;

      return { ...aluno, tarefasAtrasadas, prazosProximos, score };
    })
  );

  return resultado.filter((a) => a.score > 0).sort((a, b) => b.score - a.score);
}

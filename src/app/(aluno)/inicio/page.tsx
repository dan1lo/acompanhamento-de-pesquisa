import Link from "next/link";
import { requireAluno } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { buscarProximaReuniaoDoAluno } from "@/lib/dados-alunos";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { CheckinForm } from "./checkin-form";

export default async function InicioAlunoPage() {
  const { aluno } = await requireAluno();

  const proximaReuniao = await buscarProximaReuniaoDoAluno(aluno.id);

  const tarefasAbertas = await prisma.tarefa.findMany({
    where: { alunoId: aluno.id, status: "ABERTA" },
    orderBy: { prazo: "asc" },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold">Olá, {aluno.nome.split(" ")[0]}</h1>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Próxima reunião</h2>
        {proximaReuniao ? (
          <div className="text-sm">
            <p className="font-medium">{formatarDataHora(proximaReuniao.data)}</p>
            {proximaReuniao.meetLink && (
              <a href={proximaReuniao.meetLink} target="_blank" className="text-blue-600 hover:underline">
                Entrar no Google Meet
              </a>
            )}

            <div className="mt-4 border-t border-zinc-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                Check-in pré-reunião {proximaReuniao.checkin?.preenchidoEm && "(enviado)"}
              </p>
              <CheckinForm
                reuniaoId={proximaReuniao.id}
                valores={
                  proximaReuniao.checkin
                    ? {
                        oQueFez: proximaReuniao.checkin.oQueFez,
                        duvidas: proximaReuniao.checkin.duvidas,
                        bloqueios: proximaReuniao.checkin.bloqueios,
                      }
                    : null
                }
              />
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">
            Nenhuma reunião agendada.{" "}
            <Link href="/agendar" className="text-blue-600 hover:underline">
              Agendar agora
            </Link>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">Tarefas em aberto</h2>
        {tarefasAbertas.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma tarefa em aberto.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {tarefasAbertas.map((t) => (
              <li key={t.id}>
                {t.titulo}
                {t.prazo && ` — prazo ${formatarData(t.prazo)}`}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

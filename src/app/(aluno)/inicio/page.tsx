import Link from "next/link";
import { requireAluno } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { buscarProximaReuniaoDoAluno } from "@/lib/dados-alunos";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { CheckinForm } from "./checkin-form";

function SleepyFaceIcon({ className = "h-24 w-24" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="40"
        cy="44"
        r="30"
        fill="#F4F4F5"
        stroke="#A1A1AA"
        strokeWidth="2.5"
      />
      <path
        d="M27 40C29 44 35 44 37 40"
        stroke="#52525B"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M43 40C45 44 51 44 53 40"
        stroke="#52525B"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="40" cy="55" rx="4.5" ry="6" fill="#52525B" />
      <ellipse cx="23" cy="49" rx="3.5" ry="2" fill="#E4E4E7" />
      <ellipse cx="57" cy="49" rx="3.5" ry="2" fill="#E4E4E7" />
      <g fill="#71717A" className="font-karla font-bold">
        <text x="56" y="24" fontSize="15" fontWeight="bold">
          Z
        </text>
        <text x="65" y="16" fontSize="12" fontWeight="bold">
          z
        </text>
        <text x="71" y="9" fontSize="9" fontWeight="bold">
          z
        </text>
      </g>
    </svg>
  );
}

export default async function InicioAlunoPage() {
  const { aluno, temOrientador } = await requireAluno();

  if (!temOrientador) {
    return (
      <div className="relative min-h-[calc(100vh-10rem)] flex flex-col pb-24 text-left">
        <div className="flex flex-1 flex-col items-center justify-center py-20 sm:py-28 text-center my-auto">
          <SleepyFaceIcon className="h-24 w-24 sm:h-28 sm:w-28 drop-shadow-xs transition-transform hover:scale-105 duration-300" />
          <p className="mt-5 text-base sm:text-lg font-medium text-zinc-600 font-spectral">
            Não tem nada aqui, pode ir dormir
          </p>
        </div>
      </div>
    );
  }

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
              <a
                href={proximaReuniao.meetLink}
                target="_blank"
                className="text-blue-600 hover:underline"
              >
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

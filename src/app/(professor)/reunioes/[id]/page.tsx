import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfessor } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { FormErrorBanner } from "@/components/form-error-banner";
import { SubmitButton } from "@/components/submit-button";
import {
  cancelarReuniao,
  colarTranscricao,
  registrarFalta,
  salvarResumo,
  aprovarTarefaProposta,
  descartarTarefaProposta,
} from "@/lib/actions/reunioes";
import { GerarResumoButton } from "./gerar-resumo-button";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { lerTarefasPropostas } from "@/lib/tarefas-propostas";

export default async function TelaReuniaoPage({ params }: { params: Promise<{ id: string }> }) {
  const professor = await requireProfessor();
  const { id } = await params;

  const reuniao = await prisma.reuniao.findUnique({
    where: { id },
    include: {
      aluno: true,
      transcricao: true,
      resumo: true,
      checkin: true,
    },
  });

  if (!reuniao || reuniao.aluno.orientadorId !== professor.id) notFound();

  const tarefasAnteriores = await prisma.tarefa.findMany({
    where: { alunoId: reuniao.alunoId, status: "ABERTA" },
    orderBy: { prazo: "asc" },
  });

  const tarefasPropostas = lerTarefasPropostas(reuniao.resumo?.tarefasPropostasJson ?? null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/alunos/${reuniao.alunoId}`} className="text-xs text-zinc-500 hover:underline">
            ← {reuniao.aluno.nome}
          </Link>
          <h1 className="text-lg font-semibold">
            Reunião de {formatarDataHora(reuniao.data)}
          </h1>
          <p className="text-xs text-zinc-500">
            Status: {reuniao.status}
            {reuniao.meetLink && (
              <>
                {" · "}
                <a href={reuniao.meetLink} target="_blank" className="text-blue-600 hover:underline">
                  Link do Meet
                </a>
              </>
            )}
          </p>
        </div>
        {reuniao.status === "AGENDADA" && (
          <div className="flex gap-2">
            <form action={registrarFalta.bind(null, reuniao.id)}>
              <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50">
                Registrar falta
              </button>
            </form>
            <form action={cancelarReuniao.bind(null, reuniao.id)}>
              <button className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                Cancelar
              </button>
            </form>
          </div>
        )}
      </div>

      {tarefasAnteriores.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-800">Tarefas em aberto</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {tarefasAnteriores.map((t) => (
              <li key={t.id}>
                {t.titulo}
                {t.prazo && ` — prazo ${formatarData(t.prazo)}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reuniao.checkin?.preenchidoEm && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-blue-800">Check-in do aluno</h2>
          <div className="space-y-2 text-sm text-blue-900">
            {reuniao.checkin.oQueFez && (
              <p>
                <span className="font-medium">O que fez:</span> {reuniao.checkin.oQueFez}
              </p>
            )}
            {reuniao.checkin.duvidas && (
              <p>
                <span className="font-medium">Dúvidas:</span> {reuniao.checkin.duvidas}
              </p>
            )}
            {reuniao.checkin.bloqueios && (
              <p>
                <span className="font-medium">Bloqueios:</span> {reuniao.checkin.bloqueios}
              </p>
            )}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold">Transcrição (visível apenas ao professor)</h2>
        <FormErrorBanner action={colarTranscricao.bind(null, reuniao.id)}>
          <textarea
            name="texto"
            rows={8}
            defaultValue={reuniao.transcricao?.conteudo ?? ""}
            placeholder="Cole aqui o texto da transcrição gerada pelo Google Meet..."
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono"
          />
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="arquivo">
              Ou envie um arquivo (.txt, .docx, .pdf)
            </label>
            <input id="arquivo" name="arquivo" type="file" accept=".txt,.docx,.pdf" className="text-sm" />
          </div>
          <SubmitButton className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white">
            Salvar transcrição
          </SubmitButton>
        </FormErrorBanner>
        {reuniao.transcricao?.origemArquivo && (
          <p className="text-xs text-zinc-400">Origem: arquivo {reuniao.transcricao.origemArquivo}</p>
        )}
      </section>

      {reuniao.transcricao && (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Resumo por IA</h2>
            <GerarResumoButton reuniaoId={reuniao.id} />
          </div>

          {reuniao.resumo ? (
            <FormErrorBanner action={salvarResumo.bind(null, reuniao.id)}>
              <CampoResumo label="Decisões" name="decisoes" defaultValue={reuniao.resumo.decisoes ?? ""} />
              <CampoResumo label="Combinados" name="combinados" defaultValue={reuniao.resumo.combinados ?? ""} />
              <CampoResumo
                label="Dúvidas em aberto"
                name="duvidasAbertas"
                defaultValue={reuniao.resumo.duvidasAbertas ?? ""}
              />
              <CampoResumo
                label="Próximos passos"
                name="proximosPassos"
                defaultValue={reuniao.resumo.proximosPassos ?? ""}
              />

              <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="publicar" defaultChecked={reuniao.resumo.status === "PUBLICADO"} />
                  Publicar para o aluno
                </label>
                <SubmitButton className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
                  Salvar
                </SubmitButton>
              </div>
              {reuniao.resumo.status === "PUBLICADO" && (
                <p className="text-xs text-emerald-600">
                  Publicado em {reuniao.resumo.publicadoEm && formatarDataHora(reuniao.resumo.publicadoEm)}
                </p>
              )}
            </FormErrorBanner>
          ) : (
            <p className="text-sm text-zinc-500">
              Ainda não há rascunho. Clique em &quot;Gerar rascunho com IA&quot; para começar.
            </p>
          )}

          {reuniao.resumo && tarefasPropostas.length > 0 && (
            <div className="border-t border-zinc-100 pt-4">
              <h3 className="mb-2 text-sm font-semibold">Tarefas propostas pela IA</h3>
              <ul className="space-y-2">
                {tarefasPropostas.map((tarefa, indice) => (
                  <li key={indice} className="flex items-center gap-2 rounded-md bg-zinc-50 p-2 text-sm">
                    <form action={aprovarTarefaProposta.bind(null, reuniao.id, indice)} className="flex flex-1 items-center gap-2">
                      <input
                        name="titulo"
                        defaultValue={tarefa.titulo}
                        className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs"
                      />
                      <input
                        name="responsavel"
                        defaultValue={tarefa.responsavel ?? ""}
                        placeholder="responsável"
                        className="w-28 rounded border border-zinc-300 px-2 py-1 text-xs"
                      />
                      <input
                        name="prazo"
                        type="date"
                        defaultValue={tarefa.prazo ?? ""}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs"
                      />
                      <button className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white">
                        Aprovar
                      </button>
                    </form>
                    <form action={descartarTarefaProposta.bind(null, reuniao.id, indice)}>
                      <button className="text-xs text-zinc-400 hover:text-red-600">Descartar</button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function CampoResumo({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

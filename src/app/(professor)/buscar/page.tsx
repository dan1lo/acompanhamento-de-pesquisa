import Link from "next/link";
import { requireProfessor } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatarDataHora } from "@/lib/datas";

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const professor = await requireProfessor();
  const { q } = await searchParams;
  const termo = q?.trim();

  const [resumos, notas] = termo
    ? await Promise.all([
        prisma.resumo.findMany({
          where: {
            status: "PUBLICADO",
            reuniao: { aluno: { orientadorId: professor.id } },
            OR: [
              { decisoes: { contains: termo, mode: "insensitive" } },
              { combinados: { contains: termo, mode: "insensitive" } },
              { duvidasAbertas: { contains: termo, mode: "insensitive" } },
              { proximosPassos: { contains: termo, mode: "insensitive" } },
            ],
          },
          include: { reuniao: { include: { aluno: true } } },
          orderBy: { publicadoEm: "desc" },
          take: 30,
        }),
        prisma.nota.findMany({
          where: {
            aluno: { orientadorId: professor.id },
            conteudo: { contains: termo, mode: "insensitive" },
          },
          include: { aluno: true },
          orderBy: { criadoEm: "desc" },
          take: 30,
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Buscar</h1>
        <p className="text-sm text-zinc-500">Busca em resumos publicados e notas.</p>
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={termo}
          placeholder='Ex.: "o que combinamos sobre a metodologia"'
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Buscar</button>
      </form>

      {termo && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold">Resumos ({resumos.length})</h2>
            <ul className="space-y-2">
              {resumos.map((resumo) => (
                <li key={resumo.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
                  <Link href={`/reunioes/${resumo.reuniaoId}`} className="font-medium hover:underline">
                    {resumo.reuniao.aluno.nome} — {formatarDataHora(resumo.reuniao.data)}
                  </Link>
                  <Trecho campos={[resumo.decisoes, resumo.combinados, resumo.duvidasAbertas, resumo.proximosPassos]} termo={termo} />
                </li>
              ))}
              {resumos.length === 0 && <p className="text-sm text-zinc-500">Nada encontrado em resumos.</p>}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Notas ({notas.length})</h2>
            <ul className="space-y-2">
              {notas.map((nota) => (
                <li key={nota.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
                  <Link href={`/alunos/${nota.alunoId}`} className="font-medium hover:underline">
                    {nota.aluno.nome}
                  </Link>
                  <p className="mt-1 text-zinc-600">{nota.conteudo}</p>
                </li>
              ))}
              {notas.length === 0 && <p className="text-sm text-zinc-500">Nada encontrado em notas.</p>}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function Trecho({ campos, termo }: { campos: (string | null)[]; termo: string }) {
  const trecho = campos.find((c) => c?.toLowerCase().includes(termo.toLowerCase()));
  if (!trecho) return null;
  return <p className="mt-1 text-zinc-600">{trecho}</p>;
}

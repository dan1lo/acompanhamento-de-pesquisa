import Link from "next/link";
import { requireCoorientador } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export default async function PainelCoorientadorPage() {
  const coorientador = await requireCoorientador();

  const coorientacoes = await prisma.coorientacao.findMany({
    where: { coorientadorId: coorientador.id },
    include: { aluno: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Alunos acompanhados</h1>
      <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
        {coorientacoes.map((co) => (
          <li key={co.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <p className="font-medium">{co.aluno.nome}</p>
              <p className="text-xs text-zinc-500">{co.aluno.nivel}</p>
            </div>
            <Link href={`/co/alunos/${co.aluno.id}`} className="text-xs text-zinc-500 hover:text-zinc-900">
              Ver ficha →
            </Link>
          </li>
        ))}
        {coorientacoes.length === 0 && (
          <li className="p-4 text-sm text-zinc-500">Nenhum acesso concedido ainda.</li>
        )}
      </ul>
    </div>
  );
}

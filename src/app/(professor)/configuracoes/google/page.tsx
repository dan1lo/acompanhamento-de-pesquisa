import { requireProfessor } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export default async function ConfiguracaoGooglePage({
  searchParams,
}: {
  searchParams: Promise<{ conectado?: string; erro?: string }>;
}) {
  const professor = await requireProfessor();
  const params = await searchParams;

  const conexao = await prisma.conexaoGoogle.findUnique({ where: { professorId: professor.id } });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-lg font-semibold">Conexão com Google Calendar</h1>
      <p className="text-sm text-zinc-500">
        Necessária para criar automaticamente eventos com link do Google Meet quando um aluno agenda uma reunião.
      </p>

      {params.conectado && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Google Calendar conectado com sucesso.
        </p>
      )}
      {params.erro && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Não foi possível conectar. Tente novamente.
        </p>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
        <p className="text-sm">
          Status:{" "}
          {conexao?.conectado ? (
            <span className="font-medium text-emerald-600">Conectado</span>
          ) : (
            <span className="font-medium text-zinc-500">Não conectado</span>
          )}
        </p>
        <a
          href="/api/google/connect"
          className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          {conexao?.conectado ? "Reconectar" : "Conectar Google Calendar"}
        </a>
      </div>
    </div>
  );
}

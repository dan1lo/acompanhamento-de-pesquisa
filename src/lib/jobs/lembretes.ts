import { prisma } from "@/lib/prisma";
import { enviarLembreteReuniao } from "@/lib/email";
import { formatarDataHora } from "@/lib/datas";

const HORAS_ANTES_LEMBRETE = 24;

/** Envia lembretes por e-mail para reuniões que começam em ~24h (RF17). */
export async function enviarLembretesDoDia(): Promise<{ enviados: number }> {
  const agora = new Date();
  const janelaFim = new Date(agora.getTime() + HORAS_ANTES_LEMBRETE * 60 * 60 * 1000);

  const reunioes = await prisma.reuniao.findMany({
    where: {
      status: "AGENDADA",
      lembreteEnviado: false,
      data: { gte: agora, lte: janelaFim },
    },
    include: { aluno: true },
  });

  let enviados = 0;
  for (const reuniao of reunioes) {
    await enviarLembreteReuniao(reuniao.aluno.email, reuniao.aluno.nome, formatarDataHora(reuniao.data), reuniao.meetLink);
    await prisma.reuniao.update({ where: { id: reuniao.id }, data: { lembreteEnviado: true } });
    enviados++;
  }

  return { enviados };
}

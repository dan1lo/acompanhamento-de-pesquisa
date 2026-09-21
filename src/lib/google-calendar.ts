import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/google/callback`
  );
}

export function getGoogleAuthUrl(professorId: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
    state: professorId,
  });
}

export async function trocarCodigoPorTokens(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function salvarConexaoGoogle(
  professorId: string,
  tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }
) {
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error("Tokens do Google incompletos — verifique se o consentimento foi concedido com acesso offline");
  }

  await prisma.conexaoGoogle.upsert({
    where: { professorId },
    create: {
      professorId,
      accessTokenCifrado: encrypt(tokens.access_token),
      refreshTokenCifrado: encrypt(tokens.refresh_token),
      expiraEm: new Date(tokens.expiry_date),
      conectado: true,
    },
    update: {
      accessTokenCifrado: encrypt(tokens.access_token),
      refreshTokenCifrado: encrypt(tokens.refresh_token),
      expiraEm: new Date(tokens.expiry_date),
      conectado: true,
    },
  });
}

async function getClienteAutenticado(professorId: string) {
  const conexao = await prisma.conexaoGoogle.findUnique({ where: { professorId } });
  if (!conexao || !conexao.conectado) {
    throw new Error("Professor não conectou o Google Calendar");
  }

  const client = getOAuthClient();
  client.setCredentials({
    access_token: decrypt(conexao.accessTokenCifrado),
    refresh_token: decrypt(conexao.refreshTokenCifrado),
    expiry_date: conexao.expiraEm.getTime(),
  });

  client.on("tokens", async (tokens) => {
    if (tokens.access_token && tokens.expiry_date) {
      await prisma.conexaoGoogle.update({
        where: { professorId },
        data: {
          accessTokenCifrado: encrypt(tokens.access_token),
          expiraEm: new Date(tokens.expiry_date),
          ...(tokens.refresh_token ? { refreshTokenCifrado: encrypt(tokens.refresh_token) } : {}),
        },
      });
    }
  });

  return google.calendar({ version: "v3", auth: client });
}

export async function criarEventoReuniao(params: {
  professorId: string;
  alunoEmail: string;
  alunoNome: string;
  inicio: Date;
  fim: Date;
  titulo: string;
}) {
  try {
    const calendar = await getClienteAutenticado(params.professorId);

    const { data } = await calendar.events.insert({
      calendarId: "primary",
      sendUpdates: "all",
      conferenceDataVersion: 1,
      requestBody: {
        summary: params.titulo,
        start: { dateTime: params.inicio.toISOString(), timeZone: "America/Recife" },
        end: { dateTime: params.fim.toISOString(), timeZone: "America/Recife" },
        attendees: [{ email: params.alunoEmail, displayName: params.alunoNome }],
        conferenceData: {
          createRequest: {
            requestId: `${params.professorId}-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });

    return {
      googleEventId: data.id ?? null,
      meetLink: data.hangoutLink ?? data.conferenceData?.entryPoints?.[0]?.uri ?? null,
    };
  } catch (erro) {
    console.error("Falha ao criar evento no Google Calendar", erro);
    return { googleEventId: null, meetLink: null, erro: true };
  }
}

export async function atualizarEventoReuniao(params: {
  professorId: string;
  googleEventId: string;
  inicio: Date;
  fim: Date;
}) {
  try {
    const calendar = await getClienteAutenticado(params.professorId);
    await calendar.events.patch({
      calendarId: "primary",
      eventId: params.googleEventId,
      sendUpdates: "all",
      requestBody: {
        start: { dateTime: params.inicio.toISOString(), timeZone: "America/Recife" },
        end: { dateTime: params.fim.toISOString(), timeZone: "America/Recife" },
      },
    });
  } catch (erro) {
    console.error("Falha ao atualizar evento no Google Calendar", erro);
  }
}

export async function cancelarEventoReuniao(professorId: string, googleEventId: string) {
  try {
    const calendar = await getClienteAutenticado(professorId);
    await calendar.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
      sendUpdates: "all",
    });
  } catch (erro) {
    console.error("Falha ao cancelar evento no Google Calendar", erro);
  }
}

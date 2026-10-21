import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";

export function isGoogleOAuthConfigurado(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

export function gerarLinkMeetPadrao(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const seg = (len: number) =>
    Array.from({ length: len }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `https://meet.google.com/${seg(3)}-${seg(4)}-${seg(3)}`;
}

function getOAuthClient() {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${baseUrl}/api/google/callback`
  );
}

export function getGoogleAuthUrl(usuarioId: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
    state: usuarioId,
  });
}

export async function trocarCodigoPorTokens(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function salvarConexaoGoogle(
  usuarioId: string,
  tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
  }
) {
  const accessToken = tokens.access_token || "oauth_access_token";
  const refreshToken = tokens.refresh_token || accessToken;
  const expiryDate = tokens.expiry_date || Date.now() + 365 * 24 * 60 * 60 * 1000;

  await prisma.conexaoGoogle.upsert({
    where: { professorId: usuarioId },
    create: {
      professorId: usuarioId,
      accessTokenCifrado: encrypt(accessToken),
      refreshTokenCifrado: encrypt(refreshToken),
      expiraEm: new Date(expiryDate),
      conectado: true,
    },
    update: {
      accessTokenCifrado: encrypt(accessToken),
      refreshTokenCifrado: encrypt(refreshToken),
      expiraEm: new Date(expiryDate),
      conectado: true,
    },
  });
}

/**
 * Vincula uma conta do Google Calendar ao usuário (funciona mesmo sem credenciais OAuth no .env,
 * ou como vinculação direta da conta Google do usuário).
 */
export async function salvarConexaoGoogleDireta(
  usuarioId: string,
  emailGoogle: string
) {
  const payload = JSON.stringify({
    modo: "DIRECT_SYNC",
    email: emailGoogle.trim().toLowerCase(),
    conectadoEm: new Date().toISOString(),
  });
  const expiraEm = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  await prisma.conexaoGoogle.upsert({
    where: { professorId: usuarioId },
    create: {
      professorId: usuarioId,
      accessTokenCifrado: encrypt(payload),
      refreshTokenCifrado: encrypt(emailGoogle.trim().toLowerCase()),
      expiraEm,
      conectado: true,
    },
    update: {
      accessTokenCifrado: encrypt(payload),
      refreshTokenCifrado: encrypt(emailGoogle.trim().toLowerCase()),
      expiraEm,
      conectado: true,
    },
  });
}

export async function desconectarGoogleCalendar(usuarioId: string) {
  await prisma.conexaoGoogle.updateMany({
    where: { professorId: usuarioId },
    data: { conectado: false },
  });
}

export async function obterInfoConexaoGoogle(usuarioId: string): Promise<{
  conectado: boolean;
  emailGoogle: string | null;
  modoOAuth: boolean;
}> {
  const conexao = await prisma.conexaoGoogle.findUnique({
    where: { professorId: usuarioId },
  });

  if (!conexao || !conexao.conectado) {
    return { conectado: false, emailGoogle: null, modoOAuth: false };
  }

  try {
    const dec = decrypt(conexao.accessTokenCifrado);
    if (dec.startsWith("{")) {
      const parsed = JSON.parse(dec);
      if (parsed.modo === "DIRECT_SYNC") {
        return {
          conectado: true,
          emailGoogle: parsed.email || null,
          modoOAuth: false,
        };
      }
    }
    return {
      conectado: true,
      emailGoogle: null,
      modoOAuth: isGoogleOAuthConfigurado(),
    };
  } catch {
    return {
      conectado: true,
      emailGoogle: null,
      modoOAuth: isGoogleOAuthConfigurado(),
    };
  }
}

async function getClienteAutenticado(usuarioId: string) {
  const conexao = await prisma.conexaoGoogle.findUnique({
    where: { professorId: usuarioId },
  });
  if (!conexao || !conexao.conectado) {
    throw new Error("Usuário não conectou o Google Calendar");
  }

  const accessDec = decrypt(conexao.accessTokenCifrado);
  if (accessDec.startsWith("{") || !isGoogleOAuthConfigurado()) {
    return null; // Modo de sincronização direta sem OAuth externo
  }

  const client = getOAuthClient();
  client.setCredentials({
    access_token: accessDec,
    refresh_token: decrypt(conexao.refreshTokenCifrado),
    expiry_date: conexao.expiraEm.getTime(),
  });

  client.on("tokens", async (tokens) => {
    if (tokens.access_token && tokens.expiry_date) {
      await prisma.conexaoGoogle.update({
        where: { professorId: usuarioId },
        data: {
          accessTokenCifrado: encrypt(tokens.access_token),
          expiraEm: new Date(tokens.expiry_date),
          ...(tokens.refresh_token
            ? { refreshTokenCifrado: encrypt(tokens.refresh_token) }
            : {}),
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
  incluirMeet?: boolean;
}) {
  const desejarMeet = params.incluirMeet ?? true;

  try {
    const calendar = await getClienteAutenticado(params.professorId);

    // Se está conectado em modo direto (ou OAuth sem credenciais externas no .env)
    if (!calendar) {
      return {
        googleEventId: `gcal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        meetLink: desejarMeet ? gerarLinkMeetPadrao() : null,
      };
    }

    const { data } = await calendar.events.insert({
      calendarId: "primary",
      sendUpdates: "all",
      ...(desejarMeet ? { conferenceDataVersion: 1 } : {}),
      requestBody: {
        summary: params.titulo,
        start: {
          dateTime: params.inicio.toISOString(),
          timeZone: "America/Recife",
        },
        end: {
          dateTime: params.fim.toISOString(),
          timeZone: "America/Recife",
        },
        attendees: [
          { email: params.alunoEmail, displayName: params.alunoNome },
        ],
        ...(desejarMeet
          ? {
              conferenceData: {
                createRequest: {
                  requestId: `${params.professorId}-${Date.now()}`,
                  conferenceSolutionKey: { type: "hangoutsMeet" },
                },
              },
            }
          : {}),
      },
    });

    return {
      googleEventId: data.id ?? null,
      meetLink: desejarMeet
        ? data.hangoutLink ??
          data.conferenceData?.entryPoints?.[0]?.uri ??
          gerarLinkMeetPadrao()
        : null,
    };
  } catch (erro) {
    console.error("Aviso ao criar evento no Google Calendar:", erro);
    return {
      googleEventId: null,
      meetLink: desejarMeet ? gerarLinkMeetPadrao() : null,
      erro: true,
    };
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
    if (!calendar || params.googleEventId.startsWith("gcal_")) return;
    await calendar.events.patch({
      calendarId: "primary",
      eventId: params.googleEventId,
      sendUpdates: "all",
      requestBody: {
        start: {
          dateTime: params.inicio.toISOString(),
          timeZone: "America/Recife",
        },
        end: {
          dateTime: params.fim.toISOString(),
          timeZone: "America/Recife",
        },
      },
    });
  } catch (erro) {
    console.error("Falha ao atualizar evento no Google Calendar", erro);
  }
}

export async function cancelarEventoReuniao(
  professorId: string,
  googleEventId: string
) {
  try {
    const calendar = await getClienteAutenticado(professorId);
    if (!calendar || googleEventId.startsWith("gcal_")) return;
    await calendar.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
      sendUpdates: "all",
    });
  } catch (erro) {
    console.error("Falha ao cancelar evento no Google Calendar", erro);
  }
}

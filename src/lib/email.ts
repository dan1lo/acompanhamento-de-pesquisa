import { Resend } from "resend";

function getClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

const FROM = process.env.EMAIL_FROM || "Scholab <onboarding@resend.dev>";

async function enviar(to: string, subject: string, html: string) {
  const client = getClient();
  if (!client) {
    console.warn(`[email] RESEND_API_KEY não configurada — e-mail não enviado para ${to}: ${subject}`);
    return;
  }
  await client.emails.send({ from: FROM, to, subject, html });
}

export async function enviarConvite(email: string, link: string, nomeProfessor: string) {
  await enviar(
    email,
    "Convite para acompanhamento de orientação",
    `<p>Olá!</p><p>${nomeProfessor} te convidou para acompanhar sua orientação pelo sistema.</p><p><a href="${link}">Clique aqui para criar sua conta</a></p><p>Este link expira em 7 dias.</p>`
  );
}

export async function enviarLembreteReuniao(email: string, nomeAluno: string, dataFormatada: string, meetLink: string | null) {
  await enviar(
    email,
    "Lembrete: reunião de orientação amanhã",
    `<p>Olá, ${nomeAluno}!</p><p>Você tem uma reunião de orientação marcada para ${dataFormatada}.</p>${
      meetLink ? `<p><a href="${meetLink}">Link do Google Meet</a></p>` : ""
    }`
  );
}

export async function enviarRecuperacaoSenha(email: string, link: string) {
  await enviar(
    email,
    "Recuperação de senha",
    `<p>Recebemos um pedido de redefinição de senha.</p><p><a href="${link}">Clique aqui para criar uma nova senha</a></p><p>Se você não pediu isso, ignore este e-mail.</p>`
  );
}

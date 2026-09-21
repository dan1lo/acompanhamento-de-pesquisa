import type { Config } from "@netlify/functions";

// RF17 — roda a cada hora e envia lembrete de reunião ~24h antes.
export default async () => {
  const baseUrl = process.env.URL || process.env.NEXTAUTH_URL;
  await fetch(`${baseUrl}/api/jobs/lembretes`, {
    method: "POST",
    headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
  });
};

export const config: Config = {
  schedule: "0 * * * *",
};

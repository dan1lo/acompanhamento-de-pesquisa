import type { Config } from "@netlify/functions";

// RF30 — roda diariamente e gera alertas de acompanhamento.
export default async () => {
  const baseUrl = process.env.URL || process.env.NEXTAUTH_URL;
  await fetch(`${baseUrl}/api/jobs/alertas`, {
    method: "POST",
    headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
  });
};

export const config: Config = {
  schedule: "0 6 * * *",
};

# Orientação — Gestão de Orientandos (TCC, Mestrado e Doutorado)

Plataforma para um professor orientador acompanhar seus orientandos: agenda integrada ao Google
Calendar/Meet, status de acompanhamento com alertas, resumo de reuniões por IA (a partir de
transcrições coladas pelo professor) e área própria para cada aluno. Ver
[requisitos-sistema-orientacao.md] para a especificação completa.

Este repositório implementa a **Fase 1 (núcleo/MVP)**: login por convite, cadastro e painel de
alunos com status e dias sem reunião, agenda com Google Calendar/Meet, reunião com transcrição e
resumo por IA com aprovação do professor, e notas privadas/compartilhadas.

## Stack

- **Next.js** (App Router, Server Actions) — hospedado na **Netlify**
- **PostgreSQL** — recomendado [Neon](https://neon.tech) (serverless, compatível com Netlify)
- **Prisma** — ORM e migrations
- **NextAuth (Auth.js v5)** — autenticação por e-mail/senha
- **googleapis** — integração com Google Calendar (OAuth 2.0, criação de eventos com Meet)
- **Anthropic API (Claude)** — geração do rascunho de resumo de reunião (Gemini plugável via `AI_PROVIDER`)
- **Resend** — e-mails transacionais (convite, lembrete, recuperação de senha)

## Configuração local

1. Copie `.env.example` para `.env` e preencha as variáveis (veja comentários no arquivo).
2. Banco de dados local (opcional, para desenvolvimento sem depender do Neon):
   ```bash
   brew install postgresql@16
   brew services start postgresql@16
   createdb orientacao_tcc
   ```
3. Instale as dependências e rode as migrations:
   ```bash
   npm install
   npx prisma migrate dev
   ```
4. Crie um professor de teste:
   ```bash
   npx tsx prisma/seed.ts
   ```
   Cria `professor@exemplo.com` / senha `senha1234`.
5. Rode o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## Variáveis de ambiente obrigatórias para funcionalidades completas

- `DATABASE_URL` — string de conexão Postgres
- `AUTH_SECRET` — gere com `openssl rand -base64 33`
- `NEXTAUTH_URL` — URL pública da aplicação (ex.: `https://seuapp.netlify.app`)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — criar um OAuth Client no Google Cloud Console,
  com URI de redirecionamento `<NEXTAUTH_URL>/api/google/callback` e escopos de Calendar
- `TOKEN_ENCRYPTION_KEY` — gere com `openssl rand -base64 32` (criptografa os tokens do Google no banco)
- `ANTHROPIC_API_KEY` (ou `GOOGLE_AI_API_KEY` + `AI_PROVIDER=gemini`) — para o resumo por IA
- `RESEND_API_KEY` / `EMAIL_FROM` — para envio de e-mails (sem isso, os e-mails só são logados no console)

Sem essas chaves, o sistema continua funcional para os fluxos que não dependem delas (login,
cadastro, painel, notas) — apenas a criação de evento no Calendar, o envio de e-mail e o resumo por
IA falham de forma controlada (erro exibido na tela, sem quebrar o restante do fluxo).

## Deploy na Netlify

Este repositório já inclui `netlify.toml` com o plugin oficial `@netlify/plugin-nextjs`. Passos:

1. Crie um banco Postgres (ex.: [Neon](https://neon.tech)) e rode `npx prisma migrate deploy` contra ele.
2. Na Netlify, importe o repositório e configure as variáveis de ambiente acima (aba **Site
   configuration → Environment variables**).
3. Configure o OAuth do Google com a URL de produção antes de conectar o Calendar.

## Estrutura

- `src/app/(professor)` — painel, cadastro de alunos, horários, tela da reunião, configurações
- `src/app/(aluno)` — início, agendar reunião, histórico de reuniões/resumos
- `src/lib/actions` — Server Actions (mutações)
- `src/lib/*` — integrações (Google Calendar, IA, e-mail), regras de negócio (status, datas)
- `prisma/schema.prisma` — modelo de dados completo (inclui entidades das Fases 2 e 3, já
  preparadas no schema para evitar migrations grandes mais tarde)

[requisitos-sistema-orientacao.md]: ./requisitos-sistema-orientacao.md

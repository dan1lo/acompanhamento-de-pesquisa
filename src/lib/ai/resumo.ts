import { z } from "zod";

export const RascunhoResumoSchema = z.object({
  decisoes: z.string(),
  combinados: z.string(),
  duvidasAbertas: z.string(),
  proximosPassos: z.string(),
  tarefasPropostas: z.array(
    z.object({
      titulo: z.string(),
      responsavel: z.string().optional(),
      prazo: z.string().optional(),
    })
  ),
});

export type RascunhoResumo = z.infer<typeof RascunhoResumoSchema>;

const PROMPT_SISTEMA = `Você é um assistente que resume reuniões de orientação acadêmica (TCC, mestrado ou doutorado) a partir de uma transcrição colada pelo professor.

Devolva SOMENTE um JSON válido, sem markdown, no formato:
{
  "decisoes": "texto em português",
  "combinados": "texto em português",
  "duvidasAbertas": "texto em português",
  "proximosPassos": "texto em português",
  "tarefasPropostas": [{ "titulo": "...", "responsavel": "aluno|professor", "prazo": "AAAA-MM-DD ou vazio" }]
}

Seja objetivo e fiel ao conteúdo da transcrição. Não invente informações que não estejam no texto.`;

const MAX_CHARS_POR_BLOCO = 60_000;

function dividirEmBlocos(texto: string): string[] {
  if (texto.length <= MAX_CHARS_POR_BLOCO) return [texto];
  const blocos: string[] = [];
  for (let i = 0; i < texto.length; i += MAX_CHARS_POR_BLOCO) {
    blocos.push(texto.slice(i, i + MAX_CHARS_POR_BLOCO));
  }
  return blocos;
}

async function gerarComClaude(transcricao: string): Promise<RascunhoResumo> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

  const blocos = dividirEmBlocos(transcricao);
  const textoFinal =
    blocos.length === 1
      ? blocos[0]
      : blocos.map((b, i) => `--- Bloco ${i + 1}/${blocos.length} ---\n${b}`).join("\n\n");

  const resposta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system: PROMPT_SISTEMA,
      messages: [
        {
          role: "user",
          content: `Transcrição da reunião:\n\n${textoFinal}`,
        },
      ],
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`Falha na API da Anthropic (${resposta.status}): ${detalhe}`);
  }

  const dados = await resposta.json();
  const textoResposta: string = dados.content?.[0]?.text ?? "{}";
  const json = extrairJson(textoResposta);
  return RascunhoResumoSchema.parse(json);
}

async function gerarComGemini(transcricao: string): Promise<RascunhoResumo> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY não configurada");

  const blocos = dividirEmBlocos(transcricao);
  const textoFinal =
    blocos.length === 1
      ? blocos[0]
      : blocos.map((b, i) => `--- Bloco ${i + 1}/${blocos.length} ---\n${b}`).join("\n\n");

  const resposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
        contents: [{ parts: [{ text: `Transcrição da reunião:\n\n${textoFinal}` }] }],
      }),
    }
  );

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`Falha na API do Gemini (${resposta.status}): ${detalhe}`);
  }

  const dados = await resposta.json();
  const textoResposta: string = dados.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const json = extrairJson(textoResposta);
  return RascunhoResumoSchema.parse(json);
}

function extrairJson(texto: string): unknown {
  const semMarkdown = texto.replace(/```json|```/g, "").trim();
  const inicio = semMarkdown.indexOf("{");
  const fim = semMarkdown.lastIndexOf("}");
  if (inicio === -1 || fim === -1) throw new Error("Resposta da IA não contém JSON válido");
  return JSON.parse(semMarkdown.slice(inicio, fim + 1));
}

export async function gerarRascunhoResumo(
  transcricao: string,
  provedor: "claude" | "gemini" = (process.env.AI_PROVIDER as "claude" | "gemini") || "claude"
): Promise<RascunhoResumo> {
  if (provedor === "gemini") return gerarComGemini(transcricao);
  return gerarComClaude(transcricao);
}

export function mascararNomesTerceiros(texto: string, nomes: string[]): string {
  let resultado = texto;
  for (const nome of nomes) {
    if (!nome.trim()) continue;
    const regex = new RegExp(nome.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    resultado = resultado.replace(regex, "[nome removido]");
  }
  return resultado;
}

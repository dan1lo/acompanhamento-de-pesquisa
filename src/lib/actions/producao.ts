"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAluno, requireProfessor } from "@/lib/guards";
import { parseDataLocal } from "@/lib/datas";

function extrairGoogleDocsId(url: string): string | null {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function buscarTextoGoogleDocs(url: string): Promise<string | null> {
  const docId = extrairGoogleDocsId(url);
  if (!docId) return null;
  try {
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
    const res = await fetch(exportUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const text = await res.text();
      return text.replace(/^\uFEFF/, "").trim();
    }
  } catch (err) {
    console.error("Erro ao sincronizar com Google Docs:", err);
  }
  return null;
}

const CriarProducaoSchema = z.object({
  titulo: z.string().min(1, "Informe o título"),
  venue: z.string().optional(),
  prazoSubmissao: z.string().optional(),
  googleDocsUrl: z.string().optional(),
});

export async function criarProducaoAcademica(formData: FormData) {
  const { aluno } = await requireAluno();

  const vincular = formData.get("vincularGoogleDocs") === "true" || formData.get("vincularGoogleDocs") === "on";
  let googleDocsUrl = formData.get("googleDocsUrl")?.toString().trim() || null;
  if (!vincular || !googleDocsUrl) {
    googleDocsUrl = null;
  }

  let conteudoInicial = "";
  if (googleDocsUrl) {
    const textoImportado = await buscarTextoGoogleDocs(googleDocsUrl);
    if (textoImportado) {
      conteudoInicial = textoImportado;
    }
  }

  const dados = CriarProducaoSchema.parse({
    titulo: formData.get("titulo"),
    venue: formData.get("venue") || undefined,
    prazoSubmissao: formData.get("prazoSubmissao") || undefined,
    googleDocsUrl: googleDocsUrl || undefined,
  });

  const novaProducao = await prisma.producaoAcademica.create({
    data: {
      alunoId: aluno.id,
      titulo: dados.titulo,
      venue: dados.venue,
      prazoSubmissao: dados.prazoSubmissao ? parseDataLocal(dados.prazoSubmissao) : undefined,
      googleDocsUrl: dados.googleDocsUrl,
      conteudo: conteudoInicial || null,
    },
  });

  revalidatePath("/producao");
  revalidatePath(`/alunos/${aluno.id}`);

  return { id: novaProducao.id };
}

export async function atualizarConteudoProducao(producaoId: string, conteudo: string) {
  const { aluno } = await requireAluno();

  const producao = await prisma.producaoAcademica.findUnique({
    where: { id: producaoId },
  });

  if (!producao || producao.alunoId !== aluno.id) {
    throw new Error("Trabalho acadêmico não encontrado ou acesso não autorizado");
  }

  await prisma.producaoAcademica.update({
    where: { id: producaoId },
    data: { conteudo },
  });

  revalidatePath(`/producao/${producaoId}`);
  revalidatePath("/producao");
}

export async function sincronizarGoogleDocs(producaoId: string) {
  const { aluno } = await requireAluno();

  const producao = await prisma.producaoAcademica.findUnique({
    where: { id: producaoId },
  });

  if (!producao || producao.alunoId !== aluno.id) {
    throw new Error("Trabalho acadêmico não encontrado ou acesso não autorizado");
  }

  if (!producao.googleDocsUrl) {
    throw new Error("Este trabalho não está vinculado ao Google Docs");
  }

  const texto = await buscarTextoGoogleDocs(producao.googleDocsUrl);
  if (!texto) {
    throw new Error(
      "Não foi possível obter o texto do Google Docs automaticamente. Verifique se o documento está configurado com permissão para 'Qualquer pessoa com o link' ler."
    );
  }

  await prisma.producaoAcademica.update({
    where: { id: producaoId },
    data: { conteudo: texto },
  });

  revalidatePath(`/producao/${producaoId}`);
  revalidatePath("/producao");

  return { conteudo: texto };
}

const STATUS_VALIDOS = ["EM_ESCRITA", "SUBMETIDO", "EM_REVISAO", "ACEITO", "PUBLICADO"] as const;

export async function atualizarStatusProducao(producaoId: string, status: (typeof STATUS_VALIDOS)[number]) {
  const professor = await requireProfessor();

  const producao = await prisma.producaoAcademica.findUnique({
    where: { id: producaoId },
    include: { aluno: true },
  });
  if (!producao || producao.aluno.orientadorId !== professor.id) throw new Error("Produção não encontrada");
  if (!STATUS_VALIDOS.includes(status)) throw new Error("Status inválido");

  await prisma.producaoAcademica.update({ where: { id: producaoId }, data: { status } });
  revalidatePath(`/alunos/${producao.alunoId}`);
}

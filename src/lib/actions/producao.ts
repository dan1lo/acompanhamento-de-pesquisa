"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAluno, requireProfessor } from "@/lib/guards";
import { auth } from "@/lib/auth";
import { parseDataLocal } from "@/lib/datas";

export type CorMarcacao = "AMARELO" | "VERMELHO" | "AZUL" | "ROXO";

export interface ComentarioArtigo {
  id: string;
  trecho: string;
  comentario: string;
  cor: CorMarcacao;
  resolvido: boolean;
  criadoEm: string;
  autorNome?: string;
}

function parseComentarios(jsonStr?: string | null): ComentarioArtigo[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function removerMarkDoHtml(html: string | null | undefined, markId: string): string {
  if (!html) return "";
  // Remove a tag <mark data-mark-id="markId"...>texto</mark> preservando o conteúdo interno
  const regex = new RegExp(
    `<mark[^>]*data-mark-id=["']${markId}["'][^>]*>([\\s\\S]*?)<\\/mark>`,
    "gi"
  );
  return html.replace(regex, "$1");
}

export async function buscarExtrasProducoes(ids: string[]): Promise<
  Record<string, { overleafUrl: string | null; comentariosJson: string | null }>
> {
  if (ids.length === 0) return {};
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; overleafUrl: string | null; comentariosJson: string | null }>
    >(
      `SELECT id, "overleafUrl", "comentariosJson" FROM producao_academica WHERE id = ANY($1::text[])`,
      ids
    );
    const map: Record<string, { overleafUrl: string | null; comentariosJson: string | null }> = {};
    for (const r of rows) {
      map[r.id] = {
        overleafUrl: r.overleafUrl ?? null,
        comentariosJson: r.comentariosJson ?? null,
      };
    }
    return map;
  } catch {
    return {};
  }
}

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
  overleafUrl: z.string().optional(),
});

export async function criarProducaoAcademica(formData: FormData) {
  const { aluno } = await requireAluno();

  const vincularDocs =
    formData.get("vincularGoogleDocs") === "true" ||
    formData.get("vincularGoogleDocs") === "on";
  let googleDocsUrl = formData.get("googleDocsUrl")?.toString().trim() || null;
  if (!vincularDocs || !googleDocsUrl) {
    googleDocsUrl = null;
  }

  const vincularOverleaf =
    formData.get("vincularOverleaf") === "true" ||
    formData.get("vincularOverleaf") === "on";
  let overleafUrl = formData.get("overleafUrl")?.toString().trim() || null;
  if (!vincularOverleaf || !overleafUrl) {
    overleafUrl = null;
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
    overleafUrl: overleafUrl || undefined,
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

  if (dados.overleafUrl) {
    await prisma.$executeRawUnsafe(
      `UPDATE producao_academica SET "overleafUrl" = $1 WHERE id = $2`,
      dados.overleafUrl,
      novaProducao.id
    );
  }

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
  revalidatePath(`/alunos/${aluno.id}`);
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
  revalidatePath("/producao");
}

export async function obterProducaoTempoRealProfessor(producaoId: string) {
  const professor = await requireProfessor();

  const producao = await prisma.producaoAcademica.findUnique({
    where: { id: producaoId },
    include: { aluno: { select: { orientadorId: true } } },
  });

  if (!producao || producao.aluno.orientadorId !== professor.id) {
    throw new Error("Produção não encontrada");
  }

  const extras = await buscarExtrasProducoes([producao.id]);
  const extra = extras[producao.id];

  return {
    id: producao.id,
    titulo: producao.titulo,
    venue: producao.venue,
    status: producao.status,
    prazoSubmissao: producao.prazoSubmissao,
    googleDocsUrl: producao.googleDocsUrl,
    overleafUrl: extra?.overleafUrl ?? null,
    comentariosJson: extra?.comentariosJson ?? null,
    conteudo: producao.conteudo,
    criadoEm: producao.criadoEm,
    atualizadoEm: producao.atualizadoEm,
  };
}

export async function obterComentariosProducaoAluno(producaoId: string) {
  const { aluno } = await requireAluno();

  const producao = await prisma.producaoAcademica.findUnique({
    where: { id: producaoId },
    select: { id: true, alunoId: true, conteudo: true },
  });

  if (!producao || producao.alunoId !== aluno.id) {
    throw new Error("Produção não encontrada");
  }

  const extras = await buscarExtrasProducoes([producao.id]);
  return {
    comentariosJson: extras[producao.id]?.comentariosJson ?? null,
    conteudo: producao.conteudo,
  };
}

export async function adicionarMarcacaoComentarioProfessor(
  producaoId: string,
  payload: {
    id: string;
    trecho: string;
    comentario: string;
    cor: CorMarcacao;
    conteudoAtualizado?: string;
  }
) {
  const professor = await requireProfessor();

  const producao = await prisma.producaoAcademica.findUnique({
    where: { id: producaoId },
    include: { aluno: { select: { id: true, orientadorId: true } } },
  });

  if (!producao || producao.aluno.orientadorId !== professor.id) {
    throw new Error("Produção não encontrada ou acesso não autorizado");
  }

  const extras = await buscarExtrasProducoes([producaoId]);
  const listaAtual = parseComentarios(extras[producaoId]?.comentariosJson);

  const novoComentario: ComentarioArtigo = {
    id: payload.id,
    trecho: payload.trecho.trim(),
    comentario: payload.comentario.trim(),
    cor: payload.cor,
    resolvido: false,
    criadoEm: new Date().toISOString(),
    autorNome: professor.name ?? "Orientador",
  };

  const novaLista = [...listaAtual, novoComentario];
  const novoJson = JSON.stringify(novaLista);
  const novoConteudo = payload.conteudoAtualizado ?? producao.conteudo;

  await prisma.$executeRawUnsafe(
    `UPDATE producao_academica SET "comentariosJson" = $1, "conteudo" = $2, "atualizadoEm" = NOW() WHERE id = $3`,
    novoJson,
    novoConteudo,
    producaoId
  );

  revalidatePath(`/alunos/${producao.aluno.id}`);
  revalidatePath(`/producao/${producaoId}`);
  revalidatePath("/producao");

  return { comentarios: novaLista, conteudo: novoConteudo };
}

export async function resolverComentarioProducao(producaoId: string, comentarioId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const producao = await prisma.producaoAcademica.findUnique({
    where: { id: producaoId },
    include: { aluno: { select: { id: true, usuarioId: true, orientadorId: true } } },
  });

  if (!producao) throw new Error("Produção não encontrada");

  const isOrientador = producao.aluno.orientadorId === session.user.id;
  const isAlunoDono = producao.aluno.usuarioId === session.user.id;
  if (!isOrientador && !isAlunoDono) {
    throw new Error("Acesso não autorizado");
  }

  const extras = await buscarExtrasProducoes([producaoId]);
  const listaAtual = parseComentarios(extras[producaoId]?.comentariosJson);

  const novaLista = listaAtual.map((c) =>
    c.id === comentarioId ? { ...c, resolvido: true } : c
  );
  const novoJson = JSON.stringify(novaLista);
  const novoConteudo = removerMarkDoHtml(producao.conteudo, comentarioId);

  await prisma.$executeRawUnsafe(
    `UPDATE producao_academica SET "comentariosJson" = $1, "conteudo" = $2, "atualizadoEm" = NOW() WHERE id = $3`,
    novoJson,
    novoConteudo,
    producaoId
  );

  revalidatePath(`/alunos/${producao.aluno.id}`);
  revalidatePath(`/producao/${producaoId}`);
  revalidatePath("/producao");

  return { comentarios: novaLista, conteudo: novoConteudo };
}

export async function excluirComentarioProducao(producaoId: string, comentarioId: string) {
  const professor = await requireProfessor();

  const producao = await prisma.producaoAcademica.findUnique({
    where: { id: producaoId },
    include: { aluno: { select: { id: true, orientadorId: true } } },
  });

  if (!producao || producao.aluno.orientadorId !== professor.id) {
    throw new Error("Acesso não autorizado");
  }

  const extras = await buscarExtrasProducoes([producaoId]);
  const listaAtual = parseComentarios(extras[producaoId]?.comentariosJson);
  const novaLista = listaAtual.filter((c) => c.id !== comentarioId);
  const novoJson = JSON.stringify(novaLista);
  const novoConteudo = removerMarkDoHtml(producao.conteudo, comentarioId);

  await prisma.$executeRawUnsafe(
    `UPDATE producao_academica SET "comentariosJson" = $1, "conteudo" = $2, "atualizadoEm" = NOW() WHERE id = $3`,
    novoJson,
    novoConteudo,
    producaoId
  );

  revalidatePath(`/alunos/${producao.aluno.id}`);
  revalidatePath(`/producao/${producaoId}`);
  revalidatePath("/producao");

  return { comentarios: novaLista, conteudo: novoConteudo };
}

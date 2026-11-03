"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface CanvasSecao {
  id: string;
  titulo: string;
  descricao?: string;
  estimativaPaginas?: string;
}

export interface CanvasDados {
  tema: string;
  problema: string;
  objetivosGerais: string;
  objetivosEspecificos: string;
  hipoteses: string;
  metodologia: string;
  lacunasBibliograficas: string;
  referenciasChave: string;
  secoesCapitulos: string; // JSON de CanvasSecao[] ou texto estruturado
}

export interface CanvasRegistro {
  id: string;
  alunoId: string;
  alunoNome: string;
  alunoEmail: string;
  orientadorNome?: string;
  nivel: string;
  dados: CanvasDados;
  ultimaEdicaoPorNome: string;
  ultimaEdicaoPorPapel: "ALUNO" | "PROFESSOR" | "SISTEMA";
  versaoAtual: number;
  atualizadoEm: string;
  criadoEm: string;
}

export interface VersaoCanvasItem {
  id: string;
  canvasId: string;
  versao: number;
  descricao: string;
  editadoPorNome: string;
  editadoPorPapel: string;
  dados: CanvasDados;
  criadoEm: string;
}

let tabelaCanvasGarantida = false;

export async function garantirTabelasCanvas() {
  if (tabelaCanvasGarantida) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS canvas_pesquisa (
        id TEXT PRIMARY KEY,
        "alunoId" TEXT UNIQUE NOT NULL,
        tema TEXT DEFAULT '',
        problema TEXT DEFAULT '',
        "objetivosGerais" TEXT DEFAULT '',
        "objetivosEspecificos" TEXT DEFAULT '',
        hipoteses TEXT DEFAULT '',
        metodologia TEXT DEFAULT '',
        "lacunasBibliograficas" TEXT DEFAULT '',
        "referenciasChave" TEXT DEFAULT '',
        "secoesCapitulos" TEXT DEFAULT '[]',
        "ultimaEdicaoPorNome" TEXT NOT NULL,
        "ultimaEdicaoPorPapel" TEXT NOT NULL,
        "versaoAtual" INTEGER DEFAULT 1,
        "atualizadoEm" TIMESTAMP DEFAULT NOW(),
        "criadoEm" TIMESTAMP DEFAULT NOW()
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS canvas_pesquisa_versao (
        id TEXT PRIMARY KEY,
        "canvasId" TEXT NOT NULL,
        "alunoId" TEXT NOT NULL,
        versao INTEGER NOT NULL,
        "dadosJson" TEXT NOT NULL,
        descricao TEXT NOT NULL,
        "editadoPorNome" TEXT NOT NULL,
        "editadoPorPapel" TEXT NOT NULL,
        "criadoEm" TIMESTAMP DEFAULT NOW()
      );
    `);

    tabelaCanvasGarantida = true;
  } catch (err: any) {
    if (
      err?.code === "23505" ||
      err?.code === "42P07" ||
      String(err?.message || "").includes("já existe")
    ) {
      tabelaCanvasGarantida = true;
      return;
    }
  }
}

/**
 * Busca ou inicializa o Canvas de Pesquisa para um aluno específico.
 * Se nenhum alunoId for passado e o usuário for ALUNO, resolve o aluno da sessão.
 */
export async function obterCanvasAluno(alunoIdAlvo?: string): Promise<{
  canvas: CanvasRegistro | null;
  orientandos?: Array<{ id: string; nome: string; nivel: string }>;
  isAluno: boolean;
}> {
  await garantirTabelasCanvas();
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    include: { aluno: true },
  });
  if (!usuario) throw new Error("Usuário não encontrado");

  const isAluno = usuario.papel === "ALUNO";
  let targetAlunoId = alunoIdAlvo;

  let orientandos: Array<{ id: string; nome: string; nivel: string }> = [];

  if (isAluno) {
    let alunoObj = usuario.aluno;
    if (!alunoObj && usuario.email) {
      alunoObj = await prisma.aluno.findUnique({
        where: { email: usuario.email.toLowerCase().trim() },
      });
    }
    if (!alunoObj) return { canvas: null, isAluno: true };
    targetAlunoId = alunoObj.id;
  } else {
    // É professor ou coorientador: lista todos os orientandos
    orientandos = await prisma.aluno.findMany({
      where: { orientadorId: usuario.id, arquivado: false },
      select: { id: true, nome: true, nivel: true },
      orderBy: { nome: "asc" },
    });

    if (!targetAlunoId && orientandos.length > 0) {
      targetAlunoId = orientandos[0].id;
    }
  }

  if (!targetAlunoId) {
    return { canvas: null, orientandos, isAluno };
  }

  const aluno = await prisma.aluno.findUnique({
    where: { id: targetAlunoId },
    include: { orientador: { select: { nome: true } } },
  });
  if (!aluno) return { canvas: null, orientandos, isAluno };

  // Busca o registro do canvas
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM canvas_pesquisa WHERE "alunoId" = $1 LIMIT 1;`,
    targetAlunoId
  );

  let canvasRow = rows[0];

  if (!canvasRow) {
    // Inicializa o canvas com dados padrão
    const novoId = `canvas_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const secoesPadrao = JSON.stringify([
      { id: "1", titulo: "1. Introdução e Contextualização", estimativaPaginas: "3-5 páginas", descricao: "Apresentação do tema, relevância e justificativa acadêmica." },
      { id: "2", titulo: "2. Revisão Bibliográfica / Fundamentação", estimativaPaginas: "10-15 páginas", descricao: "Estado da arte, principais autores e conceitos norteadores." },
      { id: "3", titulo: "3. Metodologia da Pesquisa", estimativaPaginas: "4-6 páginas", descricao: "Tipo de pesquisa, instrumentos de coleta e procedimentos de análise." },
      { id: "4", titulo: "4. Desenvolvimento e Resultados", estimativaPaginas: "15-20 páginas", descricao: "Apresentação dos dados coletados e discussão analítica." },
      { id: "5", titulo: "5. Considerações Finais", estimativaPaginas: "3-4 páginas", descricao: "Conclusões, limitações do estudo e sugestões de trabalhos futuros." },
    ]);

    await prisma.$executeRawUnsafe(
      `INSERT INTO canvas_pesquisa (
        id, "alunoId", tema, problema, "objetivosGerais", "objetivosEspecificos",
        hipoteses, metodologia, "lacunasBibliograficas", "referenciasChave",
        "secoesCapitulos", "ultimaEdicaoPorNome", "ultimaEdicaoPorPapel", "versaoAtual",
        "atualizadoEm", "criadoEm"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, NOW(), NOW());`,
      novoId,
      targetAlunoId,
      aluno.tema || "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      secoesPadrao,
      usuario.nome,
      isAluno ? "ALUNO" : "PROFESSOR"
    );

    // Salva versão inicial 1
    const vId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const snapshotDados: CanvasDados = {
      tema: aluno.tema || "",
      problema: "",
      objetivosGerais: "",
      objetivosEspecificos: "",
      hipoteses: "",
      metodologia: "",
      lacunasBibliograficas: "",
      referenciasChave: "",
      secoesCapitulos: secoesPadrao,
    };
    await prisma.$executeRawUnsafe(
      `INSERT INTO canvas_pesquisa_versao (
        id, "canvasId", "alunoId", versao, "dadosJson", descricao,
        "editadoPorNome", "editadoPorPapel", "criadoEm"
      ) VALUES ($1, $2, $3, 1, $4, 'Versão inicial', $5, $6, NOW());`,
      vId,
      novoId,
      targetAlunoId,
      JSON.stringify(snapshotDados),
      usuario.nome,
      isAluno ? "ALUNO" : "PROFESSOR"
    );

    canvasRow = {
      id: novoId,
      alunoId: targetAlunoId,
      tema: aluno.tema || "",
      problema: "",
      objetivosGerais: "",
      objetivosEspecificos: "",
      hipoteses: "",
      metodologia: "",
      lacunasBibliograficas: "",
      referenciasChave: "",
      secoesCapitulos: secoesPadrao,
      ultimaEdicaoPorNome: usuario.nome,
      ultimaEdicaoPorPapel: isAluno ? "ALUNO" : "PROFESSOR",
      versaoAtual: 1,
      atualizadoEm: new Date(),
      criadoEm: new Date(),
    };
  }

  const canvas: CanvasRegistro = {
    id: canvasRow.id,
    alunoId: canvasRow.alunoId,
    alunoNome: aluno.nome,
    alunoEmail: aluno.email,
    orientadorNome: aluno.orientador?.nome,
    nivel: aluno.nivel,
    dados: {
      tema: canvasRow.tema || "",
      problema: canvasRow.problema || "",
      objetivosGerais: canvasRow.objetivosGerais || "",
      objetivosEspecificos: canvasRow.objetivosEspecificos || "",
      hipoteses: canvasRow.hipoteses || "",
      metodologia: canvasRow.metodologia || "",
      lacunasBibliograficas: canvasRow.lacunasBibliograficas || "",
      referenciasChave: canvasRow.referenciasChave || "",
      secoesCapitulos: canvasRow.secoesCapitulos || "[]",
    },
    ultimaEdicaoPorNome: canvasRow.ultimaEdicaoPorNome || "",
    ultimaEdicaoPorPapel: (canvasRow.ultimaEdicaoPorPapel as any) || "SISTEMA",
    versaoAtual: Number(canvasRow.versaoAtual) || 1,
    atualizadoEm: new Date(canvasRow.atualizadoEm).toISOString(),
    criadoEm: new Date(canvasRow.criadoEm).toISOString(),
  };

  return { canvas, orientandos, isAluno };
}

/**
 * Salva as alterações feitas no Canvas de Pesquisa, atualizando a versão e o histórico.
 */
export async function salvarCanvas(
  alunoId: string,
  dados: CanvasDados,
  descricaoVersao?: string
): Promise<{ ok: boolean; novaVersao: number; canvas?: CanvasRegistro; erro?: string }> {
  await garantirTabelasCanvas();
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
  });
  if (!usuario) throw new Error("Usuário não encontrado");

  const papel = usuario.papel === "ALUNO" ? "ALUNO" : "PROFESSOR";

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM canvas_pesquisa WHERE "alunoId" = $1 LIMIT 1;`,
    alunoId
  );

  if (rows.length === 0) {
    throw new Error("Canvas não encontrado.");
  }

  const canvasAtual = rows[0];
  const proximaVersao = (Number(canvasAtual.versaoAtual) || 1) + 1;

  // Atualiza o registro principal
  await prisma.$executeRawUnsafe(
    `UPDATE canvas_pesquisa
     SET tema = $1,
         problema = $2,
         "objetivosGerais" = $3,
         "objetivosEspecificos" = $4,
         hipoteses = $5,
         metodologia = $6,
         "lacunasBibliograficas" = $7,
         "referenciasChave" = $8,
         "secoesCapitulos" = $9,
         "ultimaEdicaoPorNome" = $10,
         "ultimaEdicaoPorPapel" = $11,
         "versaoAtual" = $12,
         "atualizadoEm" = NOW()
     WHERE "alunoId" = $13;`,
    dados.tema,
    dados.problema,
    dados.objetivosGerais,
    dados.objetivosEspecificos,
    dados.hipoteses,
    dados.metodologia,
    dados.lacunasBibliograficas,
    dados.referenciasChave,
    dados.secoesCapitulos,
    usuario.nome,
    papel,
    proximaVersao,
    alunoId
  );

  // Também atualiza o tema na tabela aluno se foi editado
  if (dados.tema && dados.tema.trim()) {
    try {
      await prisma.aluno.update({
        where: { id: alunoId },
        data: { tema: dados.tema.trim() },
      });
    } catch {}
  }

  // Cria snapshot no histórico de versões
  const vId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const desc = descricaoVersao?.trim() || `Alteração por ${usuario.nome} (${papel === "ALUNO" ? "Aluno" : "Orientador"})`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO canvas_pesquisa_versao (
      id, "canvasId", "alunoId", versao, "dadosJson", descricao,
      "editadoPorNome", "editadoPorPapel", "criadoEm"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());`,
    vId,
    canvasAtual.id,
    alunoId,
    proximaVersao,
    JSON.stringify(dados),
    desc,
    usuario.nome,
    papel
  );

  revalidatePath("/canvas");
  revalidatePath("/roadmap");
  revalidatePath(`/alunos/${alunoId}`);

  let canvasAtualizado: CanvasRegistro | undefined;
  try {
    const atualizado = await obterCanvasAluno(alunoId);
    canvasAtualizado = atualizado.canvas ?? undefined;
  } catch {}

  return { ok: true, novaVersao: proximaVersao, canvas: canvasAtualizado };
}

/**
 * Lista todas as versões salvas de um Canvas de Pesquisa para visualização e restauração.
 */
export async function listarVersoesCanvas(canvasId: string): Promise<VersaoCanvasItem[]> {
  await garantirTabelasCanvas();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM canvas_pesquisa_versao WHERE "canvasId" = $1 ORDER BY versao DESC;`,
    canvasId
  );

  return rows.map((r) => {
    let dadosParsed: CanvasDados;
    try {
      dadosParsed = JSON.parse(r.dadosJson);
    } catch {
      dadosParsed = {
        tema: "",
        problema: "",
        objetivosGerais: "",
        objetivosEspecificos: "",
        hipoteses: "",
        metodologia: "",
        lacunasBibliograficas: "",
        referenciasChave: "",
        secoesCapitulos: "[]",
      };
    }

    return {
      id: r.id,
      canvasId: r.canvasId,
      versao: Number(r.versao),
      descricao: r.descricao,
      editadoPorNome: r.editadoPorNome,
      editadoPorPapel: r.editadoPorPapel,
      dados: dadosParsed,
      criadoEm: new Date(r.criadoEm).toISOString(),
    };
  });
}

/**
 * Restaura o Canvas para o conteúdo de uma versão anterior gravada.
 */
export async function restaurarVersaoCanvas(
  versaoId: string
): Promise<{ ok: boolean; novaVersao: number; canvas?: CanvasRegistro; erro?: string }> {
  await garantirTabelasCanvas();
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
  });
  if (!usuario) throw new Error("Usuário não encontrado");

  const vRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM canvas_pesquisa_versao WHERE id = $1 LIMIT 1;`,
    versaoId
  );
  if (vRows.length === 0) throw new Error("Versão não encontrada");

  const versaoAlvo = vRows[0];
  let dadosRestaurados: CanvasDados;
  try {
    dadosRestaurados = JSON.parse(versaoAlvo.dadosJson);
  } catch {
    throw new Error("Erro ao decodificar os dados da versão.");
  }

  return salvarCanvas(
    versaoAlvo.alunoId,
    dadosRestaurados,
    `Restauração da versão ${versaoAlvo.versao} por ${usuario.nome}`
  );
}


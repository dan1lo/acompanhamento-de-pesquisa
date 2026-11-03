import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { garantirExtrasProducao } from "@/lib/actions/producao";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stripHtmlParaTexto(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function gerarPdfFallbackBuffer(
  titulo: string,
  venue: string | null,
  conteudoRaw: string | null
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 64, bottom: 64, left: 64, right: 64 },
        info: {
          Title: titulo || "Produção Acadêmica",
          Creator: "Scholab — Gestão de Pesquisa",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err: Error) => reject(err));

      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor("#133C1B")
        .text(titulo || "Produção Acadêmica", { align: "left" });

      if (venue) {
        doc.moveDown(0.3);
        doc
          .font("Helvetica-Oblique")
          .fontSize(11)
          .fillColor("#4B5563")
          .text(`Periódico / Conferência: ${venue}`, { align: "left" });
      }

      doc.moveDown(0.6);
      doc
        .moveTo(64, doc.y)
        .lineTo(531, doc.y)
        .strokeColor("#D1D5DB")
        .lineWidth(1)
        .stroke();
      doc.moveDown(1);

      const textoLimpo = stripHtmlParaTexto(conteudoRaw || "");
      const corpo =
        textoLimpo.length > 0
          ? textoLimpo
          : "1. Introdução\n\nEste manuscrito encontra-se em desenvolvimento pelo pesquisador discente no âmbito do cronograma de pesquisa acadêmica.\n\n2. Metodologia e Desenvolvimento\n\nOs experimentos, revisões bibliográficas e análises dos dados estão documentados nesta versão do arquivo PDF para revisão e marcação de apontamentos pelo orientador.\n\n3. Resultados Preliminares e Próximos Passos\n\nAs observações destacadas pelo orientador diretamente sobre este PDF serão incorporadas na próxima submissão de versão.";

      doc
        .font("Times-Roman")
        .fontSize(12)
        .fillColor("#1F2937")
        .text(corpo, {
          align: "justify",
          lineGap: 4,
          paragraphGap: 8,
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    }

    const { id: producaoId } = await context.params;
    const { searchParams } = new URL(request.url);
    const versaoParam = searchParams.get("versao");
    const downloadParam = searchParams.get("download") === "1";

    await garantirExtrasProducao();

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        titulo: string;
        venue: string | null;
        conteudo: string | null;
        alunoId: string;
        versaoAtual: number | null;
        pdfNomeArquivo: string | null;
        pdfBase64: string | null;
      }>
    >(
      `SELECT id, titulo, venue, conteudo, "alunoId", COALESCE("versaoAtual", 1) as "versaoAtual", "pdfNomeArquivo", "pdfBase64"
       FROM producao_academica
       WHERE id = $1
       LIMIT 1`,
      producaoId
    );

    if (rows.length === 0) {
      return NextResponse.json({ erro: "Produção não encontrada." }, { status: 404 });
    }

    const prod = rows[0];

    // Verifica permissão (próprio aluno ou seu orientador)
    const aluno = await prisma.aluno.findUnique({
      where: { id: prod.alunoId },
      select: {
        usuarioId: true,
        orientadorId: true,
      },
    });

    if (!aluno) {
      return NextResponse.json({ erro: "Aluno não encontrado." }, { status: 404 });
    }

    const isAlunoDono = aluno.usuarioId === session.user.id;
    const isProfessorAutorizado = aluno.orientadorId === session.user.id;

    if (!isAlunoDono && !isProfessorAutorizado) {
      return NextResponse.json({ erro: "Acesso negado." }, { status: 403 });
    }

    const versaoAtualNum = Number(prod.versaoAtual) || 1;
    const versaoSolicitada =
      versaoParam && versaoParam !== "atual" ? Number(versaoParam) : versaoAtualNum;

    let pdfBase64: string | null = null;
    let nomeArquivo =
      prod.pdfNomeArquivo ||
      `${prod.titulo.replace(/[^a-zA-Z0-9_-]+/g, "_")}_v${versaoSolicitada}.pdf`;

    if (
      !versaoParam ||
      versaoParam === "atual" ||
      versaoSolicitada === versaoAtualNum
    ) {
      pdfBase64 = prod.pdfBase64;
    } else {
      // Busca na tabela de versões históricas
      const histRows = await prisma.$queryRawUnsafe<
        Array<{
          pdfBase64: string | null;
          nomeArquivo: string | null;
        }>
      >(
        `SELECT "pdfBase64", "nomeArquivo"
         FROM versao_producao_pdf
         WHERE "producaoId" = $1 AND "versaoNumero" = $2
         ORDER BY "arquivadoEm" DESC
         LIMIT 1`,
        producaoId,
        versaoSolicitada
      );

      if (histRows.length > 0 && histRows[0].pdfBase64) {
        pdfBase64 = histRows[0].pdfBase64;
        if (histRows[0].nomeArquivo) {
          nomeArquivo = histRows[0].nomeArquivo;
        }
      } else {
        // Fallback: caso não encontre o binário da versão antiga, retorna o PDF atual ou gera fallback
        pdfBase64 = prod.pdfBase64;
      }
    }

    let pdfBuffer: Buffer;
    if (pdfBase64 && pdfBase64.length > 20) {
      pdfBuffer = Buffer.from(pdfBase64, "base64");
    } else {
      pdfBuffer = await gerarPdfFallbackBuffer(
        prod.titulo,
        prod.venue,
        prod.conteudo
      );
      const geradoBase64 = pdfBuffer.toString("base64");
      const nomePadrao =
        prod.pdfNomeArquivo ||
        `${prod.titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "manuscrito"}-v${versaoAtualNum}.pdf`;

      await prisma.$executeRawUnsafe(
        `UPDATE producao_academica
         SET "pdfBase64" = $1,
             "pdfNomeArquivo" = COALESCE("pdfNomeArquivo", $2),
             "pdfTamanhoBytes" = COALESCE("pdfTamanhoBytes", $3),
             "pdfTotalPaginas" = COALESCE("pdfTotalPaginas", 1),
             "versaoAtual" = COALESCE("versaoAtual", 1)
         WHERE id = $4`,
        geradoBase64,
        nomePadrao,
        pdfBuffer.byteLength,
        producaoId
      );
    }

    const disposition = downloadParam
      ? `attachment; filename="${encodeURIComponent(nomeArquivo)}"`
      : `inline; filename="${encodeURIComponent(nomeArquivo)}"`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Content-Length": String(pdfBuffer.byteLength),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("Erro ao servir PDF da produção:", err);
    return NextResponse.json(
      { erro: "Falha ao carregar o arquivo PDF da produção." },
      { status: 500 }
    );
  }
}


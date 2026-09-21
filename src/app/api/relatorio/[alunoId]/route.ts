import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { requireProfessor } from "@/lib/guards";
import { formatarData, formatarDataHora } from "@/lib/datas";

export async function GET(request: NextRequest, { params }: { params: Promise<{ alunoId: string }> }) {
  const professor = await requireProfessor();
  const { alunoId } = await params;

  const aluno = await prisma.aluno.findUnique({
    where: { id: alunoId },
    include: {
      reunioes: { orderBy: { data: "asc" }, include: { resumo: true } },
      marcos: { orderBy: { dataPrevista: "asc" } },
      producoes: { orderBy: { criadoEm: "asc" } },
    },
  });
  if (!aluno || aluno.orientadorId !== professor.id) {
    return NextResponse.json({ erro: "Aluno não encontrado" }, { status: 404 });
  }

  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const pdfPronto = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(18).text(`Relatório de orientação — ${aluno.nome}`, { align: "left" });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#555").text(`Gerado em ${formatarDataHora(new Date())}`);
  doc.moveDown(1);

  doc.fillColor("#000").fontSize(12).text("Dados do aluno", { underline: true });
  doc.fontSize(10).text(`Nível: ${aluno.nivel}`);
  doc.text(`E-mail: ${aluno.email}`);
  doc.text(`Início: ${formatarData(aluno.dataInicio)}`);
  if (aluno.tema) doc.text(`Tema: ${aluno.tema}`);
  doc.moveDown(1);

  doc.fontSize(12).text("Histórico de reuniões", { underline: true });
  if (aluno.reunioes.length === 0) doc.fontSize(10).text("Nenhuma reunião registrada.");
  for (const r of aluno.reunioes) {
    doc.fontSize(10).text(`${formatarDataHora(r.data)} — ${r.status}`);
    if (r.resumo?.status === "PUBLICADO") {
      if (r.resumo.decisoes) doc.fontSize(9).fillColor("#333").text(`  Decisões: ${r.resumo.decisoes}`);
      if (r.resumo.combinados) doc.fontSize(9).text(`  Combinados: ${r.resumo.combinados}`);
      doc.fillColor("#000");
    }
    doc.moveDown(0.3);
  }
  doc.moveDown(0.7);

  doc.fontSize(12).text("Marcos", { underline: true });
  if (aluno.marcos.length === 0) doc.fontSize(10).text("Nenhum marco cadastrado.");
  for (const m of aluno.marcos) {
    doc.fontSize(10).text(`${m.titulo} — previsto ${formatarData(m.dataPrevista)}${m.concluido ? " (concluído)" : ""}`);
  }
  doc.moveDown(0.7);

  doc.fontSize(12).text("Produção acadêmica", { underline: true });
  if (aluno.producoes.length === 0) doc.fontSize(10).text("Nenhuma produção registrada.");
  for (const p of aluno.producoes) {
    doc.fontSize(10).text(`${p.titulo}${p.venue ? ` — ${p.venue}` : ""} (${p.status})`);
  }

  doc.end();
  const pdfBuffer = await pdfPronto;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="relatorio-${aluno.nome.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
}

export async function extrairTextoDeArquivo(file: File): Promise<string> {
  const nome = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (nome.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  if (nome.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  if (nome.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const { text } = await pdfParse(buffer);
    return text;
  }

  throw new Error("Formato de arquivo não suportado. Use .txt, .docx ou .pdf.");
}

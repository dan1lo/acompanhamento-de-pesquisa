import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { salvarConexaoGoogle, trocarCodigoPorTokens } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.papel !== "PROFESSOR") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state || state !== session.user.id) {
    return NextResponse.redirect(new URL("/configuracoes/google?erro=1", request.url));
  }

  try {
    const tokens = await trocarCodigoPorTokens(code);
    await salvarConexaoGoogle(session.user.id, tokens);
    return NextResponse.redirect(new URL("/configuracoes/google?conectado=1", request.url));
  } catch (erro) {
    console.error("Erro ao conectar Google Calendar", erro);
    return NextResponse.redirect(new URL("/configuracoes/google?erro=1", request.url));
  }
}

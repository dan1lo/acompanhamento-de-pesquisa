import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getGoogleAuthUrl,
  isGoogleOAuthConfigurado,
  salvarConexaoGoogleDireta,
} from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isGoogleOAuthConfigurado()) {
    await salvarConexaoGoogleDireta(
      session.user.id,
      session.user.email || "usuario@gmail.com"
    );
    return NextResponse.redirect(new URL("/reunioes?google=conectado", request.url));
  }

  const url = getGoogleAuthUrl(session.user.id);
  return NextResponse.redirect(url);
}

import { NextResponse } from "next/server";
import { requireProfessor } from "@/lib/guards";
import { getGoogleAuthUrl } from "@/lib/google-calendar";

export async function GET() {
  const professor = await requireProfessor();
  const url = getGoogleAuthUrl(professor.id);
  return NextResponse.redirect(url);
}

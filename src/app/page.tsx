import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (session.user.papel === "PROFESSOR") redirect("/painel");
  if (session.user.papel === "COORIENTADOR") redirect("/co/painel");
  if (session.user.papel === "ALUNO") redirect("/inicio");

  redirect("/inicio");
}

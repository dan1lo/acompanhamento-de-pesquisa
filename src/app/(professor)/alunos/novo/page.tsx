import { redirect } from "next/navigation";

export default function NovoAlunoPage() {
  redirect("/painel?adicionar=1");
}

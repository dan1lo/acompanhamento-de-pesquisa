import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      papel: "PROFESSOR" | "ALUNO" | "COORIENTADOR";
    } & DefaultSession["user"];
  }

  interface User {
    papel?: string;
  }
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash("senha1234", 12);

  const professor = await prisma.usuario.upsert({
    where: { email: "professor@exemplo.com" },
    update: {},
    create: {
      nome: "Professor Exemplo",
      email: "professor@exemplo.com",
      senhaHash,
      papel: "PROFESSOR",
    },
  });

  console.log("Professor de teste criado:", professor.email, "(senha: senha1234)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

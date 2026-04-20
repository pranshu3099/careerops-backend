import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const getUser = async (userId) => {
  return await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });
};

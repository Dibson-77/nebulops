import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
// v2: Forced reload for projects relation
import pkg from 'pg';

const { Pool } = pkg;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  // On utilise DATABASE_URL (ou DATA_BASE comme dans votre exemple)
  const connectionString = process.env.DATABASE_URL;

  const pool = new Pool({
    connectionString,
    max: 10,
  });

  const adapter = new PrismaPg(pool as any);

  return new PrismaClient({
    adapter, // C'est ici que l'erreur se corrige
    log: ["error"],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

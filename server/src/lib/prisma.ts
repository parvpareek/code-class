import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

/** Add pool hints for direct Postgres URLs only (Accelerate / prisma:// URLs left unchanged). */
function resolveDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  const isDirectPostgres =
    raw.startsWith('postgresql://') || raw.startsWith('postgres://');

  if (!isDirectPostgres) {
    return raw;
  }

  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '10');
      url.searchParams.set('pool_timeout', '10');
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const databaseUrl = resolveDatabaseUrl();

const prisma = new PrismaClient({
  ...(databaseUrl ? { datasourceUrl: databaseUrl } : {}),
  log: ['error'],
  errorFormat: 'pretty',
}).$extends(withAccelerate());

// Handle connection errors gracefully
prisma.$connect().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('❌ Database connection failed:', message);
  console.log('⚠️  Server will continue without database functionality');
});

// Graceful shutdown to close connections and free memory
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const prisma = new PrismaClient({
  log: ['error'],
  errorFormat: 'pretty',
}).$extends(withAccelerate());

// Configure connection pool limits (reduces memory footprint)
// These limits prevent too many connections from being created
if (process.env.DATABASE_URL) {
  // Parse connection string and add pool parameters if not present
  const url = new URL(process.env.DATABASE_URL);
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', '10'); // Limit to 10 connections
    url.searchParams.set('pool_timeout', '10'); // 10 second timeout
  }
  // Note: Prisma will use these parameters automatically if in connection string
}

// Handle connection errors gracefully
prisma.$connect().catch((error: any) => {
  console.error('❌ Database connection failed:', error.message);
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
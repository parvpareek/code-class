#!/usr/bin/env node

/**
 * Check memory usage at different startup stages
 * Run this to see what's consuming memory before any requests
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Analyzing startup memory usage...\n');

// Create a minimal test file that imports key modules
const testCode = `
import { performance } from 'perf_hooks';

const stages = [];
function checkpoint(name) {
  const usage = process.memoryUsage();
  stages.push({
    name,
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
  });
}

checkpoint('Baseline');

// Test 1: Just Prisma Client
console.log('Loading Prisma...');
const { PrismaClient } = await import('@prisma/client');
checkpoint('After Prisma import');

const prisma = new PrismaClient();
checkpoint('After Prisma init');

// Test 2: Prisma with Accelerate
console.log('Loading Prisma Accelerate...');
const { withAccelerate } = await import('@prisma/extension-accelerate');
checkpoint('After Accelerate import');

const prismaWithAccel = new PrismaClient().$extends(withAccelerate());
checkpoint('After Prisma + Accelerate');

// Test 3: Express
console.log('Loading Express...');
const express = await import('express');
checkpoint('After Express import');

const app = express.default();
checkpoint('After Express init');

// Test 4: Socket.IO
console.log('Loading Socket.IO...');
const { Server } = await import('socket.io');
checkpoint('After Socket.IO import');

// Test 5: Other heavy deps
console.log('Loading other dependencies...');
await import('axios');
checkpoint('After Axios');
await import('ioredis');
checkpoint('After Redis');
await import('jsonwebtoken');
checkpoint('After JWT');
await import('bcryptjs');
checkpoint('After bcrypt');

// Print results
console.log('\\n📊 Memory Usage by Stage:\\n');
stages.forEach((stage, i) => {
  if (i === 0) return;
  const prev = stages[i - 1];
  const rssDiff = stage.rss - prev.rss;
  const heapDiff = stage.heapUsed - prev.heapUsed;
  
  console.log(\`\${stage.name}:\`);
  console.log(\`  RSS: \${(stage.rss / 1024 / 1024).toFixed(2)} MB (\${rssDiff > 0 ? '+' : ''}\${(rssDiff / 1024 / 1024).toFixed(2)} MB)\`);
  console.log(\`  Heap: \${(stage.heapUsed / 1024 / 1024).toFixed(2)} MB (\${heapDiff > 0 ? '+' : ''}\${(heapDiff / 1024 / 1024).toFixed(2)} MB)\`);
  console.log('');
});

await prisma.$disconnect();
process.exit(0);
`;

import fs from 'fs';
import path from 'path';

const testFile = path.join(__dirname, 'temp-memory-test.mjs');
fs.writeFileSync(testFile, testCode);

console.log('Running memory analysis...\n');

const child = spawn('node', ['--loader', 'ts-node/esm', testFile], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' }
});

child.on('exit', (code) => {
  try {
    fs.unlinkSync(testFile);
  } catch {}
  process.exit(code || 0);
});


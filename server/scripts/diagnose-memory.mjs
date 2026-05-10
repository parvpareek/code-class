#!/usr/bin/env node

/**
 * Memory Diagnostic Tool
 * Identifies what's consuming memory at startup
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Memory Diagnostic Analysis\n');
console.log('='.repeat(70));

// 1. Check Prisma Accelerate usage
console.log('\n1. PRISMA ACCELERATE CHECK:');
const prismaFile = join(__dirname, '..', 'src', 'lib', 'prisma.ts');
try {
  const content = readFileSync(prismaFile, 'utf-8');
  if (content.includes('withAccelerate')) {
    console.log('   ❌ Prisma Accelerate is ENABLED');
    console.log('   ⚠️  This adds 50-100MB+ memory overhead');
    console.log('   💡 Solution: Remove if not using Accelerate service');
  } else {
    console.log('   ✅ Prisma Accelerate is NOT enabled');
  }
} catch (e) {
  console.log('   ⚠️  Could not check Prisma file');
}

// 2. Check eager route loading
console.log('\n2. ROUTE LOADING CHECK:');
const indexFile = join(__dirname, '..', 'src', 'index.ts');
try {
  const content = readFileSync(indexFile, 'utf-8');
  const routeImports = content.match(/import .*Routes from ['"].*['"]/g) || [];
  console.log(`   Found ${routeImports.length} routes loaded at startup:`);
  routeImports.forEach(imp => {
    const routeName = imp.match(/(\w+)Routes/)?.[1] || 'unknown';
    console.log(`     - ${routeName}Routes`);
  });
  console.log('   ⚠️  All routes are eager-loaded (loaded even if not used)');
  console.log('   💡 Solution: Consider lazy-loading routes');
} catch (e) {
  console.log('   ⚠️  Could not check index file');
}

// 3. WebSocket (removed from codebase — client uses HTTP only)
console.log('\n3. WEBSOCKET:');
try {
  const wsService = join(__dirname, '..', 'src', 'services', 'websocket.service.ts');
  const content = readFileSync(indexFile, 'utf-8');
  if (content.includes('new WebSocketService')) {
    console.log('   ❌ WebSocket service initialized at startup');
    console.log('   ⚠️  Socket.IO adds significant memory even with 0 connections');
  } else if (existsSync(wsService)) {
    console.log('   ⚠️  websocket.service.ts still present but not wired at startup');
  } else {
    console.log('   ✅ No WebSocket server module / startup wiring');
  }
} catch (e) {
  console.log('   ⚠️  Could not check WebSocket status');
}

// 4. Check heavy dependencies
console.log('\n4. HEAVY DEPENDENCIES:');
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const heavyDeps = [
  '@prisma/extension-accelerate',
  'socket.io',
  '@google/generative-ai',
  'leetcode-query',
  'ioredis',
];

heavyDeps.forEach(dep => {
  if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
    const version = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
    console.log(`   ⚠️  ${dep}: ${version}`);
  }
});

// 5. Check Prisma client generation
console.log('\n5. PRISMA CLIENT SIZE:');
try {
  const generatedPath = join(__dirname, '..', 'node_modules', '@prisma', 'client', 'index.js');
  const { statSync } = await import('fs');
  const stats = statSync(generatedPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`   Generated client size: ${sizeMB} MB`);
  if (stats.size > 5 * 1024 * 1024) {
    console.log('   ⚠️  Large Prisma client (>5MB)');
  }
} catch (e) {
  console.log('   ℹ️  Could not check Prisma client size');
}

// 6. Recommendations
console.log('\n' + '='.repeat(70));
console.log('\n💡 ROOT CAUSE ANALYSIS:\n');
console.log('High memory at startup is often caused by:');
console.log('  1. Prisma Accelerate extension (if enabled) - 50-100MB');
console.log('  2. Socket.IO / other realtime libs kept as deps but idle');
console.log('  3. All routes eager-loaded - 20-50MB');
console.log('  4. Prisma generated client - 5-20MB');
console.log('  5. Node.js base + dependencies - 100-200MB');
console.log('\n🎯 QUICK FIXES (in order of impact):\n');
console.log('  1. Remove Prisma Accelerate if not using it');
console.log('  2. Drop unused realtime/socket deps if HTTP-only');
console.log('  3. Consider lazy-loading routes');
console.log('  4. Check if all dependencies are necessary');


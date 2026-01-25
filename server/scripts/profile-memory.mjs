#!/usr/bin/env node

/**
 * Memory Profiling Script
 * Analyzes memory usage at different stages of application startup
 */

import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const stages = [
  { name: 'Node.js Base', before: true },
  { name: 'After Imports', after: 'imports' },
  { name: 'After Prisma Init', after: 'prisma' },
  { name: 'After Express Init', after: 'express' },
  { name: 'After Socket.IO Init', after: 'socketio' },
  { name: 'After All Routes', after: 'routes' },
];

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers || 0,
  };
}

console.log('🔍 Memory Profiling Analysis\n');
console.log('='.repeat(60));

// Baseline - just Node.js
const baseline = getMemoryUsage();
console.log(`\n1. Node.js Baseline (empty process):`);
console.log(`   RSS: ${formatBytes(baseline.rss)}`);
console.log(`   Heap: ${formatBytes(baseline.heapUsed)} / ${formatBytes(baseline.heapTotal)}`);

// Check what's loaded
console.log(`\n2. Loaded Modules Analysis:`);
const moduleSizes = [];
try {
  const moduleCache = require.cache || {};
  let totalModuleSize = 0;
  const moduleCounts = {};
  
  Object.keys(moduleCache).forEach(key => {
    const mod = moduleCache[key];
    if (mod && mod.exports) {
      const moduleName = key.split('node_modules/').pop() || key;
      const topLevel = moduleName.split('/')[0];
      moduleCounts[topLevel] = (moduleCounts[topLevel] || 0) + 1;
    }
  });
  
  console.log(`   Total cached modules: ${Object.keys(moduleCache).length}`);
  console.log(`   Top-level packages:`);
  Object.entries(moduleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([pkg, count]) => {
      console.log(`     ${pkg}: ${count} modules`);
    });
} catch (e) {
  console.log('   (Module cache analysis not available)');
}

// Check Prisma specifically
console.log(`\n3. Prisma Client Analysis:`);
try {
  const prismaPath = path.join(process.cwd(), 'node_modules/@prisma/client');
  if (fs.existsSync(prismaPath)) {
    const prismaFiles = getAllFiles(prismaPath);
    const totalSize = prismaFiles.reduce((sum, file) => {
      try {
        const stats = fs.statSync(file);
        return sum + stats.size;
      } catch {
        return sum;
      }
    }, 0);
    console.log(`   Prisma client files: ${prismaFiles.length}`);
    console.log(`   Estimated size: ${formatBytes(totalSize)}`);
    
    // Check generated client
    const generatedPath = path.join(prismaPath, 'index.js');
    if (fs.existsSync(generatedPath)) {
      const stats = fs.statSync(generatedPath);
      console.log(`   Generated client: ${formatBytes(stats.size)}`);
    }
  }
} catch (e) {
  console.log(`   Error: ${e.message}`);
}

// Check node_modules sizes
console.log(`\n4. Large Dependencies:`);
try {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    const packages = fs.readdirSync(nodeModulesPath)
      .filter(pkg => !pkg.startsWith('.'))
      .map(pkg => {
        const pkgPath = path.join(nodeModulesPath, pkg);
        try {
          const stats = fs.statSync(pkgPath);
          if (stats.isDirectory()) {
            const size = getDirSize(pkgPath);
            return { name: pkg, size };
          }
        } catch {}
        return { name: pkg, size: 0 };
      })
      .filter(pkg => pkg.size > 0)
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
    
    console.log(`   Top 10 largest packages:`);
    packages.forEach(({ name, size }) => {
      console.log(`     ${name}: ${formatBytes(size)}`);
    });
  }
} catch (e) {
  console.log(`   Error: ${e.message}`);
}

// Current memory
const current = getMemoryUsage();
console.log(`\n5. Current Memory Usage:`);
console.log(`   RSS: ${formatBytes(current.rss)}`);
console.log(`   Heap Used: ${formatBytes(current.heapUsed)}`);
console.log(`   Heap Total: ${formatBytes(current.heapTotal)}`);
console.log(`   External: ${formatBytes(current.external)}`);
console.log(`   Array Buffers: ${formatBytes(current.arrayBuffers)}`);

// Memory breakdown
console.log(`\n6. Memory Breakdown:`);
const heapOverhead = current.heapTotal - current.heapUsed;
console.log(`   Heap Used: ${formatBytes(current.heapUsed)} (${((current.heapUsed / current.heapTotal) * 100).toFixed(1)}%)`);
console.log(`   Heap Free: ${formatBytes(heapOverhead)} (${((heapOverhead / current.heapTotal) * 100).toFixed(1)}%)`);
console.log(`   External (C++): ${formatBytes(current.external)}`);
console.log(`   Array Buffers: ${formatBytes(current.arrayBuffers)}`);

// V8 heap statistics
if (global.gc) {
  global.gc();
  const afterGC = getMemoryUsage();
  console.log(`\n7. After Garbage Collection:`);
  console.log(`   RSS: ${formatBytes(afterGC.rss)}`);
  console.log(`   Heap Used: ${formatBytes(afterGC.heapUsed)}`);
  console.log(`   Reduction: ${formatBytes(current.heapUsed - afterGC.heapUsed)}`);
} else {
  console.log(`\n7. Garbage Collection:`);
  console.log(`   Run with --expose-gc flag to enable GC analysis`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`\n💡 Recommendations:`);
console.log(`   1. Check if Prisma Accelerate is necessary (adds overhead)`);
console.log(`   2. Consider lazy-loading heavy dependencies`);
console.log(`   3. Check for memory leaks in WebSocket connections`);
console.log(`   4. Review if all routes need to be loaded at startup`);

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        getAllFiles(filePath, fileList);
      } else {
        fileList.push(filePath);
      }
    } catch {}
  });
  return fileList;
}

function getDirSize(dir) {
  let size = 0;
  try {
    const files = getAllFiles(dir);
    files.forEach(file => {
      try {
        const stats = fs.statSync(file);
        size += stats.size;
      } catch {}
    });
  } catch {}
  return size;
}


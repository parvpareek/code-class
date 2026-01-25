import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import compression from 'compression';
import { logger } from './utils/logger';

import authRoutes from './api/auth';
import classRoutes from './api/classes';
import assignmentRoutes from './api/assignments';
import analyticsRoutes from './api/analytics';
import studentRoutes from './api/students';
import announcementRoutes from './api/announcements';
import testRoutes from './api/tests/tests.routes';                                                                                                      
import monitoringRoutes from './api/monitoring/monitoring.routes';
import { dsaProgressRoutes } from './api/dsa-progress';
import adminRoutes from './api/admin/admin.routes';                                                                                                      

// Cron jobs disabled - submission checking should be done on-demand only
// import { initializeScheduledJobs } from './cron';
// WebSocket service removed to save ~50-80MB memory (not currently used)

const app = express();
const server = createServer(app);
const port = process.env.PORT || 4000;

// Set Node.js memory limits and optimize garbage collection
// This helps prevent memory leaks and reduces overall memory usage
if (process.env.NODE_OPTIONS && !process.env.NODE_OPTIONS.includes('--max-old-space-size')) {
  // If not already set, suggest a limit (but don't force it as it may be set externally)
  // For production, consider setting NODE_OPTIONS=--max-old-space-size=512
}

// Add compression middleware (reduces response size by 60-80%)
app.use(compression());

// Request timeout middleware (prevents hanging requests)
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 second timeout
  res.setTimeout(30000);
  next();
});

// Configure CORS to allow requests from frontend
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:8080',
      'http://localhost:3000',
      'https://codeclass.up.railway.app',
      'https://code-class-eight.vercel.app'
    ];
    
    // Add any additional origins from environment variable
    if (process.env.ADDITIONAL_CORS_ORIGINS) {
      allowedOrigins.push(...process.env.ADDITIONAL_CORS_ORIGINS.split(','));
    }
    
    // Only log CORS failures, not every check (reduces log noise)
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Debug middleware to log incoming requests (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
    next();
  });
}

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/classes', classRoutes);
app.use('/api/v1/assignments', assignmentRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/announcements', announcementRoutes);
app.use('/api/v1/tests', testRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/dsa', dsaProgressRoutes);
app.use('/api/v1/admin', adminRoutes);

// Explicit OPTIONS handler for auth endpoints
app.options('/api/v1/auth/*', (req, res) => {
  logger.debug('OPTIONS handler for auth endpoint');
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.status(200).end();
});

// Initialize all scheduled jobs - DISABLED to reduce memory usage
// Submission checking should be triggered manually via API endpoints
// initializeScheduledJobs();

app.get('/', (req, res) => {
  res.send('Hello from the backend! Milestone 1 Core Infrastructure Ready.');
});

// CORS test endpoint
app.get('/api/v1/cors-test', (req, res) => {
  logger.debug('CORS test endpoint hit');
  res.json({ 
    message: 'CORS is working!', 
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    method: req.method
  });
});

// Health check endpoint (no CORS required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    cors_enabled: true
  });
});

server.listen(port, () => {
  logger.log(`🎉 Server running at http://localhost:${port}`);
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.log('SIGTERM signal received: closing HTTP server');
  
  // WebSocket service removed - no cleanup needed
  
  // Close HTTP server
  server.close(() => {
    logger.log('HTTP server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', async () => {
  logger.log('SIGINT signal received: closing HTTP server');
  
  // WebSocket service removed - no cleanup needed
  
  // Close HTTP server
  server.close(() => {
    logger.log('HTTP server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}); 
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables
dotenv.config();

import { initDatabase, queryOne } from './db/db.js';
import { seedDatabase } from './db/seed.js';

import coursesRouter from './routes/courses.js';
import materialsRouter from './routes/materials.js';
import tutorRouter from './routes/tutor.js';
import quizRouter from './routes/quiz.js';
import misconceptionsRouter from './routes/misconceptions.js';
import learningTwinRouter from './routes/learningTwin.js';
import studyTrackerRouter from './routes/studyTracker.js';
import analyticsRouter from './routes/analytics.js';
import studyPlanRouter from './routes/studyPlan.js';
import settingsRouter from './routes/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize SQLite database
initDatabase();

// Auto-seed if no courses exist or demo seeding is explicitly enabled
try {
  const existing = queryOne<any>(`SELECT COUNT(*) as count FROM courses`);
  if (!existing || existing.count === 0 || process.env.ENABLE_DEMO_SEEDING === 'true') {
    seedDatabase().then(() => console.log('[Server] Initial sample learning data verified.'));
  }
} catch (e: any) {
  console.warn('[Server] Seed check warning:', e.message);
}

// Security & Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads serving (for previewing downloaded materials)
const uploadDir = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadDir));

// Clean request logger (without logging API keys or private document content)
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health') {
      console.log(`[HTTP] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health and readiness checks
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Mount modular REST APIs
app.use('/api/courses', coursesRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/tutor', tutorRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/misconceptions', misconceptionsRouter);
app.use('/api/learning-twin', learningTwinRouter);
app.use('/api/study-tracker', studyTrackerRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/study-plan', studyPlanRouter);
app.use('/api/settings', settingsRouter);

// 404 Route Handler
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Centralized error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.name === 'MulterError' || err.message?.includes('Unsupported file type') || err.message?.includes('File too large')) {
    return res.status(400).json({ error: err.message });
  }
  console.error('[Unhandled Server Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error occurred',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 AI StudyMate Backend Server running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   AI Provider: ${process.env.AI_PROVIDER || 'gemini'} (Fallback: active)`);
    console.log(`=======================================================`);
  });
}

export default app;

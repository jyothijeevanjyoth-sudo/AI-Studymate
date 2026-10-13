import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { recordStudySession, getStudyTimeStats } from '../services/studyTrackerService.js';

const router = Router();

// GET /api/study-tracker/stats
router.get('/stats', (req: Request, res: Response) => {
  try {
    const courseId = req.query.courseId as string | undefined;
    const stats = getStudyTimeStats(courseId);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve study time stats', details: err.message });
  }
});

const sessionSchema = z.object({
  courseId: z.string(),
  durationSeconds: z.number().int().min(1).max(86400),
  sessionType: z.enum(['platform', 'offline_logged']).optional(),
  notes: z.string().max(500).optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
});

// POST /api/study-tracker/session
router.post('/session', (req: Request, res: Response) => {
  try {
    const validated = sessionSchema.parse(req.body);
    const session = recordStudySession(validated);
    res.status(201).json(session);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
    } else {
      res.status(500).json({ error: 'Failed to record study session', details: err.message });
    }
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { getDashboardStats, getTopicPerformance } from '../services/analyticsService.js';

const router = Router();

// GET /api/analytics/dashboard
router.get('/dashboard', (req: Request, res: Response) => {
  try {
    const courseId = req.query.courseId as string | undefined;
    const stats = getDashboardStats(courseId);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve dashboard analytics', details: err.message });
  }
});

// GET /api/analytics/topics
router.get('/topics', (req: Request, res: Response) => {
  try {
    const courseId = req.query.courseId as string | undefined;
    const topics = getTopicPerformance(courseId);
    res.json(topics);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve topic performance', details: err.message });
  }
});

export default router;

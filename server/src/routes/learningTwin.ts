import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getLearningTwinProfile, simulateWhatIf } from '../services/learningTwinService.js';

const router = Router();

// GET /api/learning-twin
router.get('/', (req: Request, res: Response) => {
  try {
    const courseId = (req.query.courseId as string) || '';
    if (!courseId) {
      return res.status(400).json({ error: 'courseId query parameter is required' });
    }

    const profile = getLearningTwinProfile(courseId);
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate Learning Twin profile', details: err.message });
  }
});

const simulateSchema = z.object({
  course_id: z.string(),
  planned_study_minutes: z.number().min(5).max(600),
  focus_topics: z.array(z.string()),
  planned_quizzes_count: z.number().min(0).max(10),
});

// POST /api/learning-twin/simulate (What-If Simulator)
router.post('/simulate', (req: Request, res: Response) => {
  try {
    const validated = simulateSchema.parse(req.body);
    const simulation = simulateWhatIf(validated);
    res.json(simulation);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid simulation parameters', details: err.errors });
    } else {
      res.status(500).json({ error: 'Simulation failed', details: err.message });
    }
  }
});

export default router;

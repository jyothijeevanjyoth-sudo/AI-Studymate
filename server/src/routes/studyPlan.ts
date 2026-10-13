import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getActiveStudyPlan,
  generatePersonalizedStudyPlan,
  toggleActivityCompletion,
} from '../services/studyPlanService.js';

const router = Router();

// GET /api/study-plan
router.get('/', (req: Request, res: Response) => {
  try {
    const courseId = (req.query.courseId as string) || '';
    if (!courseId) {
      return res.status(400).json({ error: 'courseId query parameter is required' });
    }

    const plan = getActiveStudyPlan(courseId);
    res.json(plan);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve study plan', details: err.message });
  }
});

const generatePlanSchema = z.object({
  courseId: z.string(),
  dailyGoalMinutes: z.number().min(10).max(480).optional(),
  targetDate: z.string().optional(),
});

// POST /api/study-plan/generate
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const validated = generatePlanSchema.parse(req.body);
    const plan = await generatePersonalizedStudyPlan(validated);
    res.status(201).json(plan);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
    } else {
      res.status(500).json({ error: 'Failed to generate study plan', details: err.message });
    }
  }
});

// PATCH /api/study-plan/activities/:id
router.patch('/activities/:id', (req: Request, res: Response) => {
  try {
    const activityId = req.params.id;
    const completed = req.body.isCompleted !== undefined ? Boolean(req.body.isCompleted) : undefined;
    const success = toggleActivityCompletion(activityId, completed);

    if (!success) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json({ message: 'Activity completion updated' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update activity', details: err.message });
  }
});

export default router;

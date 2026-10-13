import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { listMisconceptions, verifyMisconceptionAnswer } from '../services/misconceptionDetective.js';

const router = Router();

// GET /api/misconceptions
router.get('/', (req: Request, res: Response) => {
  try {
    const courseId = req.query.courseId as string | undefined;
    const onlyUnresolved = req.query.unresolved === 'true';
    const list = listMisconceptions(courseId, onlyUnresolved);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve misconceptions', details: err.message });
  }
});

const verifySchema = z.object({
  answer: z.string().min(1),
});

// POST /api/misconceptions/:id/verify
router.post('/:id/verify', (req: Request, res: Response) => {
  try {
    const misconceptionId = req.params.id;
    const { answer } = verifySchema.parse(req.body);

    const result = verifyMisconceptionAnswer(misconceptionId, answer);
    res.json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid verification answer', details: err.errors });
    } else {
      res.status(500).json({ error: 'Verification check failed', details: err.message });
    }
  }
});

export default router;

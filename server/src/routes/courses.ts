import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { queryAll, queryOne, execute } from '../db/db.js';
import { Course } from '../../../shared/types.js';

const router = Router();

const createCourseSchema = z.object({
  code: z.string().min(2).max(20),
  title: z.string().min(3).max(100),
  description: z.string().min(5).max(500),
});

// GET /api/courses
router.get('/', (req: Request, res: Response) => {
  try {
    const courses = queryAll<any>(`
      SELECT c.*, COUNT(m.id) as material_count
      FROM courses c
      LEFT JOIN learning_materials m ON c.id = m.course_id
      GROUP BY c.id
      ORDER BY c.created_at ASC
    `);

    res.json(courses);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve courses', details: err.message });
  }
});

// POST /api/courses
router.post('/', (req: Request, res: Response) => {
  try {
    const validated = createCourseSchema.parse(req.body);
    const id = `crs_${Date.now()}`;

    execute(
      `INSERT INTO courses (id, code, title, description, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [id, validated.code.toUpperCase(), validated.title, validated.description]
    );

    const created = queryOne<Course>(`SELECT * FROM courses WHERE id = ?`, [id]);
    res.status(201).json(created);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
    } else {
      res.status(500).json({ error: 'Failed to create course', details: err.message });
    }
  }
});

export default router;

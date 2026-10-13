import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { queryAll, queryOne } from '../db/db.js';
import { createQuiz, gradeQuizSubmission } from '../services/quizEngine.js';
import { Difficulty, QuestionType } from '../../../shared/types.js';

const router = Router();

const generateSchema = z.object({
  courseId: z.string(),
  topic: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  questionsCount: z.number().min(1).max(20).optional(),
  questionType: z.enum(['multiple_choice', 'short_answer']).optional(),
});

// POST /api/quiz/generate
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const validated = generateSchema.parse(req.body);
    const quiz = await createQuiz({
      courseId: validated.courseId,
      topic: validated.topic,
      difficulty: validated.difficulty as Difficulty,
      questionsCount: validated.questionsCount,
      questionType: validated.questionType as QuestionType,
    });

    res.status(201).json(quiz);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
    } else {
      res.status(500).json({ error: 'Quiz generation failed', details: err.message });
    }
  }
});

// GET /api/quiz (list quizzes)
router.get('/', (req: Request, res: Response) => {
  try {
    const courseId = req.query.courseId as string | undefined;
    let sql = `
      SELECT q.*, c.title as course_title,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) as attempts_count
      FROM quizzes q
      LEFT JOIN courses c ON q.course_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (courseId) {
      sql += ` AND q.course_id = ?`;
      params.push(courseId);
    }

    sql += ` ORDER BY q.created_at DESC`;
    const quizzes = queryAll(sql, params);
    res.json(quizzes);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve quizzes', details: err.message });
  }
});

// GET /api/quiz/:id (get quiz by ID with questions)
router.get('/:id', (req: Request, res: Response) => {
  try {
    const quizId = req.params.id;
    const quiz = queryOne<any>(`SELECT * FROM quizzes WHERE id = ?`, [quizId]);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const rawQuestions = queryAll<any>(
      `SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY id ASC`,
      [quizId]
    );

    const questions = rawQuestions.map(q => ({
      id: q.id,
      quiz_id: q.quiz_id,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options_json ? JSON.parse(q.options_json) : undefined,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      topic: q.topic,
      difficulty: q.difficulty,
      citation: q.citation_json ? JSON.parse(q.citation_json) : undefined,
    }));

    res.json({
      ...quiz,
      questions,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve quiz details', details: err.message });
  }
});

const submitSchema = z.object({
  answers: z.array(
    z.object({
      question_id: z.string(),
      user_answer: z.string(),
    })
  ),
  timeTakenSeconds: z.number().min(0).optional(),
});

// POST /api/quiz/:id/submit
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const quizId = req.params.id;
    const validated = submitSchema.parse(req.body);

    const result = await gradeQuizSubmission(
      quizId,
      validated.answers,
      validated.timeTakenSeconds || 0
    );

    res.status(200).json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid submission data', details: err.errors });
    } else {
      res.status(500).json({ error: 'Quiz grading failed', details: err.message });
    }
  }
});

// GET /api/quiz/attempts/history
router.get('/attempts/history', (req: Request, res: Response) => {
  try {
    const courseId = req.query.courseId as string | undefined;
    let sql = `
      SELECT qa.*, q.title as quiz_title, q.topic as quiz_topic, q.course_id
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (courseId) {
      sql += ` AND q.course_id = ?`;
      params.push(courseId);
    }

    sql += ` ORDER BY qa.completed_at DESC LIMIT 50`;
    const attempts = queryAll(sql, params);
    res.json(attempts);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve attempts', details: err.message });
  }
});

export default router;

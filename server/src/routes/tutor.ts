import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { queryAll, queryOne, execute, transaction } from '../db/db.js';
import { generateTutorResponse } from '../services/aiService.js';
import { TutorMode, ChatMessage } from '../../../shared/types.js';

const router = Router();

// GET /api/tutor/conversations
router.get('/conversations', (req: Request, res: Response) => {
  try {
    const courseId = req.query.courseId as string | undefined;
    let sql = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count
      FROM conversations c
      WHERE 1=1
    `;
    const params: any[] = [];

    if (courseId) {
      sql += ` AND c.course_id = ?`;
      params.push(courseId);
    }

    sql += ` ORDER BY c.updated_at DESC`;
    const conversations = queryAll(sql, params);
    res.json(conversations);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve conversations', details: err.message });
  }
});

// POST /api/tutor/conversations
router.post('/conversations', (req: Request, res: Response) => {
  try {
    const courseId = req.body.courseId;
    const title = (req.body.title || 'New Study Session').trim();

    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    const convId = `conv_${Date.now()}`;
    execute(
      `INSERT INTO conversations (id, course_id, title, created_at, updated_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
      [convId, courseId, title]
    );

    const conv = queryOne(`SELECT * FROM conversations WHERE id = ?`, [convId]);
    res.status(201).json(conv);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create conversation', details: err.message });
  }
});

// DELETE /api/tutor/conversations/:id
router.delete('/conversations/:id', (req: Request, res: Response) => {
  try {
    const convId = req.params.id;
    execute(`DELETE FROM conversations WHERE id = ?`, [convId]);
    res.json({ message: 'Conversation cleared successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete conversation', details: err.message });
  }
});

// GET /api/tutor/conversations/:id/messages
router.get('/conversations/:id/messages', (req: Request, res: Response) => {
  try {
    const convId = req.params.id;
    const messages = queryAll<any>(
      `SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC`,
      [convId]
    );

    const parsed = messages.map(m => ({
      id: m.id,
      conversation_id: m.conversation_id,
      sender: m.sender,
      content: m.content,
      citations: m.citations_json ? JSON.parse(m.citations_json) : [],
      is_fallback: m.is_fallback === 1,
      tutor_mode: m.tutor_mode,
      created_at: m.created_at,
    }));

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve messages', details: err.message });
  }
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  mode: z.enum(['standard', 'beginner', 'step_by_step', 'analogy', 'practice']).optional(),
  materialIds: z.array(z.string()).optional(),
});

// POST /api/tutor/conversations/:id/messages
router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const convId = req.params.id;
    const conv = queryOne<any>(`SELECT * FROM conversations WHERE id = ?`, [convId]);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const body = sendMessageSchema.parse(req.body);
    const mode = (body.mode || 'standard') as TutorMode;
    const userMsgId = `msg_u_${Date.now()}`;
    const assistantMsgId = `msg_a_${Date.now() + 1}`;

    // 1. Record user message
    execute(
      `INSERT INTO chat_messages (id, conversation_id, sender, content, tutor_mode, created_at)
       VALUES (?, ?, 'user', ?, ?, datetime('now'))`,
      [userMsgId, convId, body.content, mode]
    );

    // 2. Generate grounded response with citations
    const tutorResponse = await generateTutorResponse(body.content, conv.course_id, mode, body.materialIds);

    // 3. Record assistant message
    execute(
      `INSERT INTO chat_messages (id, conversation_id, sender, content, citations_json, is_fallback, tutor_mode, created_at)
       VALUES (?, ?, 'assistant', ?, ?, ?, ?, datetime('now'))`,
      [
        assistantMsgId,
        convId,
        tutorResponse.answer,
        JSON.stringify(tutorResponse.citations),
        tutorResponse.isFallback ? 1 : 0,
        mode,
      ]
    );

    // Update conversation timestamp
    execute(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`, [convId]);

    const resultMessage: ChatMessage = {
      id: assistantMsgId,
      conversation_id: convId,
      sender: 'assistant',
      content: tutorResponse.answer,
      citations: tutorResponse.citations,
      is_fallback: tutorResponse.isFallback,
      tutor_mode: mode,
      created_at: new Date().toISOString(),
    };

    res.status(201).json({
      message: resultMessage,
      provider: tutorResponse.provider,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
    } else {
      res.status(500).json({ error: 'Failed to process tutor message', details: err.message });
    }
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { queryOne } from '../db/db.js';
import { seedDatabase } from '../db/seed.js';

const router = Router();

// GET /api/settings and /api/settings/status
const getStatusHandler = (req: Request, res: Response) => {
  try {
    const aiProvider = process.env.AI_PROVIDER || 'gemini';
    const geminiKey = process.env.GEMINI_API_KEY || '';
    const openAiKey = process.env.OPENAI_API_KEY || '';

    const hasAiKey = (aiProvider === 'gemini' && geminiKey.trim().length > 5) ||
                     (aiProvider === 'openai' && openAiKey.trim().length > 5);

    const matCount = queryOne<any>(`SELECT COUNT(*) as count FROM learning_materials`)?.count || 0;
    const chunkCount = queryOne<any>(`SELECT COUNT(*) as count FROM document_chunks`)?.count || 0;

    res.json({
      ai_provider: aiProvider,
      ai_configured: hasAiKey,
      stt_provider: process.env.STT_PROVIDER || 'mock',
      stt_configured: hasAiKey || process.env.STT_PROVIDER === 'mock',
      database_ready: true,
      total_materials: matCount,
      total_chunks: chunkCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve system status', details: err.message });
  }
};

router.get('/', getStatusHandler);
router.get('/status', getStatusHandler);

// POST /api/settings/seed
router.post('/seed', async (req: Request, res: Response) => {
  try {
    const result = await seedDatabase();
    res.json({
      message: 'Demo dataset seeded successfully',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Seeding failed', details: err.message });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { queryAll, queryOne, execute, transaction } from '../db/db.js';
import { extractDocument } from '../services/documentProcessor.js';
import { chunkDocument } from '../services/chunker.js';
import { LearningMaterial, FileType } from '../../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Ensure upload directory exists safely
const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage with path-traversal prevention
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename to prevent directory traversal
    const safeBaseName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    cb(null, `${uniqueSuffix}_${safeBaseName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10)) * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.pptx', '.txt', '.md', '.vtt', '.srt', '.mp4', '.webm', '.mov'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Supported: PDF, PPTX, TXT, MD, VTT, SRT, Video.`));
    }
  },
});

// GET /api/materials (list materials with optional courseId filter)
router.get('/', (req: Request, res: Response) => {
  try {
    const courseId = req.query.courseId as string | undefined;
    let sql = `
      SELECT m.*, c.title as course_title,
        (SELECT COUNT(*) FROM document_chunks WHERE material_id = m.id) as chunk_count
      FROM learning_materials m
      LEFT JOIN courses c ON m.course_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (courseId) {
      sql += ` AND m.course_id = ?`;
      params.push(courseId);
    }

    sql += ` ORDER BY m.created_at DESC`;
    const materials = queryAll<LearningMaterial>(sql, params);
    res.json(materials);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch materials', details: err.message });
  }
});

// POST /api/materials/upload
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file was uploaded' });
  }

  const courseId = req.body.courseId;
  if (!courseId) {
    // Remove uploaded file if courseId is missing
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'courseId is required' });
  }

  const course = queryOne(`SELECT id FROM courses WHERE id = ?`, [courseId]);
  if (!course) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: `Course "${courseId}" does not exist` });
  }

  const originalName = req.file.originalname;
  const ext = path.extname(originalName).toLowerCase();
  const fileType: FileType =
    ext === '.pdf' ? 'pdf' :
    ext === '.pptx' ? 'pptx' :
    (ext === '.vtt' || ext === '.srt') ? 'transcript' :
    (ext === '.mp4' || ext === '.webm' || ext === '.mov') ? 'video' : 'txt';

  const title = (req.body.title || path.basename(originalName, ext)).trim();
  const materialId = `mat_${Date.now()}`;

  try {
    // 1. Process and extract text
    const extracted = await extractDocument(req.file.path, originalName, title);

    // 2. Chunk text with metadata
    const chunks = chunkDocument(extracted, {
      materialId,
      courseId,
      materialTitle: title,
    });

    // 3. Save into SQLite via transaction
    transaction(() => {
      execute(
        `INSERT INTO learning_materials (id, course_id, title, file_name, file_type, file_path, file_size, processing_status, total_units, unit_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, datetime('now'), datetime('now'))`,
        [
          materialId,
          courseId,
          title,
          originalName,
          fileType,
          req.file!.path,
          req.file!.size,
          extracted.totalUnits,
          extracted.unitType,
        ]
      );

      for (const chk of chunks) {
        execute(
          `INSERT INTO document_chunks (id, material_id, course_id, chunk_index, content, page_num, slide_num, timestamp_val, unit_label, topic, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            chk.id,
            materialId,
            courseId,
            chk.chunk_index,
            chk.content,
            chk.page_num || null,
            chk.slide_num || null,
            chk.timestamp_val || null,
            chk.unit_label,
            chk.topic,
          ]
        );
      }
    });

    const saved = queryOne<LearningMaterial>(
      `SELECT m.*, (SELECT COUNT(*) FROM document_chunks WHERE material_id = m.id) as chunk_count
       FROM learning_materials m WHERE id = ?`,
      [materialId]
    );

    res.status(201).json({
      message: 'Material uploaded and processed successfully',
      material: saved,
      extracted_units: extracted.totalUnits,
      chunks_generated: chunks.length,
    });
  } catch (err: any) {
    console.error('[Upload Error]', err);
    // Mark as error in database if inserted, or return failure
    res.status(500).json({
      error: 'Failed to process educational document',
      details: err.message,
    });
  }
});

// GET /api/materials/:id/preview
router.get('/:id/preview', (req: Request, res: Response) => {
  try {
    const materialId = req.params.id;
    const material = queryOne<LearningMaterial>(
      `SELECT * FROM learning_materials WHERE id = ?`,
      [materialId]
    );

    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const chunks = queryAll<any>(
      `SELECT id, chunk_index, content, page_num, slide_num, timestamp_val, unit_label, topic
       FROM document_chunks
       WHERE material_id = ?
       ORDER BY chunk_index ASC`,
      [materialId]
    );

    res.json({
      material,
      chunks,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to preview material', details: err.message });
  }
});

// DELETE /api/materials/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const materialId = req.params.id;
    const material = queryOne<LearningMaterial>(`SELECT * FROM learning_materials WHERE id = ?`, [materialId]);
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }

    // Remove file from disk safely
    if (fs.existsSync(material.file_path)) {
      try {
        fs.unlinkSync(material.file_path);
      } catch (e) {
        console.warn('Could not unlink physical file:', e);
      }
    }

    // Delete DB records
    execute(`DELETE FROM learning_materials WHERE id = ?`, [materialId]);

    res.json({ message: 'Material and all indexed chunks deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete material', details: err.message });
  }
});

// POST /api/materials/:id/reprocess
router.post('/:id/reprocess', async (req: Request, res: Response) => {
  try {
    const materialId = req.params.id;
    const material = queryOne<LearningMaterial>(`SELECT * FROM learning_materials WHERE id = ?`, [materialId]);
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }

    if (!fs.existsSync(material.file_path)) {
      return res.status(400).json({ error: 'Physical file no longer exists on disk to reprocess' });
    }

    const extracted = await extractDocument(material.file_path, material.file_name, material.title);
    const chunks = chunkDocument(extracted, {
      materialId: material.id,
      courseId: material.course_id,
      materialTitle: material.title,
    });

    transaction(() => {
      execute(`DELETE FROM document_chunks WHERE material_id = ?`, [material.id]);

      execute(
        `UPDATE learning_materials 
         SET total_units = ?, unit_type = ?, processing_status = 'completed', updated_at = datetime('now')
         WHERE id = ?`,
        [extracted.totalUnits, extracted.unitType, material.id]
      );

      for (const chk of chunks) {
        execute(
          `INSERT INTO document_chunks (id, material_id, course_id, chunk_index, content, page_num, slide_num, timestamp_val, unit_label, topic, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            chk.id,
            material.id,
            material.course_id,
            chk.chunk_index,
            chk.content,
            chk.page_num || null,
            chk.slide_num || null,
            chk.timestamp_val || null,
            chk.unit_label,
            chk.topic,
          ]
        );
      }
    });

    res.json({
      message: 'Material reprocessed successfully',
      chunks_count: chunks.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Reprocessing failed', details: err.message });
  }
});

export default router;

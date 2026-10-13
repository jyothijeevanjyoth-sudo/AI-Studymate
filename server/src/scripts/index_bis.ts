import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processPdf } from '../services/documentProcessor.js';
import { chunkDocument } from '../services/chunker.js';
import { db, execute, queryOne } from '../db/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function indexBisModule(): Promise<number> {
  const uploadCandidates = [
    path.resolve(process.cwd(), 'uploads/1791907969331_hdtfuz_BIS701-module-2-pdf.pdf'),
    path.resolve(__dirname, '../../uploads/1791907969331_hdtfuz_BIS701-module-2-pdf.pdf'),
  ];

  const filePath = uploadCandidates.find(p => fs.existsSync(p));
  if (!filePath) {
    console.warn('[BIS701 Indexer] File not found in uploads directory');
    return 0;
  }

  const matId = 'mat_1791907970150';
  const courseId = 'crs_cs101_java';

  // Ensure material record exists
  execute(
    `INSERT INTO learning_materials (id, course_id, title, file_name, file_type, file_path, file_size, processing_status, total_units, unit_type, created_at, updated_at)
     VALUES (?, ?, 'BIS701-module-2-pdf', 'BIS701-module-2-pdf.pdf', 'pdf', 'uploads/1791907969331_hdtfuz_BIS701-module-2-pdf.pdf', 1324360, 'completed', 58, 'page', datetime('now'), datetime('now'))
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, processing_status = 'completed'`,
    [matId, courseId]
  );

  // Check if chunks already exist
  const existing = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM document_chunks WHERE material_id = ?`,
    [matId]
  );

  if (existing && existing.count > 0) {
    console.log(`[BIS701 Indexer] Already indexed (${existing.count} chunks)`);
    return existing.count;
  }

  console.log(`[BIS701 Indexer] Indexing ${filePath}...`);
  const doc = await processPdf(filePath, 'BIS701-module-2-pdf');
  const chunks = chunkDocument(doc, {
    materialId: matId,
    courseId,
    materialTitle: 'BIS701-module-2-pdf',
  });

  db.exec('BEGIN TRANSACTION');
  try {
    for (const c of chunks) {
      execute(
        `INSERT INTO document_chunks (id, material_id, course_id, chunk_index, content, page_num, unit_label, topic, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [c.id, c.material_id, c.course_id, c.chunk_index, c.content, c.page_num || null, c.unit_label, c.topic]
      );
    }
    db.exec('COMMIT');
    console.log(`[BIS701 Indexer] Successfully indexed ${chunks.length} chunks!`);
    return chunks.length;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('index_bis.ts')) {
  indexBisModule()
    .then(count => console.log(`Done! Total chunks: ${count}`))
    .catch(console.error);
}

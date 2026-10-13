import { queryAll } from '../db/db.js';
import { Citation, FileType } from '../../../shared/types.js';

export interface SearchOptions {
  courseId?: string;
  materialIds?: string[];
  topic?: string;
  limit?: number;
  minScore?: number;
}

interface StoredChunkRow {
  id: string;
  material_id: string;
  course_id: string;
  chunk_index: number;
  content: string;
  page_num: number | null;
  slide_num: number | null;
  timestamp_val: string | null;
  unit_label: string;
  topic: string;
  material_title: string;
  file_type: string;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'because', 'as', 'what',
  'which', 'this', 'that', 'these', 'those', 'then', 'just', 'so', 'than',
  'such', 'both', 'through', 'about', 'for', 'is', 'of', 'while', 'during',
  'to', 'from', 'in', 'out', 'on', 'off', 'again', 'further', 'then', 'once',
  'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each',
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'don',
  'should', 'now', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
  'she', 'her', 'it', 'its', 'they', 'them', 'their', 'explain', 'tell', 'describe'
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Extract a high-relevance snippet from the chunk matching query keywords
 */
function extractSnippet(content: string, queryTokens: string[], maxLength = 260): string {
  const lower = content.toLowerCase();
  let bestIdx = -1;
  let maxHits = 0;

  // Find 150-char window with most keyword hits
  const windowSize = 150;
  for (let i = 0; i < content.length; i += 60) {
    const sub = lower.slice(i, i + windowSize);
    let hits = 0;
    for (const token of queryTokens) {
      if (sub.includes(token)) hits++;
    }
    if (hits > maxHits) {
      maxHits = hits;
      bestIdx = i;
    }
  }

  if (bestIdx === -1 || maxHits === 0) {
    return content.slice(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  const start = Math.max(0, bestIdx - 30);
  const end = Math.min(content.length, start + maxLength);
  let snippet = content.slice(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  return snippet;
}

/**
 * Retrieve chunks using BM25 / TF-IDF keyword scoring with query phrase boosting
 */
export async function retrieveRelevantChunks(
  query: string,
  options: SearchOptions = {}
): Promise<Array<{
  chunkId: string;
  materialId: string;
  courseId: string;
  content: string;
  citation: Citation;
  score: number;
}>> {
  const limit = options.limit || 5;

  let sql = `
    SELECT c.*, m.title as material_title, m.file_type
    FROM document_chunks c
    JOIN learning_materials m ON c.material_id = m.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (options.courseId) {
    sql += ` AND c.course_id = ?`;
    params.push(options.courseId);
  }

  if (options.materialIds && options.materialIds.length > 0) {
    const placeholders = options.materialIds.map(() => '?').join(',');
    sql += ` AND c.material_id IN (${placeholders})`;
    params.push(...options.materialIds);
  }

  if (options.topic) {
    sql += ` AND c.topic = ?`;
    params.push(options.topic);
  }

  const rows = queryAll<StoredChunkRow>(sql, params);
  if (rows.length === 0) {
    return [];
  }

  const queryTokens = tokenize(query);
  const lowerQuery = query.toLowerCase().trim();

  // If query is very short or generic, token match might be empty
  if (queryTokens.length === 0) {
    // Return most recent chunks
    return rows.slice(0, limit).map(row => ({
      chunkId: row.id,
      materialId: row.material_id,
      courseId: row.course_id,
      content: row.content,
      score: 0.5,
      citation: {
        material_id: row.material_id,
        material_title: row.material_title,
        file_type: row.file_type as FileType,
        page: row.page_num || undefined,
        slide: row.slide_num || undefined,
        timestamp: row.timestamp_val || undefined,
        unit_label: row.unit_label,
        snippet: extractSnippet(row.content, queryTokens),
        relevance_score: 0.5,
      },
    }));
  }

  // Calculate Document Frequency (DF) for IDF
  const docCount = rows.length;
  const df: Record<string, number> = {};
  for (const token of queryTokens) {
    df[token] = 0;
    for (const row of rows) {
      if (row.content.toLowerCase().includes(token) || row.topic.toLowerCase().includes(token)) {
        df[token]++;
      }
    }
  }

  // Score each chunk
  const scored = rows.map(row => {
    const textLower = row.content.toLowerCase();
    const topicLower = row.topic.toLowerCase();
    let score = 0;

    // Exact phrase match bonus
    if (lowerQuery.length > 4 && textLower.includes(lowerQuery)) {
      score += 5.0;
    }

    // Token frequency and BM25-like weighting
    for (const token of queryTokens) {
      const termCount = (textLower.match(new RegExp(`\\b${token}\\b`, 'g')) || []).length;
      const topicMatch = topicLower.includes(token) ? 2.0 : 0;
      const idf = Math.log(1 + (docCount - (df[token] || 0) + 0.5) / ((df[token] || 0) + 0.5));

      if (termCount > 0) {
        // TF term saturation
        const tf = (termCount * 2.2) / (termCount + 1.2);
        score += tf * (idf > 0 ? idf : 0.5);
      }
      score += topicMatch;
    }

    // Small bonus if chunk belongs to a specified topic
    if (options.topic && row.topic.toLowerCase() === options.topic.toLowerCase()) {
      score += 2.0;
    }

    return {
      chunk: row,
      score,
    };
  });

  // Filter and sort by score descending
  const threshold = options.minScore !== undefined ? options.minScore : 0.1;
  const filtered = scored
    .filter(item => item.score > threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return filtered.map(({ chunk, score }) => {
    const normScore = Math.min(1.0, Math.round((score / (queryTokens.length * 4 + 2)) * 100) / 100);
    return {
      chunkId: chunk.id,
      materialId: chunk.material_id,
      courseId: chunk.course_id,
      content: chunk.content,
      score: normScore,
      citation: {
        material_id: chunk.material_id,
        material_title: chunk.material_title,
        file_type: chunk.file_type as FileType,
        page: chunk.page_num || undefined,
        slide: chunk.slide_num || undefined,
        timestamp: chunk.timestamp_val || undefined,
        unit_label: chunk.unit_label,
        snippet: extractSnippet(chunk.content, queryTokens),
        relevance_score: normScore,
      },
    };
  });
}

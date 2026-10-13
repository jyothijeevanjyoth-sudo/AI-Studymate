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
 * Extract a high-relevance snippet from the chunk matching query keywords or key phrase
 */
function extractSnippet(content: string, queryTokens: string[], cleanedPhrase = '', maxLength = 260): string {
  const lower = content.toLowerCase();

  // If the substantive phrase exists, center the snippet directly around it
  if (cleanedPhrase.length > 3 && lower.includes(cleanedPhrase)) {
    const phraseIdx = lower.indexOf(cleanedPhrase);
    const start = Math.max(0, phraseIdx - 15);
    const end = Math.min(content.length, start + maxLength);
    let snip = content.slice(start, end).trim();
    if (start > 0) snip = '...' + snip;
    if (end < content.length) snip = snip + '...';
    return snip;
  }

  let bestIdx = -1;
  let maxHits = 0;

  // Find 150-char window with most keyword hits
  const windowSize = 150;
  for (let i = 0; i < content.length; i += 50) {
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

  const start = Math.max(0, bestIdx - 20);
  const end = Math.min(content.length, start + maxLength);
  let snippet = content.slice(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  return snippet;
}

export function cleanQueryPhrase(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/^(?:can\s+you\s+)?(?:please\s+)?(?:explain|describe|define|discuss|clarify|detail)\s+(?:me\s+)?(?:about\s+)?/i, '')
    .replace(/^(?:what\s+(?:is|are)|how\s+(?:does|do|to)|tell\s+me\s+about)\s+/i, '')
    .trim();
}

/**
 * Detect if a chunk is predominantly a course outline, syllabus, or table of contents
 */
export function isOutlineOrTOC(text: string): boolean {
  const lower = text.toLowerCase();
  if (/table of contents|syllabus|course outline|curriculum|module outline|module syllabus/i.test(lower)) {
    return true;
  }
  // Detect comma-separated topic list sequences without instructional prose
  const commaFragments = text.split(',').map(s => s.trim().split(/\s+/).length);
  const shortFragmentCount = commaFragments.filter(len => len >= 1 && len <= 4).length;
  if (shortFragmentCount >= 5 && (shortFragmentCount / commaFragments.length > 0.6)) {
    return true;
  }
  if (/introduction to [^:]+:\s*([a-z\s]+,){3,}/i.test(lower)) {
    return true;
  }
  return false;
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
  const cleanedPhrase = cleanQueryPhrase(query);

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

    // Full raw query exact match bonus
    if (lowerQuery.length > 4 && textLower.includes(lowerQuery)) {
      score += 5.0;
    }

    // Exact substantive topical phrase bonus (e.g. "processing data with hadoop")
    if (cleanedPhrase.length > 4 && textLower.includes(cleanedPhrase)) {
      score += 7.0;
    }

    // Sub-phrase n-gram match bonus (e.g. "processing data", "data with hadoop")
    const subWords = cleanedPhrase.split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
    if (subWords.length >= 2) {
      for (let i = 0; i < subWords.length - 1; i++) {
        const bigram = `${subWords[i]} ${subWords[i + 1]}`;
        if (textLower.includes(bigram)) {
          score += 2.0;
        }
      }
    }

    // Token frequency and BM25-like weighting
    for (const token of queryTokens) {
      const termCount = (textLower.match(new RegExp(`\\b${token}\\b`, 'g')) || []).length;
      const topicMatch = topicLower.includes(token) ? 2.0 : 0;
      const idf = Math.log(1 + (docCount - (df[token] || 0) + 0.5) / ((df[token] || 0) + 0.5));

      if (termCount > 0) {
        // TF term saturation
        const tf = (termCount * 2.2) / (termCount + 1.2);
        score += tf * (idf > 0 ? idf : 1.2);
      }
      score += topicMatch;
    }

    // Bonus for definition, mechanism, and explanatory indicators
    if (/\b(?:is an?|refers to|represents|occurs|defined as|helps (?:you|to)|designed for|framework|steps|workflow|executes)\b/i.test(textLower)) {
      score += 1.2;
    }

    // Significant penalty for outline / table of contents / syllabus chunks
    if (isOutlineOrTOC(row.content)) {
      score *= 0.15;
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
        snippet: extractSnippet(chunk.content, queryTokens, cleanedPhrase),
        relevance_score: normScore,
      },
    };
  });
}

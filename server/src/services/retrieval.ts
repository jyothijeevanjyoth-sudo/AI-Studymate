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

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

const KNOWN_DOMAIN_KEYWORDS = [
  'replication', 'replicate', 'replicas', 'heartbeat', 'heartbeats',
  'datanode', 'datanodes', 'namenode', 'namenodes', 'mapreduce',
  'mapper', 'reducer', 'partitioner', 'combiner', 'yarn',
  'polymorphism', 'inheritance', 'overloading', 'overriding',
  'encapsulation', 'generics', 'pipeline', 'placement'
];

export function tokenize(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);

  return raw.map(tok => {
    if (STOPWORDS.has(tok)) return '';
    if (levenshtein(tok, 'explain') <= 1) return '';
    if (levenshtein(tok, 'describe') <= 1) return '';

    for (const kw of KNOWN_DOMAIN_KEYWORDS) {
      if (levenshtein(tok, kw) <= 2 && Math.abs(tok.length - kw.length) <= 2) {
        return kw;
      }
    }
    return tok;
  }).filter(t => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Morphological stemmer for key domain tokens
 */
export function stemToken(word: string): string {
  let w = word.toLowerCase().trim();
  if (w.startsWith('re-')) w = w.slice(3);
  if (w.startsWith('replic')) return 'replic';
  if (w.startsWith('process')) return 'process';
  if (w.startsWith('stor')) return 'stor';
  if (w.startsWith('manag')) return 'manag';
  if (w.startsWith('fail')) return 'fail';
  if (w.startsWith('heartbeat')) return 'heartbeat';
  if (w.startsWith('pipeline')) return 'pipeline';
  if (w.startsWith('overload')) return 'overload';
  if (w.startsWith('overrid')) return 'overrid';
  if (w.startsWith('polymorph')) return 'polymorph';
  if (w.startsWith('inherit')) return 'inherit';
  if (w.startsWith('encapsul')) return 'encapsul';
  if (w.endsWith('ation') || w.endsWith('ations')) return w.replace(/ations?$/, '');
  if (w.endsWith('ing')) return w.replace(/ing$/, '');
  if (w.endsWith('ed')) return w.replace(/ed$/, '');
  if (w.endsWith('es') && !w.endsWith('des') && !w.endsWith('ses')) return w.replace(/es$/, '');
  if (w.endsWith('s') && !w.endsWith('ss')) return w.replace(/s$/, '');
  return w;
}

/**
 * Clean document artifacts, watermarks, spacing, and hyphenations
 */
export function cleanSourceText(raw: string): string {
  let cleaned = raw
    // Remove repeated page headers, footers, and site watermarks
    .replace(/\b(?:Vtucircle\.com|com)\s+Page\s+\d+\b/gi, '')
    .replace(/\bBigDataAnalytics-BIS701-Module\d+\b/gi, '')
    .replace(/\bPage\s+\d+(?:\s+of\s+\d+)?\b/gi, '')
    // Repair broken hyphenations
    .replace(/(\w+)\s*-\s*(\w+)/g, (_match, p1, p2) => {
      const combined = `${p1}${p2}`.toLowerCase();
      if (['output', 'reexecuting', 'cannot', 'into', 'without', 'metadata', 'executing', 'processing'].includes(combined)) {
        return `${p1}${p2}`;
      }
      return `${p1}-${p2}`;
    })
    // Normalize spaces before punctuation
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/([(\[{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    // Normalize multiple whitespace characters
    .replace(/\s+/g, ' ')
    .trim();

  // Deduplicate repeated consecutive heading phrases (e.g. "Replica Placement Strategy Hadoop Default Replica Placement Strategy:")
  cleaned = cleaned.replace(/Replica\s+Placement\s+Strategy\s+Hadoop\s+Default\s+Replica\s+Placement\s+Strategy:\s*/gi, 'Hadoop Default Replica Placement Strategy: ');

  // Trim initial overlap fragment if followed by a major section heading within first 180 chars
  const majorHeadingIdx = cleaned.search(/\b(?:Hadoop\s+Default\s+Replica\s+Placement\s+Strategy|PROCESSING\s+DATA\s+WITH\s+HADOOP)\b/i);
  if (majorHeadingIdx > 0 && majorHeadingIdx < 180) {
    cleaned = cleaned.slice(majorHeadingIdx);
  }

  // Only trim a short overlap fragment (< 85 chars) that begins mid-sentence with a lowercase letter before an uppercase section heading
  const headingMatch = cleaned.match(/^[a-z][^.!?]{3,85}[.!?]\s+([A-Z\s]{4,35}(?:WITH|AND|IN|FOR|OF)?\s+[A-Z\s]{2,35})\s+([A-Z][a-z].*)$/);
  if (headingMatch && headingMatch[1] && headingMatch[2]) {
    cleaned = `${headingMatch[1]}: ${headingMatch[2]}`;
  } else {
    // If heading is attached directly to text without punctuation
    cleaned = cleaned.replace(/^([A-Z\s]{4,35})\s+([A-Z][a-z])/, '$1: $2');
  }

  // If chunk begins mid-sentence with a lowercase fragment before a period (e.g. "a possibility of hardware failure. And when...")
  const fragmentMatch = cleaned.match(/^[a-z][^.!?]{3,90}[.!?]\s+([A-Z].*)$/);
  if (fragmentMatch && fragmentMatch[1] && fragmentMatch[1].length > 40) {
    cleaned = fragmentMatch[1];
  }

  // Strip trailing incomplete clauses ending with dangling words without terminal punctuation
  cleaned = cleaned.replace(/\s+[^.!?]+(?<=(?:\b(?:is|are|was|were|a|an|the|to|in|of|for|with|and|or|by|as|that|from|on|at|then|so)))\s*$/i, '');

  return cleaned;
}

/**
 * Extract a high-relevance snippet from the chunk matching query keywords or key phrase
 * Always snaps to complete sentence boundaries to prevent mid-word/mid-sentence truncation.
 */
export function extractSnippet(
  rawContent: string,
  queryTokens: string[],
  cleanedPhrase = '',
  maxLength = 340
): string {
  const content = cleanSourceText(rawContent);
  if (!content) return '';
  if (content.length <= maxLength) return content;

  const phraseTarget = cleanedPhrase.replace(/[?!.]+$/, '').trim().toLowerCase();

  // Split into clean candidate sentences
  const rawSentences = content
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (rawSentences.length === 0) return content.slice(0, maxLength);

  let targetSentIdx = -1;
  // If phraseTarget exists, search for best sentence
  if (phraseTarget.length > 3) {
    // 1. Prefer sentence starting with phrase or defining phrase
    targetSentIdx = rawSentences.findIndex(s => {
      const sLow = s.toLowerCase();
      return (
        new RegExp(`^${phraseTarget}`, 'i').test(sLow) ||
        sLow.includes(`${phraseTarget}:`) ||
        sLow.includes(`is ${phraseTarget}`)
      );
    });
    // 2. Otherwise any sentence containing phraseTarget
    if (targetSentIdx === -1) {
      targetSentIdx = rawSentences.findIndex(s => s.toLowerCase().includes(phraseTarget));
    }
  }

  // If no phrase match, use query token match
  if (targetSentIdx === -1 && queryTokens.length > 0) {
    let maxHits = 0;
    rawSentences.forEach((s, idx) => {
      const sLow = s.toLowerCase();
      let hits = 0;
      for (const tok of queryTokens) {
        const stem = stemToken(tok);
        if (sLow.includes(tok) || (stem.length >= 4 && sLow.includes(stem))) hits++;
      }
      if (hits > maxHits) {
        maxHits = hits;
        targetSentIdx = idx;
      }
    });
  }

  if (targetSentIdx === -1) targetSentIdx = 0;

  // Build snippet by accumulating complete sentences
  let accumulated = '';
  let curIdx = targetSentIdx;

  while (curIdx < rawSentences.length) {
    const nextSent = rawSentences[curIdx];
    // Don't add incomplete trailing fragment (e.g. "Once replica locations have been set, a pipeline is")
    if (/(?:is|are|was|were|a|an|the|to|in|of|for|with|and|or|by|as|that|from|on|at|then|so)\s*$/i.test(nextSent)) {
      break;
    }
    if (accumulated.length > 0 && accumulated.length + nextSent.length > maxLength) {
      break;
    }
    if (accumulated.length > 0) accumulated += ' ';
    accumulated += nextSent;
    curIdx++;
  }

  if (!accumulated) {
    accumulated = rawSentences[targetSentIdx] || content.slice(0, maxLength);
  }

  if (targetSentIdx > 0 && !accumulated.startsWith('...')) {
    accumulated = '...' + accumulated.replace(/^[.\s]+/, '');
  }
  if (curIdx < rawSentences.length && !accumulated.endsWith('...')) {
    accumulated = accumulated.replace(/[.\s]+$/, '') + '...';
  }

  return accumulated;
}

export function cleanQueryPhrase(query: string): string {
  let cleaned = query
    .toLowerCase()
    .trim()
    .replace(/^(?:can\s+you\s+)?(?:please\s+)?(?:explain|explai|describe|define|discuss|clarify|detail)\s+(?:me\s+)?(?:about\s+)?/i, '')
    .replace(/^(?:what\s+(?:is|are)|how\s+(?:does|do|to)|tell\s+me\s+about)\s+/i, '')
    .trim();

  // Normalize words in phrase if within edit distance
  const words = cleaned.split(/\s+/).map(w => {
    const rawWord = w.replace(/[?!.]+$/, '');
    for (const kw of KNOWN_DOMAIN_KEYWORDS) {
      if (levenshtein(rawWord, kw) <= 2 && Math.abs(rawWord.length - kw.length) <= 2) {
        return w.replace(rawWord, kw);
      }
    }
    return w;
  });

  return words.join(' ');
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
  const targetPhrase = cleanedPhrase.replace(/[?!.]+$/, '').trim().toLowerCase();
  const queryStems = queryTokens.map(t => stemToken(t));

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
        snippet: extractSnippet(row.content, queryTokens, targetPhrase),
        relevance_score: 0.5,
      },
    }));
  }

  // Calculate Document Frequency (DF) for IDF with stemming
  const docCount = rows.length;
  const df: Record<string, number> = {};
  for (const token of queryTokens) {
    df[token] = 0;
    const stem = stemToken(token);
    const regex = stem.length >= 4
      ? new RegExp(`\\b(?:re-?)?${stem}\\w*`, 'i')
      : new RegExp(`\\b${token}\\b`, 'i');

    for (const row of rows) {
      if (regex.test(row.content) || (stem.length >= 4 && row.topic.toLowerCase().includes(stem)) || row.topic.toLowerCase().includes(token)) {
        df[token]++;
      }
    }
  }

  // Identify distinctive (non-ubiquitous) tokens
  const distinctiveTokens = queryTokens.filter(t => (df[t] || 0) < docCount * 0.35);

  // Score each chunk
  const scored = rows.map(row => {
    const cleanedText = cleanSourceText(row.content);
    const textLower = cleanedText.toLowerCase();
    const topicLower = row.topic.toLowerCase();
    let score = 0;

    // 1. Full raw query exact match bonus
    if (lowerQuery.length > 4 && textLower.includes(lowerQuery)) {
      score += 6.0;
    }

    // 2. Exact substantive topical phrase bonus (e.g. "processing data with hadoop", "data replication")
    if (targetPhrase.length > 4 && textLower.includes(targetPhrase)) {
      score += 10.0;
    }

    // 3. Sub-phrase n-gram match bonus (e.g. "processing data", "data with hadoop")
    const subWords = targetPhrase.split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
    if (subWords.length >= 2) {
      for (let i = 0; i < subWords.length - 1; i++) {
        const bigram = `${subWords[i]} ${subWords[i + 1]}`;
        if (textLower.includes(bigram)) {
          score += 3.0;
        }
      }
    }

    // 4. Token frequency BM25 with stemming & ubiquitous term dampening
    let matchingTokens = 0;
    let matchesDistinctive = false;

    for (const token of queryTokens) {
      const stem = stemToken(token);
      const regex = stem.length >= 4
        ? new RegExp(`\\b(?:re-?)?${stem}\\w*`, 'gi')
        : new RegExp(`\\b${token}\\b`, 'gi');

      const matches = textLower.match(regex) || [];
      const termCount = matches.length;

      if (termCount > 0) {
        matchingTokens++;
        if (distinctiveTokens.includes(token)) {
          matchesDistinctive = true;
        }
        const docFreq = df[token] || 1;
        const isUbiquitous = docFreq > docCount * 0.35;
        const idf = Math.log(1 + (docCount - docFreq + 0.5) / (docFreq + 0.5));
        const effectiveIdf = isUbiquitous ? Math.max(0.3, idf * 0.35) : Math.max(0.9, idf);
        const tf = (termCount * 2.2) / (termCount + 1.2);
        score += tf * effectiveIdf;
      }

      if (topicLower.includes(token) || (stem.length >= 4 && topicLower.includes(stem))) {
        score += 2.0;
      }
    }

    // Strict topic gating: if query has distinctive key terms, penalize chunks that completely lack them
    if (distinctiveTokens.length > 0 && !matchesDistinctive) {
      score *= 0.15;
    }

    // If query has 3+ tokens, require matching at least 2 distinct tokens, unless it matches a distinctive key term
    if (queryTokens.length >= 3 && matchingTokens < 2 && !matchesDistinctive) {
      score *= 0.2;
    }

    // 5. Co-occurrence Proximity Bonus: query terms in same sentence
    if (queryTokens.length >= 2) {
      const sentences = textLower.split(/[.!?]+/);
      for (const sent of sentences) {
        let sentHits = 0;
        for (const token of queryTokens) {
          const stem = stemToken(token);
          if (sent.includes(token) || (stem.length >= 4 && sent.includes(stem))) sentHits++;
        }
        if (sentHits >= 2) {
          score += 2.5;
          break;
        }
      }
    }

    // 6. Section Heading Bonus: chunk begins with or highlights the topic
    if (targetPhrase.length > 4) {
      const firstLine = textLower.slice(0, 160);
      if (firstLine.includes(targetPhrase)) {
        score += 5.0;
      }
    }

    // 7. Bonus for definition, mechanism, and explanatory indicators
    if (/\b(?:is an?|refers to|represents|occurs|defined as|helps (?:you|to)|designed for|workflow|architecture|executes|step-by-step|connotes|strategy|mechanism)\b/i.test(textLower)) {
      score += 1.5;
    }

    // Bonus for replica placement strategy on replication queries
    if (queryStems.includes('replic') && /\b(?:replica\s+placement|first\s+replica|second\s+replica)\b/i.test(textLower)) {
      score += 5.0;
    }

    // 8. Significant penalty for outline / table of contents / syllabus chunks
    if (isOutlineOrTOC(row.content)) {
      score *= 0.08;
    }

    // 9. Comparison Table / Parameter Grid Penalty when seeking explanation
    if (/parameters\s+rdbms\s+hadoop|rdbms\s+vs\s+hadoop/i.test(textLower) && !targetPhrase.includes('vs') && !targetPhrase.includes('rdbms')) {
      score *= 0.15;
    }

    // 10. Generic Introduction Penalty when specific concept asked
    if (/\b(?:introducing hadoop|why hadoop|history of hadoop)\b/i.test(textLower) && !targetPhrase.includes('history') && !targetPhrase.includes('why')) {
      score *= 0.35;
    }

    // 11. Small bonus if chunk belongs to a specified topic
    if (options.topic && row.topic.toLowerCase() === options.topic.toLowerCase()) {
      score += 2.0;
    }

    return {
      chunk: row,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const minFloor = options.minScore !== undefined ? options.minScore : 1.8;
  if (scored.length === 0 || scored[0].score < minFloor) {
    return [];
  }

  const topRawScore = scored[0].score;
  const cutoff = Math.max(minFloor, topRawScore * 0.22);

  const selected: typeof scored = [];
  const seenUnits = new Set<string>();

  for (const item of scored) {
    if (item.score < cutoff) break;
    // Deduplicate by page/slide/timestamp so multiple chunks from same page do not crowd out answers
    const baseKey = item.chunk.page_num
      ? `page_${item.chunk.page_num}`
      : (item.chunk.slide_num ? `slide_${item.chunk.slide_num}` : (item.chunk.timestamp_val ? `ts_${item.chunk.timestamp_val}` : item.chunk.id));
    if (seenUnits.has(baseKey)) continue;
    seenUnits.add(baseKey);
    selected.push(item);
    if (selected.length >= limit) break;
  }

  return selected.map(({ chunk, score }) => {
    const normScore = Math.min(1.0, Math.round((score / (queryTokens.length * 5 + 4)) * 100) / 100);
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
        snippet: extractSnippet(chunk.content, queryTokens, targetPhrase),
        relevance_score: normScore,
      },
    };
  });
}

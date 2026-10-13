import { ExtractedDocument } from './documentProcessor.js';
import { DocumentChunk, FileType } from '../../../shared/types.js';

export interface ChunkParams {
  materialId: string;
  courseId: string;
  materialTitle: string;
  maxChunkSize?: number; // target character length per chunk
  overlap?: number;       // overlap character length
}

/**
 * Split text into chunks with overlap while preserving sentence integrity
 */
function splitTextIntoChunks(text: string, maxChunkSize = 1000, overlap = 150): string[] {
  if (text.length <= maxChunkSize) {
    return [text.trim()];
  }

  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Create overlap by taking the last part of the current chunk
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.min(words.length, 25)).join(' ');
      currentChunk = overlapWords + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Detect topic or heading from chunk content
 */
function inferTopic(text: string): string {
  const commonTopics = [
    'Object-Oriented Programming',
    'Encapsulation',
    'Inheritance',
    'Polymorphism',
    'Interfaces & Abstract Classes',
    'Exception Handling',
    'Generics & Collections',
    'Arrays & Linked Lists',
    'Stacks & Queues',
    'Recursion',
    'Binary Search Trees',
    'Sorting Algorithms',
    'Time Complexity & Big-O',
  ];

  for (const topic of commonTopics) {
    const regex = new RegExp(`\\b${topic.replace('&', '(?:&|and)')}\\b`, 'i');
    if (regex.test(text)) {
      return topic;
    }
  }

  // Look for header keywords in the first line
  const firstLine = text.slice(0, 80).split('\n')[0];
  const headerMatch = firstLine.match(/^(?:Chapter|Lecture|Topic|Unit|Section)?\s*\d*[:.-]?\s*([A-Za-z\s]{3,35})/i);
  if (headerMatch && headerMatch[1]) {
    return headerMatch[1].trim();
  }

  return 'General Concepts';
}

/**
 * Chunk an extracted document into structured chunks with full source metadata
 */
export function chunkDocument(
  doc: ExtractedDocument,
  params: ChunkParams
): Array<{
  id: string;
  material_id: string;
  course_id: string;
  chunk_index: number;
  content: string;
  page_num?: number;
  slide_num?: number;
  timestamp_val?: string;
  unit_label: string;
  topic: string;
}> {
  const result: Array<{
    id: string;
    material_id: string;
    course_id: string;
    chunk_index: number;
    content: string;
    page_num?: number;
    slide_num?: number;
    timestamp_val?: string;
    unit_label: string;
    topic: string;
  }> = [];

  let chunkIndex = 0;

  for (const unit of doc.units) {
    const rawChunks = splitTextIntoChunks(unit.text, params.maxChunkSize || 1000, params.overlap || 150);

    for (let i = 0; i < rawChunks.length; i++) {
      const chunkText = rawChunks[i];
      if (chunkText.trim().length < 20) continue; // Skip trivial noise

      chunkIndex++;
      const topic = inferTopic(chunkText);
      const subLabel = rawChunks.length > 1 ? `${unit.unitLabel} (part ${i + 1})` : unit.unitLabel;

      result.push({
        id: `chk_${params.materialId}_${chunkIndex}`,
        material_id: params.materialId,
        course_id: params.courseId,
        chunk_index: chunkIndex,
        content: chunkText,
        page_num: unit.page,
        slide_num: unit.slide,
        timestamp_val: unit.timestamp,
        unit_label: subLabel,
        topic,
      });
    }
  }

  return result;
}

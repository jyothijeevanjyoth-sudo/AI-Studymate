import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import pdfParse from 'pdf-parse';
import { FileType } from '../../../shared/types.js';

export interface ExtractedUnit {
  unitIndex: number;
  unitLabel: string; // e.g. "Page 1", "Slide 3", "02:45"
  page?: number;
  slide?: number;
  timestamp?: string;
  text: string;
}

export interface ExtractedDocument {
  title: string;
  fileType: FileType;
  totalUnits: number;
  unitType: 'page' | 'slide' | 'timestamp' | 'section';
  units: ExtractedUnit[];
  fullText: string;
}

/**
 * Clean and decode XML text from PPTX tags
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Process PDF file and preserve page numbers
 */
export async function processPdf(filePath: string, title: string): Promise<ExtractedDocument> {
  const dataBuffer = fs.readFileSync(filePath);
  const units: ExtractedUnit[] = [];

  const pagerender = async (pageData: any): Promise<string> => {
    const textContent = await pageData.getTextContent();
    let text = '';
    for (const item of textContent.items) {
      text += item.str + ' ';
    }
    const cleanText = text.trim();
    const pageNum = pageData.pageIndex + 1;
    if (cleanText.length > 0) {
      units.push({
        unitIndex: pageNum,
        unitLabel: `Page ${pageNum}`,
        page: pageNum,
        text: cleanText,
      });
    }
    return cleanText;
  };

  const parsed = await pdfParse(dataBuffer, { pagerender });

  // If pagerender did not capture for some reason, fallback to page count splitting
  if (units.length === 0 && parsed.text.trim().length > 0) {
    const pages = parsed.text.split(/\f/); // form feed page breaks
    pages.forEach((pText, i) => {
      const trimmed = pText.trim();
      if (trimmed) {
        units.push({
          unitIndex: i + 1,
          unitLabel: `Page ${i + 1}`,
          page: i + 1,
          text: trimmed,
        });
      }
    });
  }

  return {
    title,
    fileType: 'pdf',
    totalUnits: units.length,
    unitType: 'page',
    units,
    fullText: units.map(u => u.text).join('\n\n'),
  };
}

/**
 * Process PPTX slides and preserve slide numbers
 */
export async function processPptx(filePath: string, title: string): Promise<ExtractedDocument> {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const slideEntries: { index: number; entry: AdmZip.IZipEntry }[] = [];

  for (const entry of entries) {
    const match = entry.entryName.match(/ppt\/slides\/slide(\d+)\.xml$/i);
    if (match) {
      slideEntries.push({
        index: parseInt(match[1], 10),
        entry,
      });
    }
  }

  // Sort by slide number
  slideEntries.sort((a, b) => a.index - b.index);

  const units: ExtractedUnit[] = [];

  for (const item of slideEntries) {
    const xmlContent = item.entry.getData().toString('utf8');
    // Extract paragraphs <a:p> and text <a:t>
    const textMatches = xmlContent.match(/<a:t[^>]*>(.*?)<\/a:t>/gi) || [];
    const slideText = textMatches
      .map(tag => {
        const inner = tag.replace(/<a:t[^>]*>/i, '').replace(/<\/a:t>/i, '');
        return decodeXmlEntities(inner);
      })
      .join(' ')
      .trim();

    if (slideText.length > 0) {
      units.push({
        unitIndex: item.index,
        unitLabel: `Slide ${item.index}`,
        slide: item.index,
        text: slideText,
      });
    }
  }

  return {
    title,
    fileType: 'pptx',
    totalUnits: units.length,
    unitType: 'slide',
    units,
    fullText: units.map(u => u.text).join('\n\n'),
  };
}

/**
 * Process video transcripts (VTT, SRT, or timestamped TXT)
 */
export async function processTranscript(filePath: string, title: string): Promise<ExtractedDocument> {
  const content = fs.readFileSync(filePath, 'utf8');
  const units: ExtractedUnit[] = [];

  // Match timestamp patterns like:
  // 00:01:23.000 --> 00:01:28.000 (VTT/SRT)
  // or [02:45] or 02:45
  const lines = content.split(/\r?\n/);
  let currentTimestamp = '00:00';
  let currentBuffer: string[] = [];
  let unitCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === 'WEBVTT') continue;

    const vttMatch = line.match(/^(\d{2}:\d{2}(?::\d{2})?)/);
    const bracketMatch = line.match(/^\[(\d{2}:\d{2}(?::\d{2})?)\]/);

    if (vttMatch || bracketMatch) {
      if (currentBuffer.length > 0) {
        unitCount++;
        units.push({
          unitIndex: unitCount,
          unitLabel: currentTimestamp,
          timestamp: currentTimestamp,
          text: currentBuffer.join(' '),
        });
        currentBuffer = [];
      }
      currentTimestamp = (bracketMatch ? bracketMatch[1] : vttMatch![1]);
    } else if (!/^\d+$/.test(line) && !line.includes('-->')) {
      // Normal speech text
      currentBuffer.push(line);
    }
  }

  if (currentBuffer.length > 0) {
    unitCount++;
    units.push({
      unitIndex: unitCount,
      unitLabel: currentTimestamp,
      timestamp: currentTimestamp,
      text: currentBuffer.join(' '),
    });
  }

  // Fallback if no timestamps were matched: split by 30-second segments or paragraphs
  if (units.length === 0 && content.trim().length > 0) {
    const paragraphs = content.split(/\n\s*\n/);
    paragraphs.forEach((p, idx) => {
      const trimmed = p.trim();
      if (trimmed) {
        const estMinutes = Math.floor((idx * 45) / 60);
        const estSecs = (idx * 45) % 60;
        const ts = `${String(estMinutes).padStart(2, '0')}:${String(estSecs).padStart(2, '0')}`;
        units.push({
          unitIndex: idx + 1,
          unitLabel: ts,
          timestamp: ts,
          text: trimmed,
        });
      }
    });
  }

  return {
    title,
    fileType: 'transcript',
    totalUnits: units.length,
    unitType: 'timestamp',
    units,
    fullText: units.map(u => u.text).join('\n\n'),
  };
}

/**
 * Process plain text or markdown notes
 */
export async function processText(filePath: string, title: string): Promise<ExtractedDocument> {
  const content = fs.readFileSync(filePath, 'utf8');
  const units: ExtractedUnit[] = [];

  // Split by markdown headers or sections
  const sections = content.split(/(?=^#+\s)/m);
  let sectionIndex = 1;

  for (const sec of sections) {
    const trimmed = sec.trim();
    if (trimmed.length > 0) {
      // Extract first header line if available
      const firstLine = trimmed.split('\n')[0].replace(/^#+\s*/, '').trim();
      const label = firstLine.length > 0 && firstLine.length < 30 ? firstLine : `Section ${sectionIndex}`;
      units.push({
        unitIndex: sectionIndex,
        unitLabel: label,
        text: trimmed,
      });
      sectionIndex++;
    }
  }

  if (units.length === 0 && content.trim().length > 0) {
    units.push({
      unitIndex: 1,
      unitLabel: 'Section 1',
      text: content.trim(),
    });
  }

  return {
    title,
    fileType: 'txt',
    totalUnits: units.length,
    unitType: 'section',
    units,
    fullText: units.map(u => u.text).join('\n\n'),
  };
}

/**
 * Universal document extraction dispatcher with format detection and error handling
 */
export async function extractDocument(filePath: string, originalName: string, title?: string): Promise<ExtractedDocument> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    throw new Error('Uploaded file is empty (0 bytes)');
  }

  const ext = path.extname(originalName).toLowerCase();
  const docTitle = title || path.basename(originalName, ext);

  switch (ext) {
    case '.pdf':
      return await processPdf(filePath, docTitle);
    case '.pptx':
      return await processPptx(filePath, docTitle);
    case '.vtt':
    case '.srt':
      return await processTranscript(filePath, docTitle);
    case '.txt':
    case '.md':
      // Check if it's a transcript by content inspection
      const sample = fs.readFileSync(filePath, 'utf8').slice(0, 500);
      if (sample.includes('-->') || sample.includes('WEBVTT') || /\[\d{2}:\d{2}\]/.test(sample)) {
        return await processTranscript(filePath, docTitle);
      }
      return await processText(filePath, docTitle);
    case '.mp4':
    case '.mov':
    case '.mkv':
    case '.webm':
      // Video files without pre-existing transcript
      return {
        title: docTitle,
        fileType: 'video',
        totalUnits: 1,
        unitType: 'timestamp',
        units: [{
          unitIndex: 1,
          unitLabel: '00:00',
          timestamp: '00:00',
          text: `[Video media file: ${path.basename(originalName)}. Transcripts can be uploaded or extracted via configured Speech-to-Text.]`,
        }],
        fullText: `[Video media file: ${path.basename(originalName)}]`,
      };
    default:
      throw new Error(`Unsupported file format "${ext}". Supported formats are: PDF, PPTX, TXT, MD, VTT, SRT, and Video.`);
  }
}

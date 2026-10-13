import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { retrieveRelevantChunks, isOutlineOrTOC, cleanQueryPhrase } from '../src/services/retrieval.js';
import { generateTutorResponse } from '../src/services/aiService.js';
import { initDatabase, queryAll } from '../src/db/db.js';

describe('AI StudyMate Retrieval & Answer Quality Regression Suite', () => {
  beforeAll(() => {
    initDatabase();
  });

  it('1. cleanQueryPhrase strips conversational prefixes cleanly', () => {
    expect(cleanQueryPhrase('Explain processing data with Hadoop')).toBe('processing data with hadoop');
    expect(cleanQueryPhrase('Can you please explain method overloading in Java?')).toBe('method overloading in java?');
    expect(cleanQueryPhrase('What is polymorphism?')).toBe('polymorphism?');
    expect(cleanQueryPhrase('Describe how MapReduce works')).toBe('how mapreduce works');
  });

  it('2. isOutlineOrTOC accurately identifies syllabus and table of contents outlines', () => {
    const tocText = `Introduction to Hadoop: Introducing hadoop, Why hadoop, Why not RDBMS, RDBMS Vs Hadoop, History of Hadoop, Hadoop overview, Use case of Hadoop, HDFS (Hadoop Distributed File System),Processing data with Hadoop, Managing resources and applications with Hadoop YARN. Introduction to Map Reduce Programming: Introduction, Mapper, Reducer, Combiner, Partitioner, Searching, Sorting, Compression.`;
    expect(isOutlineOrTOC(tocText)).toBe(true);

    const instructionalText = `PROCESSING DATA WITH HADOOP MapReduce Programming is a software framework. MapReduce Programming helps you to process massive amounts of data in parallel. In MapReduce Programming, the input dataset is split into independent chunks. Map tasks process these independent chunks completely in a parallel manner.`;
    expect(isOutlineOrTOC(instructionalText)).toBe(false);
  });

  it('3. Relevant retrieval deprioritizes syllabus TOC and prefers substantive content for "Explain processing data with Hadoop"', async () => {
    const chunks = await retrieveRelevantChunks('Explain processing data with Hadoop', {
      courseId: 'crs_cs101_java',
      limit: 5,
    });

    expect(chunks.length).toBeGreaterThan(0);
    // The top chunk must be Page 25 instructional content, NOT the Page 1 TOC
    expect(chunks[0].citation.unit_label).toContain('Page 25');
    expect(chunks[0].content).toContain('PROCESSING DATA WITH HADOOP');

    // Ensure Page 1 (part 2) TOC is not ranked above Page 25
    const topChunkLabels = chunks.map(c => c.citation.unit_label);
    expect(topChunkLabels[0]).not.toBe('Page 1 (part 2)');
  });

  it('4. Extractive fallback answer is structured, eliminates syllabus noise, and contains no duplicate sentences', async () => {
    const tutorRes = await generateTutorResponse('Explain processing data with Hadoop', 'crs_cs101_java', 'standard');

    expect(tutorRes.isFallback).toBe(true);
    expect(tutorRes.answer).toContain('### 📚 Grounded Answer (Extractive Fallback Mode)');
    expect(tutorRes.answer).toContain('#### 📌 Core Definition & Concept');
    expect(tutorRes.answer).toContain('#### ⚙️ How It Works: Components & Process');
    expect(tutorRes.answer).toContain('Source Grounding Notice');

    // Verify syllabus headings are omitted from response
    expect(tutorRes.answer).not.toContain('Introduction to Hadoop: Introducing hadoop');
    expect(tutorRes.answer).not.toContain('Mapper, Reducer, Combiner, Partitioner');

    // Verify citations are authentic
    expect(tutorRes.citations.length).toBeGreaterThan(0);
    expect(tutorRes.citations[0].unit_label).toContain('Page 25');
  });

  it('5. Extractive fallback works across subjects without hardcoding (Java CS101)', async () => {
    const tutorRes = await generateTutorResponse('Explain method overloading versus overriding in Java', 'crs_cs101_java', 'standard');

    expect(tutorRes.isFallback).toBe(true);
    expect(tutorRes.answer).toContain('Core Definition & Concept');
    expect(tutorRes.answer).toContain('Method Overloading vs Overriding');
    expect(tutorRes.citations.length).toBeGreaterThan(0);
    expect(tutorRes.citations[0].material_title).toContain('Lecture 08');
  });

  it('6. Empty / unanswerable questions return honest notice with zero hallucinated citations', async () => {
    const tutorRes = await generateTutorResponse(
      'How do you train a generative diffusion model with transformer backbones?',
      'crs_cs101_java',
      'standard'
    );

    expect(tutorRes.isFallback).toBe(true);
    expect(tutorRes.answer).toContain('Source Retrieval Notice');
    expect(tutorRes.answer).toContain('do not currently contain information addressing');
    expect(tutorRes.citations).toHaveLength(0);
  });

  it('7. Multi-mode tutor styles format correctly without raw text dumping', async () => {
    const modes: Array<'beginner' | 'step_by_step' | 'analogy' | 'practice'> = [
      'beginner',
      'step_by_step',
      'analogy',
      'practice',
    ];

    for (const mode of modes) {
      const res = await generateTutorResponse('What is polymorphism?', 'crs_cs101_java', mode);
      expect(res.isFallback).toBe(true);
      expect(res.citations.length).toBeGreaterThan(0);
      if (mode === 'beginner') {
        expect(res.answer).toContain('Beginner Mode');
      } else if (mode === 'step_by_step') {
        expect(res.answer).toContain('Step-by-Step Breakdown');
      } else if (mode === 'analogy') {
        expect(res.answer).toContain('Conceptual Analogy');
      } else if (mode === 'practice') {
        expect(res.answer).toContain('Practice Check for Understanding');
      }
    }
  });

  it('8. End-to-end API route POST /api/tutor/conversations/:id/messages returns high quality response', async () => {
    const convRes = await request(app)
      .post('/api/tutor/conversations')
      .send({ courseId: 'crs_cs101_java', title: 'Quality Verification' });
    expect(convRes.status).toBe(201);
    const convId = convRes.body.id;

    const msgRes = await request(app)
      .post(`/api/tutor/conversations/${convId}/messages`)
      .send({ content: 'Explain processing data with Hadoop', mode: 'standard' });

    expect(msgRes.status).toBe(201);
    expect(msgRes.body.message.content).toContain('Core Definition & Concept');
    expect(msgRes.body.message.content).toContain('MapReduce');
    expect(msgRes.body.message.citations[0].unit_label).toContain('Page 25');
  });
});

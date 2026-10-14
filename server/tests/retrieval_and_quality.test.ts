import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { retrieveRelevantChunks, isOutlineOrTOC, cleanQueryPhrase, cleanSourceText, stemToken } from '../src/services/retrieval.js';
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
    expect(tutorRes.answer).toContain('#### 📌 Definition');
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
    expect(tutorRes.answer).toContain('Definition');
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
    expect(msgRes.body.message.content).toContain('Definition');
    expect(msgRes.body.message.content).toContain('MapReduce');
    expect(msgRes.body.message.citations[0].unit_label).toContain('Page 25');
  });

  it('9. cleanSourceText normalizes PDF artifacts, watermarks, spacing, and broken hyphens', () => {
    const rawWithWatermark = "Vtucircle.com Page 25 BigDataAnalytics-BIS701-Module2 large - scale data set .";
    const cleaned = cleanSourceText(rawWithWatermark);
    expect(cleaned).not.toContain('Vtucircle.com');
    expect(cleaned).not.toContain('BigDataAnalytics');
    expect(cleaned).toContain('large-scale data set.');

    // Trim leading overlap fragment before heading
    const rawFragmented = "all the data blocks are processed. PROCESSING DATA WITH HADOOP MapReduce Programming is a framework";
    const cleanedFragmented = cleanSourceText(rawFragmented);
    expect(cleanedFragmented).toBe('PROCESSING DATA WITH HADOOP: MapReduce Programming is a framework');
  });

  it('10. Distinct retrieval queries target their specific technical domains without cross-topic contamination', async () => {
    // 10a. HDFS query targets storage architecture (Pages 3, 21, 22)
    const hdfsChunks = await retrieveRelevantChunks('What is HDFS and how does it store files?', {
      courseId: 'crs_cs101_java',
      limit: 3,
    });
    expect(hdfsChunks.length).toBeGreaterThan(0);
    const hdfsText = hdfsChunks.map(c => c.content).join(' ');
    expect(hdfsText.toLowerCase()).toContain('hdfs');
    expect(/nodes?|replicas?|cluster|directory|store/i.test(hdfsText)).toBe(true);

    // 10b. YARN query targets resource management (Pages 34, 35, 37)
    const yarnChunks = await retrieveRelevantChunks('Explain YARN architecture and resource management', {
      courseId: 'crs_cs101_java',
      limit: 3,
    });
    expect(yarnChunks.length).toBeGreaterThan(0);
    const yarnText = yarnChunks.map(c => c.content).join(' ');
    expect(yarnText.toLowerCase()).toContain('yarn');
    expect(/resourcemanager|nodemanager|applicationmaster/i.test(yarnText)).toBe(true);

    // 10c. MapReduce / Mapper / Reducer query targets processing tasks (Pages 30, 31, 41)
    const mrChunks = await retrieveRelevantChunks('What is MapReduce and what do Mapper and Reducer do?', {
      courseId: 'crs_cs101_java',
      limit: 3,
    });
    expect(mrChunks.length).toBeGreaterThan(0);
    const mrText = mrChunks.map(c => c.content).join(' ');
    expect(mrText.toLowerCase()).toContain('mapreduce');
    expect(/mapper|reducer|key.*value/i.test(mrText)).toBe(true);

    // 10d. Chunk deduplication: ensures multiple chunk slices of the same page/unit are not duplicated
    const hadoopChunks = await retrieveRelevantChunks('Explain processing data with Hadoop', {
      courseId: 'crs_cs101_java',
      limit: 3,
    });
    const pageUnits = hadoopChunks.map(c => c.citation.page).filter(Boolean);
    const uniquePages = new Set(pageUnits);
    expect(pageUnits.length).toBe(uniquePages.size);
  });

  it('11. "Explain data replication" returns HDFS replication in core answer and excludes unrelated MapReduce definition', async () => {
    const tutorRes = await generateTutorResponse('Explain data replication', 'crs_cs101_java', 'standard');

    expect(tutorRes.isFallback).toBe(true);
    expect(tutorRes.citations.length).toBeGreaterThan(0);

    // Citations must point to replication / HDFS pages (Page 17, 20, 6) and MUST NOT include unrelated Page 25
    const topCitationLabels = tutorRes.citations.map(c => c.unit_label).join(' ');
    expect(/Page 17|Page 20|Page 6/i.test(topCitationLabels)).toBe(true);
    expect(tutorRes.citations.some(c => c.unit_label.includes('Page 25'))).toBe(false);

    // Core definition must NOT contain the MapReduce Programming framework definition
    expect(tutorRes.answer).not.toContain('MapReduce Programming is a software framework');

    // Core answer must NOT be an empty placeholder
    expect(tutorRes.answer).not.toContain('Core topic described in');

    // Must NOT contain truncation artifacts like "Wh..." or "DataNod..."
    expect(tutorRes.answer).not.toMatch(/Data Replication:\s*Wh(?:\.\.\.|\s*$)/);
    expect(tutorRes.answer).not.toContain('Wh...');
    expect(tutorRes.answer).not.toContain('DataNod...');
    expect(tutorRes.answer).not.toContain('a possibility of hardware failure.');

    // Must NOT contain duplicate bullet symbols or malformed numbers
    expect(tutorRes.answer).not.toMatch(/•\s*•/);
    expect(tutorRes.answer).not.toMatch(/\d+\.\s*•/);

    // Answer must explain data replication / fault tolerance
    expect(tutorRes.answer.toLowerCase()).toContain('replic');
    expect(tutorRes.answer).toContain('Definition');
    expect(tutorRes.answer).toContain('Failure Recovery');
    expect(tutorRes.answer).toContain('Replica Placement Strategy');

    // Replica placement must contain complete first, second, and third replica instructions
    expect(tutorRes.answer).toMatch(/first replica is placed on the same node as the client/i);
    expect(tutorRes.answer).toMatch(/second replica on a node that is present on different rack/i);
    expect(tutorRes.answer).toMatch(/third replica on the same rack as second/i);

    // Failure detection & recovery mechanics
    expect(tutorRes.answer).toMatch(/Active DataNodes send heartbeats to the NameNode/i);
    expect(tutorRes.answer).toMatch(/triggers replication of its data to another DataNode/i);
  });

  it('12. "What is the replication factor?" returns Replication Factor definitions and default 3', async () => {
    const tutorRes = await generateTutorResponse('What is the replication factor?', 'crs_cs101_java', 'standard');

    expect(tutorRes.isFallback).toBe(true);
    expect(tutorRes.citations.length).toBeGreaterThan(0);
    expect(tutorRes.answer.toLowerCase()).toContain('replication factor');
    expect(tutorRes.answer).toContain('Definition');
    expect(tutorRes.answer).toMatch(/number of data copies/i);
    expect(tutorRes.citations.some(c => c.unit_label.includes('Page 6') || c.unit_label.includes('Page 15'))).toBe(true);
  });

  it('13. "What happens when a DataNode fails?" returns NameNode heartbeat failure detection and re-replication', async () => {
    const tutorRes = await generateTutorResponse('What happens when a DataNode fails?', 'crs_cs101_java', 'standard');

    expect(tutorRes.isFallback).toBe(true);
    expect(tutorRes.citations.length).toBeGreaterThan(0);
    expect(tutorRes.answer).toContain('Failure Recovery');
    expect(tutorRes.answer).toMatch(/triggers replication of its data to another DataNode/i);
    expect(tutorRes.answer).toMatch(/stops sending heartbeats/i);
  });

  it('14. "Explain replica placement in HDFS" returns complete first, second, and third replica strategy', async () => {
    const tutorRes = await generateTutorResponse('Explain replica placement in HDFS', 'crs_cs101_java', 'standard');

    expect(tutorRes.isFallback).toBe(true);
    expect(tutorRes.citations.length).toBeGreaterThan(0);
    expect(tutorRes.answer).toContain('Replica Placement Strategy');
    expect(tutorRes.answer).toMatch(/first replica is placed on the same node as the client/i);
    expect(tutorRes.answer).toMatch(/second replica on a node that is present on different rack/i);
    expect(tutorRes.answer).toMatch(/third replica on the same rack as second/i);
    expect(tutorRes.citations.some(c => c.unit_label.includes('Page 20'))).toBe(true);
  });

  it('15. "Explain MapReduce" returns MapReduce processing framework, Mapper, and Reducer', async () => {
    const tutorRes = await generateTutorResponse('Explain MapReduce', 'crs_cs101_java', 'standard');

    expect(tutorRes.isFallback).toBe(true);
    expect(tutorRes.citations.length).toBeGreaterThan(0);
    expect(tutorRes.answer).toContain('Definition');
    expect(tutorRes.answer).toMatch(/MapReduce Programming is a software framework/i);
    expect(tutorRes.answer).toMatch(/process massive amounts of data in parallel/i);
    expect(tutorRes.answer).toMatch(/Map tasks/i);
    expect(tutorRes.answer).not.toContain('Hadoop Replica Placement Strategy');
  });

  it('16. Absent question returns honest grounding notice with zero citations', async () => {
    const tutorRes = await generateTutorResponse(
      'What is backpropagation in deep neural networks?',
      'crs_cs101_java',
      'standard'
    );

    expect(tutorRes.isFallback).toBe(true);
    expect(tutorRes.citations.length).toBe(0);
    expect(tutorRes.answer).toContain('Source Retrieval Notice');
    expect(tutorRes.answer).toContain('do not currently contain information addressing');
  });

  it('17. stemToken normalizes morphological variants correctly', () => {
    expect(stemToken('replication')).toBe('replic');
    expect(stemToken('replicas')).toBe('replic');
    expect(stemToken('re-replication')).toBe('replic');
    expect(stemToken('processes')).toBe('process');
    expect(stemToken('processing')).toBe('process');
    expect(stemToken('overloading')).toBe('overload');
    expect(stemToken('overriding')).toBe('overrid');
  });

  it('18. Typo-resilient query "explai data repkication" resolves to data replication with substantive core answer', async () => {
    const tutorRes = await generateTutorResponse('explai data repkication', 'crs_cs101_java', 'standard');

    expect(tutorRes.isFallback).toBe(true);
    expect(tutorRes.citations.length).toBeGreaterThan(0);

    // Citations must point to replication / HDFS pages and exclude Page 25
    const topCitationLabels = tutorRes.citations.map(c => c.unit_label).join(' ');
    expect(/Page 17|Page 20|Page 6/i.test(topCitationLabels)).toBe(true);
    expect(tutorRes.citations.some(c => c.unit_label.includes('Page 25'))).toBe(false);

    // Must NOT contain MapReduce
    expect(tutorRes.answer).not.toContain('MapReduce Programming is a software framework');

    // Must NOT be an empty placeholder
    expect(tutorRes.answer).not.toContain('Core topic described in');

    // Must NOT contain incomplete sentence fragment or truncation artifacts
    expect(tutorRes.answer).not.toContain('a possibility of hardware failure.');
    expect(tutorRes.answer).not.toMatch(/Data Replication:\s*Wh(?:\.\.\.|\s*$)/);
    expect(tutorRes.answer).not.toContain('Wh...');
    expect(tutorRes.answer).not.toContain('DataNod...');

    // Must contain substantive definitions and procedural mechanics
    expect(tutorRes.answer).toContain('Definition');
    expect(tutorRes.answer).toContain('Replica Placement Strategy');
    expect(/datanode fails|heartbeat|nearest replica|replica placement strategy|track all blocks/i.test(tutorRes.answer)).toBe(true);
    expect(/communication using heartbeats|different rack|pipeline/i.test(tutorRes.answer)).toBe(true);
    expect(tutorRes.answer).toMatch(/first replica is placed on the same node as the client/i);
  });
});


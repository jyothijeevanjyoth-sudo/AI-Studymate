import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { seedDatabase } from '../src/db/seed.js';

describe('AI StudyMate API Integration & Assessment Tests', () => {
  beforeAll(async () => {
    await seedDatabase();
  });

  it('GET /api/health returns healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('GET /api/courses returns seeded CS101 course', async () => {
    const res = await request(app).get('/api/courses');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].code).toBe('CS101');
  });

  it('GET /api/materials returns materials with unit metadata', async () => {
    const res = await request(app).get('/api/materials?courseId=crs_cs101_java');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    const pdf = res.body.find((m: any) => m.file_type === 'pdf');
    expect(pdf).toBeDefined();
    expect(pdf.total_units).toBe(4);
    expect(pdf.unit_type).toBe('page');
  });

  it('POST /api/tutor/conversations & send message returns source citations', async () => {
    const convRes = await request(app)
      .post('/api/tutor/conversations')
      .send({ courseId: 'crs_cs101_java', title: 'Test Conversation' });
    expect(convRes.status).toBe(201);
    const convId = convRes.body.id;

    const msgRes = await request(app)
      .post(`/api/tutor/conversations/${convId}/messages`)
      .send({
        content: 'What is dynamic method dispatch and how does it relate to polymorphism?',
        mode: 'standard',
      });

    expect(msgRes.status).toBe(201);
    expect(msgRes.body.message.content).toBeDefined();
    expect(msgRes.body.message.citations).toBeDefined();
    expect(msgRes.body.message.citations.length).toBeGreaterThan(0);
    // Verifiable real citation from slides or textbook
    expect(msgRes.body.message.citations[0].unit_label).toBeDefined();
  });

  it('POST /api/quiz/generate generates quiz grounded in course material', async () => {
    const res = await request(app)
      .post('/api/quiz/generate')
      .send({
        courseId: 'crs_cs101_java',
        topic: 'Inheritance',
        difficulty: 'intermediate',
        questionsCount: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toContain('Inheritance');
    expect(res.body.questions.length).toBe(2);
    expect(res.body.questions[0].citation).toBeDefined();
  });

  it('POST /api/quiz/:id/submit grades answers and detects misconceptions on failure', async () => {
    // Generate a quiz first
    const qGen = await request(app)
      .post('/api/quiz/generate')
      .send({
        courseId: 'crs_cs101_java',
        topic: 'Inheritance',
        questionsCount: 2,
      });
    const quiz = qGen.body;
    const questions = quiz.questions;

    // Submit deliberately wrong answers to trigger Misconception Detective
    const subRes = await request(app)
      .post(`/api/quiz/${quiz.id}/submit`)
      .send({
        answers: [
          { question_id: questions[0].id, user_answer: 'Completely wrong answer' },
          { question_id: questions[1].id, user_answer: 'Another incorrect answer' },
        ],
        timeTakenSeconds: 45,
      });

    expect(subRes.status).toBe(200);
    expect(subRes.body.attempt.score).toBe(0);
    expect(subRes.body.attempt.percentage).toBe(0);
    // Adaptive feedback recommends beginner revision
    expect(subRes.body.recommendedDifficulty).toBe('beginner');
    expect(subRes.body.weakTopicsIdentified).toContain('Inheritance');
  });

  it('GET /api/misconceptions lists active misconception and verifies resolution', async () => {
    const listRes = await request(app).get('/api/misconceptions?courseId=crs_cs101_java');
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBeGreaterThan(0);

    const misc = listRes.body[0];
    expect(misc.misconception_text).toBeDefined();
    expect(misc.follow_up_question).toBeDefined();

    // Verify follow-up answer
    const verifyRes = await request(app)
      .post(`/api/misconceptions/${misc.id}/verify`)
      .send({ answer: misc.follow_up_question.correct_answer });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.isCorrect).toBe(true);
    expect(verifyRes.body.wasResolved).toBe(true);
  });

  it('GET /api/learning-twin returns cognitive twin profile with confidence scores', async () => {
    const res = await request(app).get('/api/learning-twin?courseId=crs_cs101_java');
    expect(res.status).toBe(200);
    expect(res.body.overall_readiness_pct).toBeDefined();
    expect(res.body.overall_confidence).toBeDefined();
    expect(res.body.topic_twins.length).toBeGreaterThan(0);
    expect(res.body.cognitive_readiness_note).toContain('probabilistically');
  });

  it('POST /api/learning-twin/simulate simulates What-If learning outcomes', async () => {
    const simRes = await request(app)
      .post('/api/learning-twin/simulate')
      .send({
        course_id: 'crs_cs101_java',
        planned_study_minutes: 60,
        focus_topics: ['Inheritance'],
        planned_quizzes_count: 2,
      });

    expect(simRes.status).toBe(200);
    expect(simRes.body.projected_readiness_pct).toBeDefined();
    expect(simRes.body.projected_topic_outcomes.length).toBeGreaterThan(0);
    expect(simRes.body.disclaimer).toContain('Disclaimer:');
  });

  it('POST /api/study-tracker/session records and validates study sessions', async () => {
    // Valid session
    const validRes = await request(app)
      .post('/api/study-tracker/session')
      .send({
        courseId: 'crs_cs101_java',
        durationSeconds: 1200,
        sessionType: 'platform',
        notes: 'Interactive tutoring session on Abstract Classes',
      });

    expect(validRes.status).toBe(201);
    expect(validRes.body.duration_minutes).toBe(20);

    // Invalid session: duration 0 should fail
    const invalidRes = await request(app)
      .post('/api/study-tracker/session')
      .send({
        courseId: 'crs_cs101_java',
        durationSeconds: 0,
      });

    expect(invalidRes.status).toBe(400);

    // Check stats
    const statsRes = await request(app).get('/api/study-tracker/stats?courseId=crs_cs101_java');
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.total_minutes).toBeGreaterThan(0);
  });
});

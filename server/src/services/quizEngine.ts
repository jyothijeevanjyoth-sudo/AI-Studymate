import { queryAll, queryOne, execute, transaction } from '../db/db.js';
import { retrieveRelevantChunks } from './retrieval.js';
import { detectMisconception } from './misconceptionDetective.js';
import {
  Difficulty,
  QuestionType,
  QuizQuestion,
  Quiz,
  GradedAnswerResult,
  QuizAttempt,
  TopicPerformance,
  TopicStatus,
  Citation,
} from '../../../shared/types.js';

export interface GenerateQuizParams {
  courseId: string;
  topic?: string;
  difficulty?: Difficulty;
  questionsCount?: number;
  questionType?: QuestionType;
}

/**
 * Generate deterministic fallback questions grounded in stored chunks
 */
function generateDeterministicQuestions(
  chunks: Array<{ chunkId: string; content: string; citation: Citation; topic: string }>,
  targetDifficulty: Difficulty = 'intermediate',
  count = 5
): QuizQuestion[] {
  const questions: QuizQuestion[] = [];

  for (let i = 0; i < Math.min(chunks.length, count); i++) {
    const chunk = chunks[i];
    const text = chunk.content;
    const topic = chunk.topic || 'General Concepts';

    // Heuristics to find definitions and key statements
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const candidateSentence = sentences.find(s => 
      s.includes(' is ') || s.includes(' are ') || s.includes(' allows ') || s.includes(' refers to ') || s.length > 50
    ) || sentences[0];

    const cleanSentence = candidateSentence.trim();

    // Create multiple choice questions with realistic distractors
    const qId = `q_gen_${Date.now()}_${i + 1}`;

    if (i % 2 === 0) {
      // Multiple Choice Question
      const subjectMatch = cleanSentence.match(/^(?:In\s+[A-Za-z0-9_]+,\s*)?([A-Za-z0-9_\s]{3,35})\s+(?:is|refers to|allows|represents)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : topic;

      const questionText = `According to ${chunk.citation.material_title} (${chunk.citation.unit_label}), which statement best characterizes "${subject}"?`;
      const correctAnswer = cleanSentence;

      // Realistic plausible distractors
      const distractors = [
        `It operates exclusively at runtime without requiring static structural declarations or constraints.`,
        `It bypasses compile-time safety checks to maximize execution throughput and memory efficiency.`,
        `It is deprecated in standard modern implementations due to severe performance overhead and fragility.`,
      ];

      const options = [correctAnswer, ...distractors].sort(() => 0.5 - Math.random());

      questions.push({
        id: qId,
        question_text: questionText,
        question_type: 'multiple_choice',
        options,
        correct_answer: correctAnswer,
        explanation: `As detailed in ${chunk.citation.material_title} (${chunk.citation.unit_label}): "${cleanSentence}"`,
        topic,
        difficulty: targetDifficulty,
        citation: chunk.citation,
      });
    } else {
      // Short answer question
      const questionText = `Based on your course materials in ${chunk.citation.material_title} (${chunk.citation.unit_label}), explain the primary concept of ${topic} and how it is applied.`;
      
      questions.push({
        id: qId,
        question_text: questionText,
        question_type: 'short_answer',
        correct_answer: cleanSentence,
        explanation: `Reference source: ${chunk.citation.material_title} (${chunk.citation.unit_label}). Key principle: ${cleanSentence}`,
        topic,
        difficulty: targetDifficulty,
        citation: chunk.citation,
      });
    }
  }

  return questions;
}

/**
 * Generate a complete quiz for a course
 */
export async function createQuiz(params: GenerateQuizParams): Promise<Quiz> {
  const count = params.questionsCount || 5;
  const difficulty = params.difficulty || 'intermediate';
  const topic = params.topic || 'General Course Review';

  // Retrieve chunks relevant to the course and topic
  const retrieved = await retrieveRelevantChunks(topic, {
    courseId: params.courseId,
    topic: params.topic === 'General Course Review' ? undefined : params.topic,
    limit: count * 2,
  });

  const rawChunks = retrieved.map(r => ({
    chunkId: r.chunkId,
    content: r.content,
    citation: r.citation,
    topic: r.citation.unit_label ? topic : 'General Concepts',
  }));

  const generatedQuestions = generateDeterministicQuestions(rawChunks, difficulty, count);

  // Fallback if no materials are uploaded yet
  if (generatedQuestions.length === 0) {
    generatedQuestions.push({
      id: `q_default_1`,
      question_text: `What is the core principle of Object-Oriented Programming that combines data and methods into a single unit?`,
      question_type: 'multiple_choice',
      options: ['Encapsulation', 'Polymorphism', 'Inheritance', 'Compilation'],
      correct_answer: 'Encapsulation',
      explanation: 'Encapsulation bundles state and behaviors together and protects direct access to internal state.',
      topic: 'Encapsulation',
      difficulty: 'beginner',
    });
  }

  const quizId = `quiz_${Date.now()}`;
  const quizTitle = `${topic} (${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Assessment)`;

  // Save quiz and questions in database
  transaction(() => {
    execute(
      `INSERT INTO quizzes (id, course_id, title, topic, difficulty, questions_count, is_adaptive, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      [quizId, params.courseId, quizTitle, topic, difficulty, generatedQuestions.length]
    );

    for (const q of generatedQuestions) {
      execute(
        `INSERT INTO quiz_questions (id, quiz_id, question_text, question_type, options_json, correct_answer, explanation, topic, difficulty, citation_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          q.id,
          quizId,
          q.question_text,
          q.question_type,
          q.options ? JSON.stringify(q.options) : null,
          q.correct_answer,
          q.explanation,
          q.topic,
          q.difficulty,
          q.citation ? JSON.stringify(q.citation) : null,
        ]
      );
    }
  });

  return {
    id: quizId,
    course_id: params.courseId,
    title: quizTitle,
    topic,
    difficulty,
    questions_count: generatedQuestions.length,
    is_adaptive: true,
    created_at: new Date().toISOString(),
    questions: generatedQuestions,
  };
}

/**
 * Grade quiz submission, calculate score, and adaptively update topic performance
 */
export async function gradeQuizSubmission(
  quizId: string,
  answers: Array<{ question_id: string; user_answer: string }>,
  timeTakenSeconds = 0
): Promise<{
  attempt: QuizAttempt;
  gradedAnswers: GradedAnswerResult[];
  adaptiveFeedback: string;
  recommendedDifficulty: Difficulty;
  weakTopicsIdentified: string[];
}> {
  const quiz = queryOne<any>(`SELECT * FROM quizzes WHERE id = ?`, [quizId]);
  if (!quiz) {
    throw new Error(`Quiz ${quizId} not found`);
  }

  const storedQuestions = queryAll<any>(`SELECT * FROM quiz_questions WHERE quiz_id = ?`, [quizId]);
  const questionMap = new Map(storedQuestions.map(q => [q.id, q]));

  let score = 0;
  const attemptId = `att_${Date.now()}`;
  const gradedResults: GradedAnswerResult[] = [];
  const topicStats: Record<string, { total: number; correct: number }> = {};

  for (const submitted of answers) {
    const q = questionMap.get(submitted.question_id);
    if (!q) continue;

    const topic = q.topic || 'General';
    if (!topicStats[topic]) topicStats[topic] = { total: 0, correct: 0 };
    topicStats[topic].total++;

    const isMC = q.question_type === 'multiple_choice';
    const cleanUser = (submitted.user_answer || '').trim().toLowerCase();
    const cleanCorrect = (q.correct_answer || '').trim().toLowerCase();

    let isCorrect = false;
    if (isMC) {
      isCorrect = cleanUser === cleanCorrect;
    } else {
      // Short answer grading heuristic: checks for presence of key keywords from correct answer
      const keywords = cleanCorrect.split(/\s+/).filter((w: string) => w.length > 4);
      const matched = keywords.filter((kw: string) => cleanUser.includes(kw));
      isCorrect = keywords.length > 0 ? (matched.length / keywords.length) >= 0.4 : cleanUser.length > 10;
    }

    if (isCorrect) {
      score++;
      topicStats[topic].correct++;
    }

    let citationObj: Citation | undefined;
    if (q.citation_json) {
      try {
        citationObj = JSON.parse(q.citation_json);
      } catch (e) {
        // ignore parse error
      }
    }

    let recommendation: string | undefined;
    if (!isCorrect) {
      const sourceRef = citationObj ? `${citationObj.material_title} (${citationObj.unit_label})` : 'course lecture notes';
      recommendation = `Review ${topic} in ${sourceRef} before re-attempting this question.`;
    }

    gradedResults.push({
      question_id: q.id,
      question_text: q.question_text,
      user_answer: submitted.user_answer,
      correct_answer: q.correct_answer,
      is_correct: isCorrect,
      explanation: q.explanation,
      topic,
      difficulty: q.difficulty as Difficulty,
      citation: citationObj,
      recommendation,
    });
  }

  const totalQuestions = storedQuestions.length;
  const percentage = Math.round((score / Math.max(1, totalQuestions)) * 100);
  const passed = percentage >= 70;

  // Execute database updates inside a transaction
  transaction(() => {
    // 1. Record attempt
    execute(
      `INSERT INTO quiz_attempts (id, quiz_id, score, total_questions, percentage, passed, time_taken_seconds, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [attemptId, quizId, score, totalQuestions, percentage, passed ? 1 : 0, timeTakenSeconds]
    );

    // 2. Record individual answers
    for (const r of gradedResults) {
      execute(
        `INSERT INTO attempt_answers (id, attempt_id, question_id, user_answer, is_correct, feedback)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `ans_${Date.now()}_${r.question_id}`,
          attemptId,
          r.question_id,
          r.user_answer,
          r.is_correct ? 1 : 0,
          r.explanation,
        ]
      );
    }

    // 3. Update topic performance adaptively according to prompt rules
    for (const [topic, stats] of Object.entries(topicStats)) {
      const existing = queryOne<any>(
        `SELECT * FROM topic_performance WHERE course_id = ? AND topic = ?`,
        [quiz.course_id, topic]
      );

      const totalAttempted = (existing ? existing.total_questions : 0) + stats.total;
      const totalCorrect = (existing ? existing.correct_answers : 0) + stats.correct;
      const accuracy = Math.round((totalCorrect / Math.max(1, totalAttempted)) * 100);

      // Adaptive rules from prompt:
      // Below 50%: foundational revision, easier questions (beginner). Topic status = 'needs_improvement'
      // 50-79%: targeted practice at current or mixed difficulty (intermediate). Topic status = 'practicing'
      // >= 80%: harder questions (advanced) or move to next topic, provided >= 3 questions answered
      let status: TopicStatus = 'insufficient_data';
      let recommendedDiff: Difficulty = 'intermediate';

      if (totalAttempted < 2) {
        status = 'insufficient_data';
        recommendedDiff = 'beginner';
      } else if (accuracy < 50) {
        status = 'needs_improvement';
        recommendedDiff = 'beginner';
      } else if (accuracy < 80) {
        status = 'practicing';
        recommendedDiff = 'intermediate';
      } else {
        // >= 80% accuracy
        if (totalAttempted >= 3) {
          status = 'mastered';
          recommendedDiff = 'advanced';
        } else {
          status = 'practicing'; // Not enough evidence yet to certify mastery
          recommendedDiff = 'intermediate';
        }
      }

      execute(
        `INSERT INTO topic_performance (id, course_id, topic, total_questions, correct_answers, accuracy, status, recommended_difficulty, last_practiced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(course_id, topic) DO UPDATE SET
           total_questions = excluded.total_questions,
           correct_answers = excluded.correct_answers,
           accuracy = excluded.accuracy,
           status = excluded.status,
           recommended_difficulty = excluded.recommended_difficulty,
           last_practiced = datetime('now')`,
        [
          `perf_${quiz.course_id}_${topic.replace(/\s+/g, '_')}`,
          quiz.course_id,
          topic,
          totalAttempted,
          totalCorrect,
          accuracy,
          status,
          recommendedDiff,
        ]
      );
    }
  });

  // 4. Record detected misconceptions for incorrect answers (attemptId is committed in DB)
  for (const r of gradedResults) {
    if (!r.is_correct) {
      try {
        await detectMisconception(
          attemptId,
          r.question_id,
          quiz.course_id,
          r.topic,
          r.question_text,
          r.user_answer,
          r.correct_answer
        );
      } catch (err) {
        console.warn('[Quiz Engine] Could not record misconception:', err);
      }
    }
  }

  // Adaptive recommendation summary
  let adaptiveFeedback = '';
  let nextDiff: Difficulty = 'intermediate';
  const weakTopics: string[] = [];

  if (percentage < 50) {
    adaptiveFeedback = `Performance is below 50% (${percentage}%). AI StudyMate recommends foundational revision and beginner-level practice. Review the supporting source citations below.`;
    nextDiff = 'beginner';
  } else if (percentage < 80) {
    adaptiveFeedback = `Good progress (${percentage}%). Targeted practice at the intermediate difficulty level is recommended to solidify concepts.`;
    nextDiff = 'intermediate';
  } else {
    adaptiveFeedback = `Excellent mastery demonstrated (${percentage}%)! Ready for advanced problem solving and higher-order architectural questions.`;
    nextDiff = 'advanced';
  }

  for (const [topic, stats] of Object.entries(topicStats)) {
    if ((stats.correct / stats.total) < 0.6) {
      weakTopics.push(topic);
    }
  }

  return {
    attempt: {
      id: attemptId,
      quiz_id: quizId,
      quiz_title: quiz.title,
      score,
      total_questions: totalQuestions,
      percentage,
      passed,
      time_taken_seconds: timeTakenSeconds,
      completed_at: new Date().toISOString(),
      answers: gradedResults,
    },
    gradedAnswers: gradedResults,
    adaptiveFeedback,
    recommendedDifficulty: nextDiff,
    weakTopicsIdentified: weakTopics,
  };
}

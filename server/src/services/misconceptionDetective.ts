import { queryAll, queryOne, execute, transaction } from '../db/db.js';
import { retrieveRelevantChunks } from './retrieval.js';
import { Misconception } from '../../../shared/types.js';

interface MisconceptionPattern {
  topic: string;
  pattern: RegExp;
  misconception: string;
  explanation: string;
  followUp: {
    question_text: string;
    options: string[];
    correct_answer: string;
    explanation: string;
  };
}

const KNOWN_MISCONCEPTIONS: MisconceptionPattern[] = [
  {
    topic: 'Inheritance',
    pattern: /inherit|extends|super|override/i,
    misconception: 'Believing child classes automatically acquire access to private fields or constructors of the parent class.',
    explanation: 'In Object-Oriented design, private members of a parent class are NOT accessible directly by subclasses. Subclasses must use public or protected getter/setter methods or super() constructor invocation.',
    followUp: {
      question_text: 'Can a subclass in Java directly access a private variable declared in its superclass?',
      options: [
        'No, private variables are restricted to the declaring class; the subclass must use public/protected accessors.',
        'Yes, any extends relationship grants unrestricted direct access to private members.',
        'Yes, but only if the subclass is instantiated inside the same method.',
        'No, unless the subclass uses the global import keyword.'
      ],
      correct_answer: 'No, private variables are restricted to the declaring class; the subclass must use public/protected accessors.',
      explanation: 'Encapsulation restricts direct private field access even across inheritance hierarchies.'
    }
  },
  {
    topic: 'Polymorphism',
    pattern: /polymorphism|overload|override|dynamic/i,
    misconception: 'Confusing compile-time method overloading with runtime dynamic method overriding.',
    explanation: 'Method overloading happens at compile-time based on method signatures (parameter types and count). Method overriding happens at runtime when a subclass provides its own implementation of a parent class method.',
    followUp: {
      question_text: 'Which statement accurately distinguishes method overloading from method overriding?',
      options: [
        'Overloading is resolved at compile time with different parameter lists; overriding is resolved at runtime with identical signatures.',
        'Overloading requires inheritance; overriding happens within a single class.',
        'Both overloading and overriding are determined exclusively by return types at compile time.',
        'Overriding does not support dynamic dispatch at runtime.'
      ],
      correct_answer: 'Overloading is resolved at compile time with different parameter lists; overriding is resolved at runtime with identical signatures.',
      explanation: 'Overloading is static (compile-time polymorphism), whereas overriding is dynamic (runtime polymorphism).'
    }
  },
  {
    topic: 'Encapsulation',
    pattern: /encapsulation|getter|setter|private|public/i,
    misconception: 'Assuming encapsulation merely means adding boilerplate get/set methods to all variables.',
    explanation: 'Encapsulation is fundamentally about information hiding and maintaining invariants. Exposing unconditional setters for every private field violates encapsulation by allowing external entities to mutate internal state without validation.',
    followUp: {
      question_text: 'Why does providing public setters for all private fields weaken encapsulation?',
      options: [
        'It exposes internal mutable state without invariant validation or control.',
        'It prevents the class from being compiled into bytecode.',
        'It automatically forces all fields to become public static variables.',
        'It disables garbage collection for those fields.'
      ],
      correct_answer: 'It exposes internal mutable state without invariant validation or control.',
      explanation: 'Encapsulation preserves internal class contracts and validity rules, not just mechanical syntax.'
    }
  },
  {
    topic: 'Generics & Collections',
    pattern: /generic|collection|arraylist|type/i,
    misconception: 'Believing generic type arguments persist in raw bytecode at runtime.',
    explanation: 'Type erasure in languages like Java removes generic type parameters during compilation, replacing them with Object or bounds for backwards compatibility.',
    followUp: {
      question_text: 'What happens to Java generic type arguments (e.g., ArrayList<String>) at runtime?',
      options: [
        'They are removed due to type erasure and replaced by their bound or Object.',
        'They are preserved in full detail in the JVM heap space.',
        'They trigger runtime compilation errors if primitive types are referenced.',
        'They duplicate the bytecode class for each distinct type parameter.'
      ],
      correct_answer: 'They are removed due to type erasure and replaced by their bound or Object.',
      explanation: 'Type erasure ensures compatibility with pre-generics code.'
    }
  }
];

/**
 * Detect misconception for an incorrect answer
 */
export async function detectMisconception(
  attemptId: string,
  questionId: string,
  courseId: string,
  topic: string,
  questionText: string,
  userAnswer: string,
  correctAnswer: string
): Promise<Misconception> {
  // Check known patterns first
  const matched = KNOWN_MISCONCEPTIONS.find(
    k => k.topic.toLowerCase() === topic.toLowerCase() || k.pattern.test(questionText) || k.pattern.test(topic)
  );

  let misconceptionText = matched?.misconception || `General misunderstanding of ${topic} principles and evaluation criteria.`;
  let explanation = matched?.explanation || `The submitted answer contradicts key definitions in ${topic}. Review the course references to solidify understanding.`;
  let followUp = matched?.followUp || {
    question_text: `To verify your understanding of ${topic}: What is the primary characteristic or constraint that distinguishes it?`,
    options: [
      `It enforces strict modular separation and verified contracts as defined in course materials.`,
      `It bypasses standard checks and allows unvalidated mutations.`,
      `It is purely optional and has no architectural impact.`,
      `It is superseded by unchecked global variables.`
    ],
    correct_answer: `It enforces strict modular separation and verified contracts as defined in course materials.`,
    explanation: `Core principles in ${topic} emphasize modular structure and safety.`
  };

  // Enhance with course chunk citation if available
  const chunks = await retrieveRelevantChunks(topic, { courseId, limit: 1 });
  if (chunks.length > 0) {
    const chunk = chunks[0];
    explanation += `\n\nReference from ${chunk.citation.material_title} (${chunk.citation.unit_label}): "${chunk.citation.snippet}"`;
  }

  const misconceptionId = `misc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  execute(
    `INSERT INTO misconceptions (id, attempt_id, question_id, course_id, topic, misconception_text, evidence_explanation, follow_up_question_json, is_resolved, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
    [
      misconceptionId,
      attemptId,
      questionId,
      courseId,
      topic,
      misconceptionText,
      explanation,
      JSON.stringify(followUp),
    ]
  );

  return {
    id: misconceptionId,
    attempt_id: attemptId,
    question_id: questionId,
    topic,
    misconception_text: misconceptionText,
    evidence_explanation: explanation,
    follow_up_question: followUp,
    is_resolved: false,
    created_at: new Date().toISOString(),
  };
}

/**
 * Verify student answer to a misconception follow-up question
 */
export function verifyMisconceptionAnswer(
  misconceptionId: string,
  submittedAnswer: string
): { isCorrect: boolean; feedback: string; wasResolved: boolean } {
  const row = queryOne<any>(`SELECT * FROM misconceptions WHERE id = ?`, [misconceptionId]);
  if (!row) {
    throw new Error('Misconception record not found');
  }

  const followUp = JSON.parse(row.follow_up_question_json);
  const cleanSubmitted = (submittedAnswer || '').trim().toLowerCase();
  const cleanCorrect = (followUp.correct_answer || '').trim().toLowerCase();

  const isCorrect = cleanSubmitted === cleanCorrect || cleanSubmitted.includes(cleanCorrect) || cleanCorrect.includes(cleanSubmitted);

  if (isCorrect) {
    execute(
      `UPDATE misconceptions SET is_resolved = 1, resolved_at = datetime('now') WHERE id = ?`,
      [misconceptionId]
    );

    // Also update topic performance to reflect improvement
    const perf = queryOne<any>(
      `SELECT * FROM topic_performance WHERE course_id = ? AND topic = ?`,
      [row.course_id, row.topic]
    );
    if (perf) {
      const newCorrect = perf.correct_answers + 1;
      const newTotal = perf.total_questions + 1;
      const newAccuracy = Math.round((newCorrect / newTotal) * 100);
      execute(
        `UPDATE topic_performance 
         SET correct_answers = ?, total_questions = ?, accuracy = ?, last_practiced = datetime('now')
         WHERE id = ?`,
        [newCorrect, newTotal, newAccuracy, perf.id]
      );
    }
  }

  return {
    isCorrect,
    feedback: isCorrect
      ? `Outstanding! You successfully resolved this misconception. ${followUp.explanation}`
      : `Not quite. ${followUp.explanation}. Take another moment to review the source reference.`,
    wasResolved: isCorrect,
  };
}

/**
 * List all active and resolved misconceptions for a course
 */
export function listMisconceptions(courseId?: string, onlyUnresolved = false): Misconception[] {
  let sql = `SELECT * FROM misconceptions WHERE 1=1`;
  const params: any[] = [];

  if (courseId) {
    sql += ` AND course_id = ?`;
    params.push(courseId);
  }
  if (onlyUnresolved) {
    sql += ` AND is_resolved = 0`;
  }

  sql += ` ORDER BY created_at DESC LIMIT 20`;
  const rows = queryAll<any>(sql, params);

  return rows.map(r => ({
    id: r.id,
    attempt_id: r.attempt_id,
    question_id: r.question_id,
    topic: r.topic,
    misconception_text: r.misconception_text,
    evidence_explanation: r.evidence_explanation,
    follow_up_question: JSON.parse(r.follow_up_question_json),
    is_resolved: r.is_resolved === 1,
    resolved_at: r.resolved_at,
    created_at: r.created_at,
  }));
}

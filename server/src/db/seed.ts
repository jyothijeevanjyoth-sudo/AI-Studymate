import { initDatabase, execute, transaction } from './db.js';
import { indexBisModule } from '../scripts/index_bis.js';

export async function seedDatabase(): Promise<{ status: string; courses: number; materials: number; chunks: number }> {
  initDatabase();

  const courseId = 'crs_cs101_java';

  transaction(() => {
    // 1. Course
    execute(
      `INSERT INTO courses (id, code, title, description, created_at)
       VALUES (?, 'CS101', 'CS101: Object-Oriented Programming & Data Structures in Java', 'Comprehensive introduction to OOP, inheritance hierarchies, dynamic polymorphism, generics, and data structures in Java.', datetime('now'))
       ON CONFLICT(id) DO UPDATE SET title = excluded.title`,
      [courseId]
    );

    // 2. Materials
    const mat1Id = 'mat_textbook_ch4';
    const mat2Id = 'mat_slides_lec08';
    const mat3Id = 'mat_transcript_lec12';

    execute(
      `INSERT INTO learning_materials (id, course_id, title, file_name, file_type, file_path, file_size, processing_status, total_units, unit_type, created_at, updated_at)
       VALUES (?, ?, 'Java OOP Core Concepts — Textbook Ch. 4', 'Java_OOP_Textbook_Ch4.pdf', 'pdf', 'uploads/Java_OOP_Textbook_Ch4.pdf', 2450000, 'completed', 4, 'page', datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET title = excluded.title`,
      [mat1Id, courseId]
    );

    execute(
      `INSERT INTO learning_materials (id, course_id, title, file_name, file_type, file_path, file_size, processing_status, total_units, unit_type, created_at, updated_at)
       VALUES (?, ?, 'CS101 Lecture 08: Inheritance & Dynamic Polymorphism', 'CS101_Lecture08_Slides.pptx', 'pptx', 'uploads/CS101_Lecture08_Slides.pptx', 1820000, 'completed', 5, 'slide', datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET title = excluded.title`,
      [mat2Id, courseId]
    );

    execute(
      `INSERT INTO learning_materials (id, course_id, title, file_name, file_type, file_path, file_size, processing_status, total_units, unit_type, created_at, updated_at)
       VALUES (?, ?, 'CS101 Lecture 12: Generics & Collections Deep Dive', 'CS101_Lecture12_Transcript.vtt', 'transcript', 'uploads/CS101_Lecture12_Transcript.vtt', 42000, 'completed', 4, 'timestamp', datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET title = excluded.title`,
      [mat3Id, courseId]
    );

    // 3. Clear existing demo chunks for clean seeding
    execute(`DELETE FROM document_chunks WHERE material_id IN (?, ?, ?)`, [mat1Id, mat2Id, mat3Id]);

    // Insert Textbook PDF Chunks (Pages 1 - 4)
    execute(
      `INSERT INTO document_chunks (id, material_id, course_id, chunk_index, content, page_num, unit_label, topic, created_at)
       VALUES 
       (
         'chk_tb_1', '${mat1Id}', '${courseId}', 1,
         'Encapsulation is the fundamental object-oriented technique of binding data members and associated member methods into a unified class structure while shielding internal state from arbitrary outside alteration. In Java, this is realized by marking state fields with the private access modifier and offering controlled public accessor methods (getters and setters) with defensive state validation.',
         1, 'Page 1', 'Encapsulation', datetime('now')
       ),
       (
         'chk_tb_2', '${mat1Id}', '${courseId}', 2,
         'Inheritance enables hierarchical class relationships through the extends keyword. A subclass inherits accessible members from its superclass. However, private fields of the superclass are NEVER directly accessible by subclass methods. The subclass must invoke super() within its constructor to properly initialize superclass state before configuring its own properties.',
         2, 'Page 2', 'Inheritance', datetime('now')
       ),
       (
         'chk_tb_3', '${mat1Id}', '${courseId}', 3,
         'Abstract classes and Interfaces define structural behavioral contracts. While an abstract class may maintain state and partial method implementations, a Java Interface provides pure functional contracts. A single class may implement multiple interfaces, allowing Java to support multiple behavioral inheritance without the diamond problem of multiple state inheritance.',
         3, 'Page 3', 'Interfaces & Abstract Classes', datetime('now')
       ),
       (
         'chk_tb_4', '${mat1Id}', '${courseId}', 4,
         'Exception Handling guarantees robust program termination and error recovery. In Java, exceptions derive from java.lang.Throwable. Checked exceptions must be explicitly declared in the method signature with throws or enclosed in a try-catch-finally block, ensuring reliable resource deallocation even when runtime errors emerge.',
         4, 'Page 4', 'Exception Handling', datetime('now')
       )`
    );

    // Insert Slides PPTX Chunks (Slides 1 - 5)
    execute(
      `INSERT INTO document_chunks (id, material_id, course_id, chunk_index, content, slide_num, unit_label, topic, created_at)
       VALUES 
       (
         'chk_sl_1', '${mat2Id}', '${courseId}', 1,
         'Polymorphism represents the ability of different classes to respond to the same method invocation with custom runtime behaviors. In Java, dynamic method dispatch uses the actual runtime object type rather than the reference type to determine which overridden method to execute.',
         1, 'Slide 1', 'Polymorphism', datetime('now')
       ),
       (
         'chk_sl_2', '${mat2Id}', '${courseId}', 2,
         'Method Overloading vs Overriding: Method overloading occurs within a single class or hierarchy where methods share the same name but differ in parameter count or parameter types, resolved at compile-time. Method overriding occurs when a subclass re-implements a parent method with identical parameter signatures, resolved dynamically at runtime.',
         2, 'Slide 2', 'Polymorphism', datetime('now')
       ),
       (
         'chk_sl_3', '${mat2Id}', '${courseId}', 3,
         'Superclass Constructor Chaining: When a subclass object is instantiated, the superclass constructor executes first. If super() is not explicitly written on the first line of the child constructor, the Java compiler automatically inserts a parameterless super() call.',
         3, 'Slide 3', 'Inheritance', datetime('now')
       ),
       (
         'chk_sl_4', '${mat2Id}', '${courseId}', 4,
         'Type Casting in Hierarchies: Upcasting from subclass to superclass reference is always implicit and type-safe. Downcasting from a superclass reference to a subclass type requires explicit casting and should be protected with the instanceof operator to prevent ClassCastException at runtime.',
         4, 'Slide 4', 'Polymorphism', datetime('now')
       ),
       (
         'chk_sl_5', '${mat2Id}', '${courseId}', 5,
         'Design Principle: Favor Composition Over Inheritance. Inheritance introduces tight coupling where alterations in the superclass inadvertently break subclass invariants. Composition wraps referenced components, offering greater flexibility and loose coupling.',
         5, 'Slide 5', 'Inheritance', datetime('now')
       )`
    );

    // Insert Transcript Chunks (Timestamps)
    execute(
      `INSERT INTO document_chunks (id, material_id, course_id, chunk_index, content, timestamp_val, unit_label, topic, created_at)
       VALUES 
       (
         'chk_tr_1', '${mat3Id}', '${courseId}', 1,
         '[00:00] In this lecture, we explore Java Generics and Collections framework. Generics provide compile-time type safety by restricting container elements, preventing runtime ClassCastException that plagued earlier versions of Java.',
         '00:00', '00:00', 'Generics & Collections', datetime('now')
       ),
       (
         'chk_tr_2', '${mat3Id}', '${courseId}', 2,
         '[02:30] A crucial architectural concept is Generic Type Erasure. The Java compiler replaces generic type parameters with their bounds (or Object) during compilation. Consequently, at runtime, the JVM has no knowledge of generic type arguments.',
         '02:30', '02:30', 'Generics & Collections', datetime('now')
       ),
       (
         'chk_tr_3', '${mat3Id}', '${courseId}', 3,
         '[05:15] Comparing ArrayList versus LinkedList: ArrayList utilizes a contiguous resizable array with O(1) random index access and O(n) insertions in the middle. LinkedList utilizes doubly-linked node pointers with O(1) insertions at the head or tail but O(n) element search.',
         '05:15', '05:15', 'Generics & Collections', datetime('now')
       ),
       (
         'chk_tr_4', '${mat3Id}', '${courseId}', 4,
         '[09:40] Let us review Time Complexity across Maps and Sets. HashMap provides amortized O(1) key lookups via hashing with bucket chaining. TreeMap provides O(log n) guarantees using a self-balancing Red-Black binary search tree.',
         '09:40', '09:40', 'Generics & Collections', datetime('now')
       )`
    );

    // 4. Seed Topic Performance with real differentiation (Weak Topic: Inheritance)
    execute(`DELETE FROM topic_performance WHERE course_id = ?`, [courseId]);

    execute(
      `INSERT INTO topic_performance (id, course_id, topic, total_questions, correct_answers, accuracy, status, recommended_difficulty, last_practiced)
       VALUES 
       ('perf_1', '${courseId}', 'Encapsulation', 5, 4, 80.0, 'mastered', 'advanced', datetime('now', '-2 days')),
       ('perf_2', '${courseId}', 'Polymorphism', 4, 3, 75.0, 'practicing', 'intermediate', datetime('now', '-1 days')),
       ('perf_3', '${courseId}', 'Inheritance', 3, 1, 33.0, 'needs_improvement', 'beginner', datetime('now')),
       ('perf_4', '${courseId}', 'Generics & Collections', 2, 2, 100.0, 'practicing', 'intermediate', datetime('now', '-3 days'))`
    );

    // 5. Seed a Sample Quiz with questions linked to real sources
    const quizId = 'quiz_cs101_sample';
    execute(`DELETE FROM quizzes WHERE id = ?`, [quizId]);

    execute(
      `INSERT INTO quizzes (id, course_id, title, topic, difficulty, questions_count, is_adaptive, created_at)
       VALUES ('${quizId}', '${courseId}', 'CS101 OOP Diagnostic Quiz', 'Object-Oriented Programming', 'intermediate', 3, 1, datetime('now'))`
    );

    execute(`DELETE FROM quiz_questions WHERE quiz_id = ?`, [quizId]);

    execute(
      `INSERT INTO quiz_questions (id, quiz_id, question_text, question_type, options_json, correct_answer, explanation, topic, difficulty, citation_json)
       VALUES 
       (
         'q_sample_1', '${quizId}',
         'According to Java OOP Core Concepts (Page 2), how can a subclass access private variables defined in its superclass?',
         'multiple_choice',
         '["It cannot access them directly; it must use public or protected accessor methods.", "By using the super.variableName syntax directly.", "By re-declaring the variables with the public modifier.", "Subclasses automatically gain direct access to all private members."]',
         'It cannot access them directly; it must use public or protected accessor methods.',
         'Page 2 of the textbook states: "private fields of the superclass are NEVER directly accessible by subclass methods. The subclass must invoke super() or use accessors."',
         'Inheritance', 'beginner',
         '{"material_id":"${mat1Id}","material_title":"Java OOP Core Concepts — Textbook Ch. 4","file_type":"pdf","page":2,"unit_label":"Page 2","snippet":"private fields of the superclass are NEVER directly accessible by subclass methods."}'
       ),
       (
         'q_sample_2', '${quizId}',
         'According to CS101 Lecture 08 Slides (Slide 2), what is the key difference between method overloading and method overriding?',
         'multiple_choice',
         '["Overloading is resolved at compile time with different parameter lists; overriding is resolved dynamically at runtime.", "Overloading requires inheritance, while overriding occurs within the same class.", "Both are resolved at runtime based on the return type.", "Overriding only applies to private methods."]',
         'Overloading is resolved at compile time with different parameter lists; overriding is resolved dynamically at runtime.',
         'Slide 2 defines: "Overloading occurs when methods share the same name but differ in parameter count or types, resolved at compile-time. Overriding occurs when a subclass re-implements a parent method, resolved dynamically at runtime."',
         'Polymorphism', 'intermediate',
         '{"material_id":"${mat2Id}","material_title":"CS101 Lecture 08: Inheritance & Dynamic Polymorphism","file_type":"pptx","slide":2,"unit_label":"Slide 2","snippet":"Overloading is resolved at compile-time. Overriding is resolved dynamically at runtime."}'
       ),
       (
         'q_sample_3', '${quizId}',
         'According to CS101 Lecture 12 Transcript (02:30), what mechanism causes generic type parameters to be absent at runtime in Java?',
         'multiple_choice',
         '["Generic Type Erasure", "Dynamic Memory Virtualization", "Static Pointer Deallocation", "Bytecode Reflection"]',
         'Generic Type Erasure',
         'Transcript timestamp 02:30 explains: "The Java compiler replaces generic type parameters with their bounds (or Object) during compilation via Generic Type Erasure."',
         'Generics & Collections', 'intermediate',
         '{"material_id":"${mat3Id}","material_title":"CS101 Lecture 12: Generics & Collections Deep Dive","file_type":"transcript","timestamp":"02:30","unit_label":"02:30","snippet":"The Java compiler replaces generic type parameters with their bounds during compilation via Generic Type Erasure."}'
       )`
    );

    // 6. Seed an Initial Completed Attempt to show dashboard stats
    const attemptId = 'att_sample_seed';
    execute(`DELETE FROM quiz_attempts WHERE id = ?`, [attemptId]);

    execute(
      `INSERT INTO quiz_attempts (id, quiz_id, score, total_questions, percentage, passed, time_taken_seconds, completed_at)
       VALUES ('${attemptId}', '${quizId}', 2, 3, 66.7, 0, 180, datetime('now', '-1 days'))`
    );

    // 7. Seed an Active Misconception on Inheritance
    execute(`DELETE FROM misconceptions WHERE course_id = ?`, [courseId]);

    execute(
      `INSERT INTO misconceptions (id, attempt_id, question_id, course_id, topic, misconception_text, evidence_explanation, follow_up_question_json, is_resolved, created_at)
       VALUES (
         'misc_seed_1', '${attemptId}', 'q_sample_1', '${courseId}', 'Inheritance',
         'Believing child classes automatically acquire access to private fields or constructors of the parent class.',
         'In Object-Oriented design, private members of a parent class are NOT accessible directly by subclasses. Subclasses must use public or protected getter/setter methods. Cited in Java OOP Textbook (Page 2).',
         '{"question_text":"Can a subclass in Java directly access a private variable declared in its superclass?","options":["No, private variables are restricted to the declaring class; the subclass must use public/protected accessors.","Yes, any extends relationship grants unrestricted direct access to private members.","Yes, but only if the subclass is in the same package.","No, unless the subclass uses the global import keyword."],"correct_answer":"No, private variables are restricted to the declaring class; the subclass must use public/protected accessors.","explanation":"Encapsulation restricts direct private field access even across inheritance hierarchies."}',
         0, datetime('now', '-1 days')
       )`
    );

    // 8. Seed Study Sessions for Study Time Tracker
    execute(`DELETE FROM study_sessions WHERE course_id = ?`, [courseId]);

    execute(
      `INSERT INTO study_sessions (id, course_id, duration_seconds, duration_minutes, session_type, notes, started_at, ended_at, created_at)
       VALUES 
       ('sess_1', '${courseId}', 1800, 30, 'platform', 'Reviewed Textbook Ch. 4 Encapsulation & Page 1 notes', datetime('now', '-2 days'), datetime('now', '-2 days', '+30 minutes'), datetime('now', '-2 days')),
       ('sess_2', '${courseId}', 2700, 45, 'platform', 'Watched Lecture 08 Slides on Polymorphism & took diagnostic quiz', datetime('now', '-1 days'), datetime('now', '-1 days', '+45 minutes'), datetime('now', '-1 days')),
       ('sess_3', '${courseId}', 1200, 20, 'offline_logged', 'Read textbook offline for Inheritance review', datetime('now', '-4 hours'), datetime('now', '-3 hours', '+40 minutes'), datetime('now', '-4 hours'))`
    );

    // 9. Seed an Initial Study Plan
    const planId = 'plan_cs101_initial';
    execute(`DELETE FROM study_plans WHERE course_id = ?`, [courseId]);

    execute(
      `INSERT INTO study_plans (id, course_id, daily_goal_minutes, target_date, created_at, updated_at)
       VALUES ('${planId}', '${courseId}', 30, date('now', '+7 days'), datetime('now'), datetime('now'))`
    );

    execute(`DELETE FROM study_plan_activities WHERE plan_id = ?`, [planId]);

    execute(
      `INSERT INTO study_plan_activities (id, plan_id, topic, title, description, activity_type, material_id, unit_reference, estimated_minutes, priority, is_completed)
       VALUES 
       (
         'act_seed_1', '${planId}', 'Inheritance',
         'Review Core Concept: Inheritance & Constructor Chaining',
         'Revisit Java OOP Core Concepts (Page 2) & Lecture 08 Slides (Slide 3). Focus on constructor chaining with super() and access restrictions.',
         'review_material', '${mat1Id}', 'Page 2', 15, 'high', 0
       ),
       (
         'act_seed_2', '${planId}', 'Inheritance',
         'Take Foundational Quiz: Inheritance',
         'Complete a targeted diagnostic quiz on Inheritance to address identified misconception about private superclass variables.',
         'practice_quiz', NULL, NULL, 10, 'high', 0
       ),
       (
         'act_seed_3', '${planId}', 'Polymorphism',
         'Deep-Dive with AI Tutor: Dynamic Method Dispatch',
         'Ask the AI Tutor for analogies contrasting compile-time overloading with runtime method overriding in Java.',
         'ask_tutor', '${mat2Id}', 'Slide 2', 15, 'medium', 0
       )`
    );
  });

  // Ensure any uploaded modules (e.g. BIS701 Module 2) are indexed
  await indexBisModule();

  return {
    status: 'success',
    courses: 1,
    materials: 3,
    chunks: 13,
  };
}

// Auto-run if executed directly via node/tsx
if (process.argv[1]?.includes('seed')) {
  seedDatabase().then(res => {
    console.log('[Seed] Database successfully seeded with sample demo course and materials:', res);
  }).catch(err => {
    console.error('[Seed] Error seeding database:', err);
  });
}

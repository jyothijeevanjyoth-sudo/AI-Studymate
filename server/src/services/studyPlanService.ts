import { queryAll, queryOne, execute, transaction } from '../db/db.js';
import { getTopicPerformance } from './analyticsService.js';
import { StudyPlan, StudyPlanActivity } from '../../../shared/types.js';

export interface GeneratePlanOptions {
  courseId: string;
  dailyGoalMinutes?: number;
  targetDate?: string;
}

/**
 * Generate a personalized study plan dynamically based on weak topics and available materials
 */
export async function generatePersonalizedStudyPlan(options: GeneratePlanOptions): Promise<StudyPlan> {
  const dailyGoal = options.dailyGoalMinutes || 30;
  const courseId = options.courseId;

  // Retrieve topic performance
  const topics = getTopicPerformance(courseId);
  const weakTopics = topics.filter(t => t.status === 'needs_improvement');
  const practicingTopics = topics.filter(t => t.status === 'practicing');

  // Retrieve materials for this course to link activities directly to sources
  const materials = queryAll<any>(
    `SELECT id, title, file_type, total_units, unit_type FROM learning_materials WHERE course_id = ?`,
    [courseId]
  );

  const planId = `plan_${courseId}_${Date.now()}`;
  const activities: StudyPlanActivity[] = [];

  let totalMinutesAllocated = 0;

  // 1. High priority tasks for Weak Topics
  for (const wt of weakTopics) {
    if (totalMinutesAllocated >= dailyGoal * 2) break;

    // Find any material chunk referencing this topic
    const chunk = queryOne<any>(
      `SELECT m.id as material_id, m.title as material_title, c.unit_label
       FROM document_chunks c
       JOIN learning_materials m ON c.material_id = m.id
       WHERE c.course_id = ? AND c.topic = ?
       LIMIT 1`,
      [courseId, wt.topic]
    );

    const matTitle = chunk ? chunk.material_title : (materials[0]?.title || 'Course Textbook');
    const unitRef = chunk ? chunk.unit_label : 'Core Chapter';

    // Activity A: Review Source Material
    activities.push({
      id: `act_${Date.now()}_${activities.length + 1}`,
      topic: wt.topic,
      title: `Review Core Concept: ${wt.topic}`,
      description: `Revisit ${matTitle} (${unitRef}). Focus on the definitions, constraints, and syntax errors made during recent quizzes.`,
      activity_type: 'review_material',
      material_id: chunk?.material_id || materials[0]?.id,
      material_title: matTitle,
      unit_reference: unitRef,
      estimated_minutes: 15,
      priority: 'high',
      is_completed: false,
    });
    totalMinutesAllocated += 15;

    // Activity B: Practice Foundational Quiz
    activities.push({
      id: `act_${Date.now()}_${activities.length + 1}`,
      topic: wt.topic,
      title: `Take Foundational Quiz: ${wt.topic}`,
      description: `Complete a 3-question beginner quiz on ${wt.topic} to re-evaluate comprehension and improve topic accuracy.`,
      activity_type: 'practice_quiz',
      estimated_minutes: 10,
      priority: 'high',
      is_completed: false,
    });
    totalMinutesAllocated += 10;
  }

  // 2. Medium priority tasks for Practicing Topics
  for (const pt of practicingTopics) {
    if (totalMinutesAllocated >= dailyGoal * 3) break;

    activities.push({
      id: `act_${Date.now()}_${activities.length + 1}`,
      topic: pt.topic,
      title: `Deep-Dive with AI Tutor: ${pt.topic}`,
      description: `Ask the AI Tutor for step-by-step analogies and edge cases regarding ${pt.topic} to move accuracy past 80%.`,
      activity_type: 'ask_tutor',
      estimated_minutes: 15,
      priority: 'medium',
      is_completed: false,
    });
    totalMinutesAllocated += 15;
  }

  // 3. Fallback general activity if no weak topics yet
  if (activities.length === 0) {
    const mat = materials[0];
    activities.push({
      id: `act_${Date.now()}_1`,
      topic: 'Comprehensive Review',
      title: 'Review Initial Course Notes',
      description: `Read the introductory materials in ${mat?.title || 'Course Syllabus'} and ask the AI Tutor 3 clarifying questions.`,
      activity_type: 'review_material',
      material_id: mat?.id,
      material_title: mat?.title,
      unit_reference: 'Section 1',
      estimated_minutes: 20,
      priority: 'medium',
      is_completed: false,
    });
    activities.push({
      id: `act_${Date.now()}_2`,
      topic: 'Diagnostic Quiz',
      title: 'Complete Baseline Diagnostic Quiz',
      description: 'Take a mixed 5-question quiz to establish your personalized topic strengths and weaknesses.',
      activity_type: 'practice_quiz',
      estimated_minutes: 15,
      priority: 'high',
      is_completed: false,
    });
  }

  // Save to database
  transaction(() => {
    // Delete any old incomplete plan for this course
    execute(`DELETE FROM study_plans WHERE course_id = ?`, [courseId]);

    execute(
      `INSERT INTO study_plans (id, course_id, daily_goal_minutes, target_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [planId, courseId, dailyGoal, options.targetDate || null]
    );

    for (const act of activities) {
      execute(
        `INSERT INTO study_plan_activities (id, plan_id, topic, title, description, activity_type, material_id, unit_reference, estimated_minutes, priority, is_completed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          act.id,
          planId,
          act.topic,
          act.title,
          act.description,
          act.activity_type,
          act.material_id || null,
          act.unit_reference || null,
          act.estimated_minutes,
          act.priority,
        ]
      );
    }
  });

  return {
    id: planId,
    course_id: courseId,
    daily_goal_minutes: dailyGoal,
    target_date: options.targetDate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    activities,
  };
}

/**
 * Retrieve the active study plan for a course
 */
export function getActiveStudyPlan(courseId: string): StudyPlan | null {
  const plan = queryOne<any>(
    `SELECT * FROM study_plans WHERE course_id = ? ORDER BY created_at DESC LIMIT 1`,
    [courseId]
  );

  if (!plan) return null;

  const activities = queryAll<any>(
    `SELECT a.*, m.title as material_title
     FROM study_plan_activities a
     LEFT JOIN learning_materials m ON a.material_id = m.id
     WHERE a.plan_id = ?
     ORDER BY CASE a.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, a.id ASC`,
    [plan.id]
  );

  return {
    id: plan.id,
    course_id: plan.course_id,
    daily_goal_minutes: plan.daily_goal_minutes,
    target_date: plan.target_date,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
    activities: activities.map(a => ({
      id: a.id,
      topic: a.topic,
      title: a.title,
      description: a.description,
      activity_type: a.activity_type,
      material_id: a.material_id,
      material_title: a.material_title,
      unit_reference: a.unit_reference,
      estimated_minutes: a.estimated_minutes,
      priority: a.priority,
      is_completed: a.is_completed === 1,
      completed_at: a.completed_at,
    })),
  };
}

/**
 * Toggle or set activity completion
 */
export function toggleActivityCompletion(activityId: string, completed?: boolean): boolean {
  const current = queryOne<any>(`SELECT is_completed FROM study_plan_activities WHERE id = ?`, [activityId]);
  if (!current) return false;

  const nextState = completed !== undefined ? completed : current.is_completed === 0;
  execute(
    `UPDATE study_plan_activities 
     SET is_completed = ?, completed_at = ?
     WHERE id = ?`,
    [nextState ? 1 : 0, nextState ? new Date().toISOString() : null, activityId]
  );
  return true;
}

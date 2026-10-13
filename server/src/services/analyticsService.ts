import { queryAll, queryOne } from '../db/db.js';
import { DashboardStats, TopicPerformance, TopicStatus, Difficulty } from '../../../shared/types.js';

/**
 * Get comprehensive topic performance list for a course
 */
export function getTopicPerformance(courseId?: string): TopicPerformance[] {
  let sql = `SELECT * FROM topic_performance WHERE 1=1`;
  const params: any[] = [];

  if (courseId) {
    sql += ` AND course_id = ?`;
    params.push(courseId);
  }

  sql += ` ORDER BY accuracy ASC, total_questions DESC`;
  const rows = queryAll<any>(sql, params);

  return rows.map(r => ({
    topic: r.topic,
    course_id: r.course_id,
    total_questions: r.total_questions,
    correct_answers: r.correct_answers,
    accuracy: Math.round(r.accuracy),
    status: r.status as TopicStatus,
    recommended_difficulty: r.recommended_difficulty as Difficulty,
    last_practiced: r.last_practiced,
  }));
}

/**
 * Compute real-time dashboard statistics from SQLite tables
 */
export function getDashboardStats(courseId?: string): DashboardStats {
  const courseFilter = courseId ? `WHERE course_id = ?` : ``;
  const courseParams = courseId ? [courseId] : [];

  // 1. Total uploaded learning materials
  const matRow = queryOne<any>(
    `SELECT COUNT(*) as count FROM learning_materials ${courseFilter}`,
    courseParams
  );
  const totalResources = matRow?.count || 0;

  // 2. Quiz attempts and overall accuracy
  let attemptSql = `
    SELECT 
      COUNT(qa.id) as attempts_count,
      COALESCE(AVG(qa.percentage), 0) as avg_accuracy,
      COALESCE(SUM(qa.time_taken_seconds), 0) as total_seconds
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
  `;
  if (courseId) {
    attemptSql += ` WHERE q.course_id = ?`;
  }

  const attemptRow = queryOne<any>(attemptSql, courseParams);
  const studySessions = attemptRow?.attempts_count || 0;
  const avgAccuracy = Math.round(attemptRow?.avg_accuracy || 0);
  const totalStudyMinutes = Math.max(15 * studySessions, Math.round((attemptRow?.total_seconds || 0) / 60));

  // 3. Topic mastery counts
  const topics = getTopicPerformance(courseId);
  const masteredTopics = topics.filter(t => t.status === 'mastered').map(t => t.topic);
  const weakTopics = topics.filter(t => t.status === 'needs_improvement').map(t => t.topic);

  // 4. Progress history (attempts over time)
  let historySql = `
    SELECT 
      strftime('%Y-%m-%d', qa.completed_at) as date,
      ROUND(AVG(qa.percentage)) as accuracy,
      COUNT(qa.id) as quizzes
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
  `;
  if (courseId) {
    historySql += ` WHERE q.course_id = ?`;
  }
  historySql += ` GROUP BY strftime('%Y-%m-%d', qa.completed_at) ORDER BY date ASC LIMIT 10`;

  const historyRows = queryAll<any>(historySql, courseParams);

  // 5. Recent Activity Feed
  const recentActivities: DashboardStats['recent_activity'] = [];

  // Recent uploads
  let recentUploadsSql = `SELECT id, title, file_type, created_at FROM learning_materials`;
  if (courseId) recentUploadsSql += ` WHERE course_id = ?`;
  recentUploadsSql += ` ORDER BY created_at DESC LIMIT 3`;
  const recentUploads = queryAll<any>(recentUploadsSql, courseParams);
  for (const u of recentUploads) {
    recentActivities.push({
      id: `act_up_${u.id}`,
      type: 'upload',
      title: `Uploaded ${u.title}`,
      description: `Format: ${u.file_type.toUpperCase()} · Processed into source knowledge base`,
      timestamp: u.created_at,
    });
  }

  // Recent quiz attempts
  let recentAttemptsSql = `
    SELECT qa.id, qa.percentage, qa.completed_at, q.title as quiz_title
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
  `;
  if (courseId) recentAttemptsSql += ` WHERE q.course_id = ?`;
  recentAttemptsSql += ` ORDER BY qa.completed_at DESC LIMIT 3`;
  const recentAttempts = queryAll<any>(recentAttemptsSql, courseParams);
  for (const a of recentAttempts) {
    recentActivities.push({
      id: `act_qz_${a.id}`,
      type: 'quiz',
      title: `Completed ${a.quiz_title}`,
      description: `Score: ${a.percentage}% · Adaptive profile updated`,
      timestamp: a.completed_at,
    });
  }

  recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // 6. Recommended next learning task based on real weak topics
  let recommendedTask: DashboardStats['recommended_task'] = {
    title: 'Review Foundations',
    topic: 'Core Concepts',
    reason: 'Start by uploading syllabus slides or taking a diagnostic review.',
    action_type: 'quiz',
  };

  if (weakTopics.length > 0) {
    const weakest = weakTopics[0];
    recommendedTask = {
      title: `Targeted Revision: ${weakest}`,
      topic: weakest,
      reason: `Accuracy is below 50% on this topic. Recommended: review source materials and take foundational practice.`,
      action_type: 'quiz',
    };
  } else if (topics.length > 0 && masteredTopics.length < topics.length) {
    const practicing = topics.find(t => t.status === 'practicing') || topics[0];
    recommendedTask = {
      title: `Advance Mastery: ${practicing.topic}`,
      topic: practicing.topic,
      reason: `Current accuracy is ${practicing.accuracy}%. Complete an intermediate quiz to advance to Mastered status.`,
      action_type: 'quiz',
    };
  } else if (masteredTopics.length > 0) {
    recommendedTask = {
      title: `Challenge Assessment`,
      topic: masteredTopics[0],
      reason: `You have mastered all attempted topics! Test your depth with advanced multi-topic problems.`,
      action_type: 'tutor',
    };
  }

  return {
    total_resources: totalResources,
    study_sessions_completed: studySessions,
    total_study_minutes: totalStudyMinutes,
    overall_quiz_accuracy: avgAccuracy,
    topics_mastered_count: masteredTopics.length,
    topics_needing_improvement_count: weakTopics.length,
    mastered_topics: masteredTopics,
    weak_topics: weakTopics,
    recent_activity: recentActivities.slice(0, 6),
    recommended_task: recommendedTask,
    progress_history: historyRows.map(h => ({
      date: h.date,
      accuracy: h.accuracy,
      quizzes: h.quizzes,
    })),
  };
}

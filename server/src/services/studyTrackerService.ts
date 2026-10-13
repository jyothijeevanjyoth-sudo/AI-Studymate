import { queryAll, queryOne, execute } from '../db/db.js';
import { StudySession, StudyTimeStats } from '../../../shared/types.js';

export interface RecordSessionInput {
  courseId: string;
  durationSeconds: number;
  sessionType?: 'platform' | 'offline_logged';
  notes?: string;
  startedAt?: string;
  endedAt?: string;
}

/**
 * Record a completed study session with strict validation
 */
export function recordStudySession(input: RecordSessionInput): StudySession {
  // Prevent duplicate timers or invalid duration calculations
  if (input.durationSeconds <= 0) {
    throw new Error('Study duration must be greater than 0 seconds.');
  }
  if (input.durationSeconds > 86400) {
    throw new Error('Study duration cannot exceed 24 hours in a single session.');
  }

  const durationMinutes = Math.max(1, Math.round(input.durationSeconds / 60));
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const startedAt = input.startedAt || new Date(Date.now() - input.durationSeconds * 1000).toISOString();
  const endedAt = input.endedAt || new Date().toISOString();
  const sessionType = input.sessionType || 'platform';

  execute(
    `INSERT INTO study_sessions (id, course_id, duration_seconds, duration_minutes, session_type, notes, started_at, ended_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      sessionId,
      input.courseId,
      input.durationSeconds,
      durationMinutes,
      sessionType,
      input.notes || null,
      startedAt,
      endedAt,
    ]
  );

  const course = queryOne<any>(`SELECT title FROM courses WHERE id = ?`, [input.courseId]);

  return {
    id: sessionId,
    course_id: input.courseId,
    course_title: course?.title || 'General Course',
    duration_seconds: input.durationSeconds,
    duration_minutes: durationMinutes,
    session_type: sessionType,
    notes: input.notes,
    started_at: startedAt,
    ended_at: endedAt,
    created_at: new Date().toISOString(),
  };
}

/**
 * Compute daily, weekly, and subject-wise study time statistics
 */
export function getStudyTimeStats(courseId?: string): StudyTimeStats {
  const courseFilter = courseId ? `AND s.course_id = ?` : ``;
  const courseParams = courseId ? [courseId] : [];

  // Today's total (UTC/Local day)
  const todayRow = queryOne<any>(
    `SELECT COALESCE(SUM(duration_minutes), 0) as total_min 
     FROM study_sessions s 
     WHERE date(s.started_at) = date('now') ${courseFilter}`,
    courseParams
  );
  const todayMinutes = todayRow?.total_min || 0;

  // Past 7 days total
  const weekRow = queryOne<any>(
    `SELECT COALESCE(SUM(duration_minutes), 0) as total_min 
     FROM study_sessions s 
     WHERE s.started_at >= datetime('now', '-7 days') ${courseFilter}`,
    courseParams
  );
  const weekMinutes = weekRow?.total_min || 0;

  // Overall total
  const totalRow = queryOne<any>(
    `SELECT COALESCE(SUM(duration_minutes), 0) as total_min 
     FROM study_sessions s 
     WHERE 1=1 ${courseFilter}`,
    courseParams
  );
  const totalMinutes = totalRow?.total_min || 0;

  // Subject breakdown
  const breakdownRows = queryAll<any>(
    `SELECT c.id as course_id, c.title as course_title, COALESCE(SUM(s.duration_minutes), 0) as minutes
     FROM courses c
     JOIN study_sessions s ON c.id = s.course_id
     GROUP BY c.id, c.title
     ORDER BY minutes DESC`
  );

  // Recent 10 sessions
  let recentSql = `
    SELECT s.*, c.title as course_title
    FROM study_sessions s
    LEFT JOIN courses c ON s.course_id = c.id
    WHERE 1=1 ${courseFilter}
    ORDER BY s.started_at DESC
    LIMIT 10
  `;
  const sessionRows = queryAll<any>(recentSql, courseParams);

  return {
    today_minutes: todayMinutes,
    week_minutes: weekMinutes,
    total_minutes: totalMinutes,
    subject_breakdown: breakdownRows.map(b => ({
      course_id: b.course_id,
      course_title: b.course_title,
      minutes: b.minutes,
    })),
    recent_sessions: sessionRows.map(s => ({
      id: s.id,
      course_id: s.course_id,
      course_title: s.course_title,
      duration_seconds: s.duration_seconds,
      duration_minutes: s.duration_minutes,
      session_type: s.session_type,
      notes: s.notes,
      started_at: s.started_at,
      ended_at: s.ended_at,
      created_at: s.created_at,
    })),
  };
}

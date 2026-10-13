import React, { useState, useEffect } from 'react';
import { useCourse } from '../context/CourseContext';
import { useStudyTimer } from '../context/StudyTimerContext';
import { api } from '../api/client';
import { StudyTimeStats } from '../../../shared/types';
import {
  Clock,
  Play,
  Pause,
  Square,
  RotateCcw,
  BookOpen,
  Calendar,
  CheckCircle,
  PlusCircle,
  BarChart2,
} from 'lucide-react';

export const StudyTrackerPage: React.FC = () => {
  const { selectedCourse, courses } = useCourse();
  const { status, formattedTime, startTimer, pauseTimer, resumeTimer, stopTimer, resetTimer } =
    useStudyTimer();

  const [stats, setStats] = useState<StudyTimeStats | null>(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [offlineCourseId, setOfflineCourseId] = useState('');
  const [offlineMinutes, setOfflineMinutes] = useState(30);
  const [offlineNotes, setOfflineNotes] = useState('');
  const [submittingOffline, setSubmittingOffline] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      const data = await api.getStudyTrackerStats(selectedCourse?.id);
      setStats(data);
    } catch (err) {
      console.error('Failed to load study tracker stats:', err);
    }
  };

  useEffect(() => {
    loadStats();
    if (selectedCourse) setOfflineCourseId(selectedCourse.id);
  }, [selectedCourse]);

  const handleStopLiveSession = async () => {
    const res = await stopTimer(sessionNotes);
    if (res.success) {
      setActionMsg(`Recorded ${res.durationMinutes} minute live platform study session!`);
      setSessionNotes('');
      loadStats();
      setTimeout(() => setActionMsg(null), 3500);
    }
  };

  const handleLogOffline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offlineCourseId || offlineMinutes <= 0) return;

    setSubmittingOffline(true);
    try {
      await api.recordStudySession({
        courseId: offlineCourseId,
        durationSeconds: offlineMinutes * 60,
        sessionType: 'offline_logged',
        notes: offlineNotes || 'Offline textbook/homework study',
      });
      setActionMsg(`Successfully logged ${offlineMinutes} minutes of offline study.`);
      setOfflineNotes('');
      loadStats();
      setTimeout(() => setActionMsg(null), 3500);
    } catch (err: any) {
      alert(`Could not log offline study: ${err.message}`);
    } finally {
      setSubmittingOffline(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
          Productivity & Learning Habits
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
          Daily Study Time Tracker
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Real-time stopwatch and session logger. Preserves session status across browser refreshes.
        </p>
      </div>

      {actionMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
          <CheckCircle className="h-4 w-4" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Primary 3 Totals Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Today */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Today's Tracked Time
          </span>
          <p className="mt-2 text-3xl font-bold text-indigo-600">
            {stats?.today_minutes || 0} <span className="text-sm font-normal text-slate-500">mins</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Platform and logged sessions</p>
        </div>

        {/* This Week */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Past 7 Days
          </span>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {stats?.week_minutes || 0} <span className="text-sm font-normal text-slate-500">mins</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Weekly accumulated learning</p>
        </div>

        {/* All-Time */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            All-Time Platform Total
          </span>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {stats?.total_minutes || 0} <span className="text-sm font-normal text-slate-500">mins</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Total verified investment</p>
        </div>
      </div>

      {/* Interactive Stopwatch Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Stopwatch Card */}
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-white p-8 shadow-xs flex flex-col items-center justify-center text-center">
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 mb-4">
            Live Learning Stopwatch
          </span>

          {/* Clock Display */}
          <div className="font-mono text-5xl font-bold tracking-tight text-slate-900 mb-2">
            {formattedTime}
          </div>
          <p className="text-xs text-slate-500 mb-6">
            Course:{' '}
            <strong className="text-slate-800">{selectedCourse?.title || 'General'}</strong>
          </p>

          {/* Controls */}
          <div className="flex items-center gap-3 mb-6">
            {status === 'idle' && (
              <button
                onClick={startTimer}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition"
              >
                <Play className="h-4 w-4 fill-white" />
                <span>Start Session</span>
              </button>
            )}

            {status === 'running' && (
              <>
                <button
                  onClick={pauseTimer}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-amber-600 transition"
                >
                  <Pause className="h-4 w-4" />
                  <span>Pause</span>
                </button>
                <button
                  onClick={handleStopLiveSession}
                  className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-rose-700 transition"
                >
                  <Square className="h-4 w-4 fill-white" />
                  <span>Stop & Save</span>
                </button>
              </>
            )}

            {status === 'paused' && (
              <>
                <button
                  onClick={resumeTimer}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>Resume</span>
                </button>
                <button
                  onClick={handleStopLiveSession}
                  className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-rose-700 transition"
                >
                  <Square className="h-4 w-4 fill-white" />
                  <span>Stop & Save</span>
                </button>
                <button
                  onClick={resetTimer}
                  title="Reset timer without saving"
                  className="rounded-xl border border-slate-200 bg-white p-3 text-slate-400 hover:text-slate-600 transition"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          {/* Notes input */}
          <input
            type="text"
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="Add optional notes for this session (e.g. Reviewed Ch. 4 Encapsulation)"
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Log Offline Study Form */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <PlusCircle className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Log Offline Study</h3>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            Log time spent reading physical textbooks, solving problem sets, or attending in-person lectures.
          </p>

          <form onSubmit={handleLogOffline} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Course / Subject</label>
              <select
                value={offlineCourseId}
                onChange={(e) => setOfflineCourseId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Duration (Minutes)
              </label>
              <input
                type="number"
                min="5"
                max="720"
                value={offlineMinutes}
                onChange={(e) => setOfflineMinutes(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Activity Notes</label>
              <input
                type="text"
                value={offlineNotes}
                onChange={(e) => setOfflineNotes(e.target.value)}
                placeholder="e.g. Read textbook Ch. 4 Pages 1-15 offline"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={submittingOffline}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {submittingOffline ? 'Logging...' : 'Save Offline Session'}
            </button>
          </form>
        </div>
      </div>

      {/* Subject Breakdown & Recent Sessions Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject Breakdown Table */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Subject Breakdown</h3>
          <p className="text-xs text-slate-500 mb-4">Cumulative time per course</p>

          <div className="space-y-3">
            {stats?.subject_breakdown && stats.subject_breakdown.length > 0 ? (
              stats.subject_breakdown.map((sb) => (
                <div key={sb.course_id} className="flex items-center justify-between text-xs">
                  <div className="truncate pr-2">
                    <p className="font-semibold text-slate-800 truncate">{sb.course_title}</p>
                  </div>
                  <span className="font-mono font-bold text-indigo-600 shrink-0">
                    {sb.minutes} mins
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">No study sessions recorded yet.</p>
            )}
          </div>
        </div>

        {/* Recent Session History List */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Recent Study Sessions</h3>
          <p className="text-xs text-slate-500 mb-4">Chronological log of verified sessions</p>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {stats?.recent_sessions && stats.recent_sessions.length > 0 ? (
              stats.recent_sessions.map((sess) => (
                <div
                  key={sess.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {sess.course_title || 'General Course'}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          sess.session_type === 'platform'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {sess.session_type === 'platform' ? 'Platform Tracked' : 'Offline Logged'}
                      </span>
                    </div>
                    {sess.notes && <p className="text-slate-500 mt-1">{sess.notes}</p>}
                    <span className="text-[10px] text-slate-400">
                      {new Date(sess.started_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">{sess.duration_minutes}m</span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      ({sess.duration_seconds}s)
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">No session history found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

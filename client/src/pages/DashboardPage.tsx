import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCourse } from '../context/CourseContext';
import { api } from '../api/client';
import { DashboardStats } from '../../../shared/types';
import {
  BookOpen,
  Award,
  AlertTriangle,
  Clock,
  ArrowRight,
  Upload,
  Bot,
  HelpCircle,
  TrendingUp,
  Search,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const { selectedCourse } = useCourse();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCourse) return;
    setLoading(true);
    setError(null);
    api.getDashboardStats(selectedCourse.id)
      .then((data) => setStats(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedCourse]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Loading learning metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <h3 className="font-semibold">Unable to load dashboard data</h3>
        <p className="text-sm mt-1">{error || 'Unknown error occurred'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Student Overview
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
            Welcome back, Jyothi!
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Current Focus: <span className="font-semibold text-slate-700">{selectedCourse?.title}</span>
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate('/materials')}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 transition"
          >
            <Upload className="h-3.5 w-3.5 text-indigo-600" />
            Upload Material
          </button>
          <button
            onClick={() => navigate('/tutor')}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 transition"
          >
            <Bot className="h-3.5 w-3.5 text-indigo-600" />
            Ask Tutor
          </button>
          <button
            onClick={() => navigate('/quiz')}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
          >
            <HelpCircle className="h-3.5 w-3.5 fill-white" />
            Start Quiz
          </button>
        </div>
      </div>

      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Resources */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-card">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Resources</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.total_resources}</p>
          <p className="text-[11px] text-slate-500 mt-1">Verified indexed materials</p>
        </div>

        {/* Card 2: Tracked Study Time */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-card">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Study Time</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {stats.total_study_minutes} <span className="text-sm font-normal text-slate-500">min</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {stats.study_sessions_completed} sessions (Platform Tracked)
          </p>
        </div>

        {/* Card 3: Overall Quiz Accuracy */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-card">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Overall Accuracy</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.overall_quiz_accuracy}%</p>
          <p className="text-[11px] text-slate-500 mt-1">Across all assessment questions</p>
        </div>

        {/* Card 4: Mastered vs Weak Topics */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-card">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Topic Mastery</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{stats.topics_mastered_count}</span>
            <span className="text-xs text-slate-400">Mastered /</span>
            <span className="text-xl font-bold text-rose-600">{stats.topics_needing_improvement_count}</span>
            <span className="text-xs text-slate-400">Weak</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Topic-level competency</p>
        </div>
      </div>

      {/* Middle Row: Recommended Next Task & Weak Topics Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recommended Next Learning Task */}
        <div className="lg:col-span-2 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
              <TrendingUp className="h-3.5 w-3.5" />
              AI Recommended Next Step
            </span>
            <span className="text-xs font-medium text-slate-400">Based on recent quizzes</span>
          </div>

          <h3 className="text-lg font-bold text-slate-900">{stats.recommended_task.title}</h3>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">
            {stats.recommended_task.reason}
          </p>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => {
                if (stats.recommended_task.action_type === 'quiz') navigate('/quiz');
                else if (stats.recommended_task.action_type === 'tutor') navigate('/tutor');
                else navigate('/study-plan');
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
            >
              <span>Start Learning Task</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => navigate('/misconceptions')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <Search className="h-3.5 w-3.5 text-indigo-600" />
              Check Misconceptions
            </button>
          </div>
        </div>

        {/* Weak vs Mastered Topics Pill Box */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Topic Diagnostic Status</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">Grounded competency breakdown</p>

            {/* Weak Topics */}
            <div className="mb-4">
              <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">
                Needs Improvement (&lt;50%):
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {stats.weak_topics.length > 0 ? (
                  stats.weak_topics.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No weak topics detected</span>
                )}
              </div>
            </div>

            {/* Mastered Topics */}
            <div>
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                Mastered (&ge;80%):
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {stats.mastered_topics.length > 0 ? (
                  stats.mastered_topics.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-700"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">Complete quizzes to master topics</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/learning-twin')}
            className="mt-4 flex w-full items-center justify-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <span>View Cognitive Learning Twin</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Bottom Row: Performance Progress Chart & Recent Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Quiz Accuracy Progression</h3>
              <p className="text-xs text-slate-500">Average score over recent completed attempts</p>
            </div>
            <span className="text-xs font-semibold text-emerald-600">Real Assessment Data</span>
          </div>

          {stats.progress_history.length > 0 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.progress_history}>
                  <defs>
                    <linearGradient id="accuracyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} unit="%" />
                  <Tooltip
                    formatter={(val: any) => [`${val}%`, 'Accuracy']}
                    labelStyle={{ color: '#0F172A', fontWeight: 'bold' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#4F46E5"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#accuracyGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-56 items-center justify-center rounded-xl bg-slate-50 border border-dashed border-slate-200">
              <p className="text-xs text-slate-500">Take a quiz to visualize accuracy progression.</p>
            </div>
          )}
        </div>

        {/* Recent Activity Feed */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Recent Activity Feed</h3>
          <p className="text-xs text-slate-500 mb-4">Chronological student actions</p>

          <div className="space-y-3.5">
            {stats.recent_activity.length > 0 ? (
              stats.recent_activity.map((act) => (
                <div key={act.id} className="flex items-start gap-3 text-xs">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-indigo-600">
                    {act.type === 'upload' && <Upload className="h-3 w-3" />}
                    {act.type === 'quiz' && <HelpCircle className="h-3 w-3" />}
                    {act.type === 'tutor' && <Bot className="h-3 w-3" />}
                    {act.type === 'plan' && <Clock className="h-3 w-3" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{act.title}</p>
                    <p className="text-slate-500">{act.description}</p>
                    <span className="text-[10px] text-slate-400">
                      {new Date(act.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">No recent activity logged yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

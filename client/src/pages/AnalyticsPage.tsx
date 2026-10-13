import React, { useState, useEffect } from 'react';
import { useCourse } from '../context/CourseContext';
import { api } from '../api/client';
import { DashboardStats, TopicPerformance } from '../../../shared/types';
import {
  LineChart,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Award,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const { selectedCourse } = useCourse();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topics, setTopics] = useState<TopicPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCourse) return;
    setLoading(true);
    Promise.all([
      api.getDashboardStats(selectedCourse.id),
      api.getTopicPerformance(selectedCourse.id),
    ])
      .then(([dash, top]) => {
        setStats(dash);
        setTopics(top);
      })
      .catch((err) => console.error('Failed to load analytics data:', err))
      .finally(() => setLoading(false));
  }, [selectedCourse]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Compiling performance analytics...</p>
        </div>
      </div>
    );
  }

  const topicChartData = topics.map((t) => ({
    topic: t.topic.length > 18 ? t.topic.slice(0, 16) + '...' : t.topic,
    accuracy: t.accuracy,
    total: t.total_questions,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
          Empirical Assessment Data
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
          Learning Analytics & Mastery Metrics
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Visualizations generated strictly from actual student responses in SQLite.
        </p>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Overall Accuracy
          </span>
          <p className="mt-2 text-3xl font-bold text-indigo-600">{stats?.overall_quiz_accuracy || 0}%</p>
          <p className="text-[11px] text-slate-500 mt-1">Cumulative assessment score</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Sessions Completed
          </span>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {stats?.study_sessions_completed || 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Tracked platform attempts</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Mastered Topics
          </span>
          <p className="mt-2 text-3xl font-bold text-emerald-600">
            {stats?.topics_mastered_count || 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">&ge;80% verified accuracy</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Weak Topics
          </span>
          <p className="mt-2 text-3xl font-bold text-rose-600">
            {stats?.topics_needing_improvement_count || 0}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">&lt;50% accuracy threshold</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Topic Accuracy Bar Chart with Thresholds */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Accuracy by Topic</h3>
              <p className="text-xs text-slate-500">Thresholds: 50% (Weak) · 80% (Mastered)</p>
            </div>
            <span className="text-xs font-semibold text-indigo-600">Recharts Visualization</span>
          </div>

          {topicChartData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topicChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="topic" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} unit="%" />
                  <Tooltip
                    formatter={(val: any) => [`${val}%`, 'Accuracy']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0' }}
                  />
                  <ReferenceLine y={50} stroke="#EF4444" strokeDasharray="3 3" label="50% Weak" />
                  <ReferenceLine y={80} stroke="#10B981" strokeDasharray="3 3" label="80% Mastered" />
                  <Bar dataKey="accuracy" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400">
              No topic attempts available. Complete quizzes to populate.
            </div>
          )}
        </div>

        {/* Progress History Over Time */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Accuracy Over Time</h3>
              <p className="text-xs text-slate-500">Temporal improvement across completed quizzes</p>
            </div>
            <span className="text-xs font-semibold text-emerald-600">Historical Trend</span>
          </div>

          {stats && stats.progress_history.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.progress_history}>
                  <defs>
                    <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284C7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0284C7" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} unit="%" />
                  <Tooltip
                    formatter={(val: any) => [`${val}%`, 'Accuracy']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#0284C7"
                    strokeWidth={2.5}
                    fill="url(#analyticsGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400">
              Take multiple quizzes across days to visualize trend.
            </div>
          )}
        </div>
      </div>

      {/* Detailed Topic Cards */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-4">Topic Mastery Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {topics.map((t) => (
            <div
              key={t.topic}
              className={`rounded-xl border p-4 text-xs transition ${
                t.status === 'mastered'
                  ? 'border-emerald-200 bg-emerald-50/20'
                  : t.status === 'needs_improvement'
                  ? 'border-rose-200 bg-rose-50/20'
                  : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-900">{t.topic}</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    t.status === 'mastered'
                      ? 'bg-emerald-100 text-emerald-800'
                      : t.status === 'needs_improvement'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {t.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 my-1">{t.accuracy}%</p>
              <p className="text-slate-500">
                {t.correct_answers} of {t.total_questions} questions correct
              </p>
              <p className="text-slate-400 text-[10px] mt-2">
                Recommended level: <strong className="text-indigo-600 uppercase">{t.recommended_difficulty}</strong>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

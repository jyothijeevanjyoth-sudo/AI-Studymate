import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCourse } from '../context/CourseContext';
import { api } from '../api/client';
import { StudyPlan, StudyPlanActivity } from '../../../shared/types';
import {
  CalendarCheck,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  BookOpen,
  HelpCircle,
  Bot,
  RotateCcw,
  ArrowRight,
  Bookmark,
  Layers,
} from 'lucide-react';

export const StudyPlanPage: React.FC = () => {
  const { selectedCourse } = useCourse();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(30);
  const [generating, setGenerating] = useState(false);

  const loadPlan = async () => {
    if (!selectedCourse) return;
    try {
      setLoading(true);
      const data = await api.getStudyPlan(selectedCourse.id);
      if (data) {
        setPlan(data);
        setDailyGoal(data.daily_goal_minutes);
      } else {
        // Auto-generate initial plan
        const generated = await api.generateStudyPlan({
          courseId: selectedCourse.id,
          dailyGoalMinutes: dailyGoal,
        });
        setPlan(generated);
      }
    } catch (err) {
      console.error('Failed to load study plan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlan();
  }, [selectedCourse]);

  const handleRegenerate = async () => {
    if (!selectedCourse || generating) return;
    setGenerating(true);
    try {
      const generated = await api.generateStudyPlan({
        courseId: selectedCourse.id,
        dailyGoalMinutes: dailyGoal,
      });
      setPlan(generated);
    } catch (err: any) {
      alert(`Plan generation failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleActivity = async (activityId: string, currentStatus: boolean) => {
    try {
      await api.togglePlanActivity(activityId, !currentStatus);
      if (plan) {
        const updated = plan.activities.map((a) =>
          a.id === activityId ? { ...a, is_completed: !currentStatus } : a
        );
        setPlan({ ...plan, activities: updated });
      }
    } catch (err: any) {
      alert(`Could not update activity: ${err.message}`);
    }
  };

  const completedCount = plan?.activities.filter((a) => a.is_completed).length || 0;
  const totalCount = plan?.activities.length || 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'review_material':
        return <BookOpen className="h-4 w-4 text-indigo-600" />;
      case 'practice_quiz':
        return <HelpCircle className="h-4 w-4 text-emerald-600" />;
      case 'ask_tutor':
        return <Bot className="h-4 w-4 text-sky-600" />;
      default:
        return <Clock className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
          Adaptive Roadmap
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
          Personalized Study Plan
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Tailored learning activities generated dynamically from your identified weak topics and source materials.
        </p>
      </div>

      {/* Target Setting & Progress Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Progress Card */}
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Plan Completion
          </span>
          <p className="mt-2 text-3xl font-bold text-slate-900">{progressPercent}%</p>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">
            {completedCount} of {totalCount} activities finished
          </p>
        </div>

        {/* Daily Target Setting Card */}
        <div className="md:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Daily Study Target
              </span>
              <span className="text-xs font-bold text-indigo-600">{dailyGoal} Minutes / Day</span>
            </div>
            <input
              type="range"
              min="15"
              max="120"
              step="15"
              value={dailyGoal}
              onChange={(e) => setDailyGoal(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">
              Adapts dynamically when new quizzes identify weaknesses.
            </p>
            <button
              onClick={handleRegenerate}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{generating ? 'Regenerating...' : 'Regenerate Recommendations'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Activities Feed */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">
            Recommended Actionable Activities ({plan?.activities.length || 0})
          </h2>
          <span className="text-xs text-indigo-600 font-semibold">
            AI Recommendations (Editable)
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Building study roadmap...</div>
        ) : !plan || plan.activities.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 italic">
            No activities available. Click Regenerate Recommendations above.
          </div>
        ) : (
          <div className="space-y-3">
            {plan.activities.map((act) => (
              <div
                key={act.id}
                className={`flex items-start gap-4 rounded-xl border p-4 transition ${
                  act.is_completed
                    ? 'border-emerald-200 bg-emerald-50/20 opacity-75'
                    : 'border-slate-200 bg-white hover:border-indigo-200'
                }`}
              >
                {/* Completion Toggle */}
                <button
                  onClick={() => handleToggleActivity(act.id, act.is_completed)}
                  className="mt-0.5 text-slate-400 hover:text-indigo-600 transition"
                >
                  {act.is_completed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900 text-sm">{act.title}</span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                        act.priority === 'high'
                          ? 'bg-rose-100 text-rose-800'
                          : act.priority === 'medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {act.priority} Priority
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                      <Clock className="h-3 w-3" />
                      {act.estimated_minutes} mins
                    </span>
                  </div>

                  <p className="text-slate-600 leading-relaxed">{act.description}</p>

                  {/* Linked Resource Citation */}
                  {act.material_title && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-indigo-700 font-medium bg-indigo-50/60 p-2 rounded-lg border border-indigo-100">
                      <Bookmark className="h-3.5 w-3.5" />
                      <span>
                        Source: <strong>{act.material_title}</strong> ({act.unit_reference})
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick Action Button */}
                <div className="shrink-0 self-center">
                  {act.activity_type === 'practice_quiz' ? (
                    <button
                      onClick={() => navigate('/quiz')}
                      className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                    >
                      Take Quiz
                    </button>
                  ) : act.activity_type === 'ask_tutor' ? (
                    <button
                      onClick={() => navigate('/tutor')}
                      className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                    >
                      Ask Tutor
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate('/materials')}
                      className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                    >
                      View Notes
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

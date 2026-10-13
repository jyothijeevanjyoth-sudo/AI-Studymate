import React, { useState, useEffect } from 'react';
import { useCourse } from '../context/CourseContext';
import { api } from '../api/client';
import {
  LearningTwinProfile,
  WhatIfSimulationResult,
} from '../../../shared/types';
import {
  Sparkles,
  TrendingUp,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  Layers,
  HelpCircle,
} from 'lucide-react';

export const LearningTwinPage: React.FC = () => {
  const { selectedCourse } = useCourse();
  const [twin, setTwin] = useState<LearningTwinProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // What-If Simulator state
  const [simMinutes, setSimMinutes] = useState(45);
  const [simQuizzes, setSimQuizzes] = useState(2);
  const [simTopics, setSimTopics] = useState<string[]>([]);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<WhatIfSimulationResult | null>(null);

  const loadTwin = async () => {
    if (!selectedCourse) return;
    try {
      setLoading(true);
      const data = await api.getLearningTwin(selectedCourse.id);
      setTwin(data);
      if (data.topic_twins.length > 0 && simTopics.length === 0) {
        // Default focus on weak or practicing topics
        const weak = data.topic_twins.filter((t: any) => t.status === 'needs_improvement');
        setSimTopics(weak.map((w: any) => w.topic));
      }
    } catch (err) {
      console.error('Failed to load Learning Twin profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTwin();
  }, [selectedCourse]);

  const handleRunSimulation = async () => {
    if (!selectedCourse) return;
    setSimulating(true);
    try {
      const res = await api.simulateWhatIf({
        course_id: selectedCourse.id,
        planned_study_minutes: simMinutes,
        focus_topics: simTopics,
        planned_quizzes_count: simQuizzes,
      });
      setSimResult(res);
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  const toggleTopicFocus = (topic: string) => {
    if (simTopics.includes(topic)) {
      setSimTopics(simTopics.filter((t) => t !== topic));
    } else {
      setSimTopics([...simTopics, topic]);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Constructing Cognitive Learning Twin...</p>
        </div>
      </div>
    );
  }

  if (!twin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-sm text-slate-500">No Learning Twin data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
          Digital Cognitive Representation
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
          Learning Twin & Simulator
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          A probabilistic model of your knowledge state, tracking verified evidence, confidence, and hypothetical study scenarios.
        </p>
      </div>

      {/* Primary Twin Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Readiness */}
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Overall Readiness</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">{twin.overall_readiness_pct}%</p>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full"
              style={{ width: `${twin.overall_readiness_pct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">{twin.learning_velocity}</p>
        </div>

        {/* Model Confidence */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Diagnostic Confidence</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900">{twin.overall_confidence}%</p>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full"
              style={{ width: `${twin.overall_confidence}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Calibrated on evidence sample size
          </p>
        </div>

        {/* Unresolved Misconceptions */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Misconceptions</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-rose-600">{twin.unresolved_misconceptions_count}</p>
          <p className="text-xs text-slate-600 mt-2">
            {twin.unresolved_misconceptions_count > 0
              ? 'Flagged conceptual blockers to resolve'
              : 'Zero active misconceptions detected'}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Verified via follow-up questions</p>
        </div>
      </div>

      {/* Scientific Transparency Alert */}
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs text-indigo-950 flex items-start gap-3">
        <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold">Transparent Probabilistic Modeling</h4>
          <p className="mt-0.5 leading-relaxed">{twin.cognitive_readiness_note}</p>
        </div>
      </div>

      {/* Topic Twins Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-1">Topic-Level Digital Twins</h2>
        <p className="text-xs text-slate-500 mb-4">Granular mastery estimates and recommended next actions</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 uppercase font-semibold text-slate-400">
              <tr>
                <th className="pb-3 pl-1">Topic</th>
                <th className="pb-3">Estimated Mastery</th>
                <th className="pb-3">Confidence Level</th>
                <th className="pb-3">Evidence Points</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {twin.topic_twins.map((tt) => (
                <tr key={tt.topic} className="hover:bg-slate-50/70 transition">
                  <td className="py-3.5 pl-1 font-semibold text-slate-900">{tt.topic}</td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            tt.estimated_mastery >= 80
                              ? 'bg-emerald-600'
                              : tt.estimated_mastery >= 50
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${tt.estimated_mastery}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-800">{tt.estimated_mastery}%</span>
                    </div>
                  </td>
                  <td className="py-3.5 font-medium text-slate-600">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px]">
                      {tt.confidence_level}% Confidence
                    </span>
                  </td>
                  <td className="py-3.5 text-slate-600 font-mono">
                    {tt.total_evidence_count} answers
                  </td>
                  <td className="py-3.5">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                        tt.status === 'mastered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tt.status === 'practicing'
                          ? 'bg-amber-100 text-amber-800'
                          : tt.status === 'needs_improvement'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tt.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3.5 text-slate-600 max-w-xs">{tt.recommended_next_step}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* What-If Learning Simulator */}
      <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/40 via-white to-white p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <Sliders className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">What-If Learning Simulator</h2>
        </div>
        <p className="text-xs text-slate-500 mb-6 max-w-2xl">
          Simulate prospective outcomes before dedicating study time. Test hypotheses like "What if I spend 45 minutes on Inheritance and take 2 targeted quizzes?"
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="space-y-5 text-xs">
            {/* Focus Topics Selection */}
            <div>
              <label className="font-semibold text-slate-700 block mb-2">
                Select Focus Topic(s):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {twin.topic_twins.map((tt) => (
                  <button
                    key={tt.topic}
                    type="button"
                    onClick={() => toggleTopicFocus(tt.topic)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      simTopics.includes(tt.topic)
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tt.topic}
                  </button>
                ))}
              </div>
            </div>

            {/* Study Time Slider */}
            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>Planned Study Time:</span>
                <span className="text-indigo-600 font-bold">{simMinutes} minutes</span>
              </div>
              <input
                type="range"
                min="15"
                max="120"
                step="15"
                value={simMinutes}
                onChange={(e) => setSimMinutes(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            {/* Quizzes Count Slider */}
            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>Planned Assessment Quizzes:</span>
                <span className="text-indigo-600 font-bold">{simQuizzes} quizzes</span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={simQuizzes}
                onChange={(e) => setSimQuizzes(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <button
              onClick={handleRunSimulation}
              disabled={simulating}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {simulating ? 'Calculating Projections...' : 'Simulate Learning Impact'}
            </button>
          </div>

          {/* Simulation Output Card */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
            {!simResult ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-6 text-slate-400">
                <Sliders className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-xs">Adjust the parameters on the left and click Simulate Learning Impact.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-indigo-600 tracking-wider">
                      Projected Outcome
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">
                      Readiness: {simResult.projected_readiness_pct}%{' '}
                      <span className="text-emerald-600 text-sm font-semibold">
                        (+{simResult.readiness_delta}% delta)
                      </span>
                    </h3>
                  </div>
                  <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    Est. Study Effort: {simResult.estimated_study_hours} hrs
                  </span>
                </div>

                {/* Per-Topic Projected Outcomes */}
                <div className="space-y-2 text-xs">
                  {simResult.projected_topic_outcomes.map((to) => (
                    <div
                      key={to.topic}
                      className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5"
                    >
                      <span className="font-semibold text-slate-800">{to.topic}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500">
                          {to.current_mastery}% &rarr;{' '}
                          <strong className="text-indigo-600 font-bold">{to.projected_mastery}%</strong>
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            to.projected_status === 'mastered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {to.projected_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scientific Disclaimer */}
                <div className="rounded-lg bg-amber-50/70 border border-amber-200 p-2.5 text-[11px] text-amber-800">
                  <p>{simResult.disclaimer}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

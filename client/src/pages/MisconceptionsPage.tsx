import React, { useState, useEffect } from 'react';
import { useCourse } from '../context/CourseContext';
import { api } from '../api/client';
import { Misconception } from '../../../shared/types';
import {
  Search,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  BookOpen,
  Sparkles,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export const MisconceptionsPage: React.FC = () => {
  const { selectedCourse } = useCourse();
  const [misconceptions, setMisconceptions] = useState<Misconception[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<Record<string, { isCorrect: boolean; feedback: string }>>({});

  const loadMisconceptions = async () => {
    if (!selectedCourse) return;
    try {
      setLoading(true);
      const data = await api.getMisconceptions(selectedCourse.id);
      setMisconceptions(data);
    } catch (err) {
      console.error('Failed to load misconceptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMisconceptions();
  }, [selectedCourse]);

  const handleVerify = async (misconception: Misconception) => {
    const answer = selectedAnswers[misconception.id];
    if (!answer) {
      alert('Please select an answer to verify your understanding.');
      return;
    }

    setVerifyingId(misconception.id);
    try {
      const res = await api.verifyMisconception(misconception.id, answer);
      setVerificationFeedback({
        ...verificationFeedback,
        [misconception.id]: res,
      });

      if (res.wasResolved) {
        // Refresh list to update resolved status
        setTimeout(() => {
          loadMisconceptions();
        }, 1200);
      }
    } catch (err: any) {
      alert(`Verification check failed: ${err.message}`);
    } finally {
      setVerifyingId(null);
    }
  };

  const unresolved = misconceptions.filter((m) => !m.is_resolved);
  const resolved = misconceptions.filter((m) => m.is_resolved);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Cognitive Diagnostics
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
            Misconception Detective
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pinpoints the underlying conceptual fallacies behind incorrect answers and provides targeted verification challenges.
          </p>
        </div>

        <button
          onClick={loadMisconceptions}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
        >
          <RefreshCw className="h-3.5 w-3.5 text-indigo-600" />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      {/* Summary Status Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-rose-800 uppercase tracking-wider">
                Active Misconceptions
              </p>
              <h2 className="text-2xl font-bold text-rose-950">{unresolved.length}</h2>
            </div>
          </div>
          <p className="text-xs text-rose-700/80 mt-2">
            Concepts requiring evidence verification before advancing difficulty.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                Resolved Fallacies
              </p>
              <h2 className="text-2xl font-bold text-emerald-950">{resolved.length}</h2>
            </div>
          </div>
          <p className="text-xs text-emerald-700/80 mt-2">
            Successfully proven understanding through follow-up verification challenges.
          </p>
        </div>
      </div>

      {/* Misconceptions Interactive Feed */}
      <div className="space-y-6">
        <h2 className="text-base font-bold text-slate-900">
          Detected Conceptual Errors & Evidence Verification
        </h2>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Scanning assessment records...</div>
        ) : misconceptions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <Search className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No misconceptions detected yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Misconceptions are automatically detected when you submit incorrect quiz answers.
            </p>
          </div>
        ) : (
          misconceptions.map((m) => {
            const feedback = verificationFeedback[m.id];
            return (
              <div
                key={m.id}
                className={`rounded-2xl border p-6 transition shadow-xs ${
                  m.is_resolved
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-bold text-indigo-700">
                      Topic: {m.topic}
                    </span>
                    <span className="text-xs text-slate-400">
                      Detected: {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {m.is_resolved ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Resolved & Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Pending Verification
                    </span>
                  )}
                </div>

                {/* Detected Misconception Statement */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600">
                      Likely Misconception (Diagnostic Hypothesis):
                    </h3>
                    <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                      Probabilistic diagnosis based on error pattern
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 bg-rose-50/60 p-3 rounded-xl border border-rose-200/60 leading-relaxed">
                    "{m.misconception_text}"
                  </p>
                </div>

                {/* Evidence-based Explanation from Course Material */}
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
                    Course Evidence & Structural Truth:
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {m.evidence_explanation}
                  </p>
                </div>

                {/* Interactive Verification Challenge */}
                {!m.is_resolved && (
                  <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/30 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Understanding Verification Challenge:
                      </h4>
                    </div>

                    <p className="text-xs font-medium text-slate-900 mb-3">
                      {m.follow_up_question.question_text}
                    </p>

                    {/* Radio Options */}
                    <div className="space-y-2">
                      {m.follow_up_question.options.map((opt, oIdx) => (
                        <label
                          key={oIdx}
                          className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs cursor-pointer transition ${
                            selectedAnswers[m.id] === opt
                              ? 'border-indigo-600 bg-white shadow-xs font-semibold text-indigo-900'
                              : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`misc_${m.id}`}
                            value={opt}
                            checked={selectedAnswers[m.id] === opt}
                            onChange={() =>
                              setSelectedAnswers({ ...selectedAnswers, [m.id]: opt })
                            }
                            className="mt-0.5 h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="leading-snug">{opt}</span>
                        </label>
                      ))}
                    </div>

                    {/* Feedback message */}
                    {feedback && (
                      <div
                        className={`mt-3 rounded-lg p-3 text-xs font-medium ${
                          feedback.isCorrect
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {feedback.feedback}
                      </div>
                    )}

                    {/* Verify Action Button */}
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => handleVerify(m)}
                        disabled={verifyingId === m.id}
                        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
                      >
                        <span>{verifyingId === m.id ? 'Checking...' : 'Verify Understanding'}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

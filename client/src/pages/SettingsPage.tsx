import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useCourse } from '../context/CourseContext';
import { SystemStatus } from '../../../shared/types';
import {
  Settings,
  Database,
  Sparkles,
  Mic,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Shield,
  Layers,
  Terminal,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { refreshCourses } = useCourse();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await api.getSystemStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to load system status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSeedDemo = async () => {
    if (!window.confirm('Reset and re-seed the sample CS101 demo course? This will restore clean demo materials, textbook chunks, diagnostic quizzes, and misconceptions.')) {
      return;
    }
    setSeeding(true);
    setSeedMsg(null);
    try {
      await api.seedDatabase();
      await loadStatus();
      await refreshCourses();
      setSeedMsg('Sample CS101 Course, textbook chunks, slides, quizzes, and misconceptions seeded successfully!');
    } catch (err: any) {
      alert(`Seeding failed: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
          Configuration & Diagnostics
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
          Platform Settings & System Status
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Verify backend services, AI provider configurations, and manage sample datasets for hackathon evaluation.
        </p>
      </div>

      {seedMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
          <CheckCircle className="h-4 w-4" />
          <span>{seedMsg}</span>
        </div>
      )}

      {/* System Status Overview */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
        <h2 className="text-base font-bold text-slate-900">System Readiness & Architecture</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* AI Provider Config */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-900">AI Tutoring & RAG Engine</span>
            </div>
            <p className="text-xs text-slate-600">
              Provider:{' '}
              <strong className="text-slate-900 uppercase">
                {status?.ai_provider || 'GEMINI'}
              </strong>
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              {status?.ai_configured ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <CheckCircle className="h-3 w-3" />
                  API Credentials Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  <AlertCircle className="h-3 w-3" />
                  Offline Extractive Fallback Mode Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {status?.ai_configured
                ? 'External LLM calls enabled with context grounding.'
                : 'Extracts real passages & authentic citations with zero external API dependencies.'}
            </p>
          </div>

          {/* Database Status */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <Database className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900">SQLite Database</span>
            </div>
            <p className="text-xs text-slate-600">
              Engine: <strong className="text-slate-900">Node native sqlite (WAL Mode)</strong>
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-700">
              <span className="rounded-md bg-slate-200 px-2 py-0.5 font-mono text-[11px]">
                {status?.total_materials || 0} Materials
              </span>
              <span className="rounded-md bg-slate-200 px-2 py-0.5 font-mono text-[11px]">
                {status?.total_chunks || 0} Chunks Indexed
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Zero native compilation errors on Windows. Full transaction safety.
            </p>
          </div>

          {/* Speech-to-Text */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <Mic className="h-4 w-4 text-sky-600" />
              <span className="text-xs font-bold text-slate-900">Speech-to-Text Service</span>
            </div>
            <p className="text-xs text-slate-600">
              Provider:{' '}
              <strong className="text-slate-900 uppercase">{status?.stt_provider || 'MOCK'}</strong>
            </p>
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 mt-3">
              Transcript Parser & VTT Timestamps Active
            </span>
          </div>

          {/* Security & Isolation */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <Shield className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-bold text-slate-900">Security & Sandboxing</span>
            </div>
            <p className="text-xs text-slate-600">
              Path Traversal Protection: <strong className="text-emerald-700">Enabled</strong>
            </p>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold mt-3">
              No Client Secret Exposure
            </span>
          </div>
        </div>
      </div>

      {/* Hackathon Demo Seeder Card */}
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white p-6 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <span className="rounded-md bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
              Judges & Hackathon Evaluators
            </span>
            <h2 className="text-base font-bold text-slate-900 mt-1">
              Sample CS101 Java Dataset Seeder
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-lg leading-relaxed">
              Resets and seeds the sample CS101 course complete with textbook chapter chunks (Pages 1-4), lecture slide chunks (Slides 1-5), video transcript timestamps, diagnostic quizzes, and active misconceptions for live testing.
            </p>
          </div>

          <button
            onClick={handleSeedDemo}
            disabled={seeding}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${seeding ? 'animate-spin' : ''}`} />
            <span>{seeding ? 'Seeding Dataset...' : 'Reset & Seed Demo Data'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useCourse } from '../../context/CourseContext';
import { useStudyTimer } from '../../context/StudyTimerContext';
import { api } from '../../api/client';
import {
  BookOpen,
  Play,
  Pause,
  Square,
  Clock,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ChevronDown,
  Menu,
} from 'lucide-react';

interface NavbarProps {
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu }) => {
  const { courses, selectedCourse, setSelectedCourse } = useCourse();
  const { status, formattedTime, startTimer, pauseTimer, resumeTimer, stopTimer } = useStudyTimer();
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; provider: string }>({
    configured: false,
    provider: 'gemini',
  });
  const [sessionSavedMsg, setSessionSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getSystemStatus().then(s => {
      setAiStatus({ configured: s.ai_configured, provider: s.ai_provider });
    }).catch(() => {});
  }, []);

  const handleStop = async () => {
    const res = await stopTimer('Session stopped from navigation bar');
    if (res.success) {
      setSessionSavedMsg(`Saved ${res.durationMinutes} min session!`);
      setTimeout(() => setSessionSavedMsg(null), 3500);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      {/* Left: Mobile Menu Toggle & Active Course Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          title="Toggle Navigation Menu"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-600" />
          <span className="hidden text-xs font-semibold uppercase tracking-wider text-slate-500 sm:inline">
            Active Course:
          </span>
        </div>

        <div className="relative">
          <select
            value={selectedCourse?.id || ''}
            onChange={(e) => {
              const found = courses.find((c) => c.id === e.target.value);
              setSelectedCourse(found || null);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 pr-8 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} — {course.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right Controls: Timer Widget, AI Mode pill, Student Profile */}
      <div className="flex items-center gap-3">
        {/* Saved Session Toast */}
        {sessionSavedMsg && (
          <span className="animate-fade-in inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle className="h-3.5 w-3.5" />
            {sessionSavedMsg}
          </span>
        )}

        {/* Global Live Study Timer Pill */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm">
          <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-semibold text-slate-700">
            <Clock className={`h-3.5 w-3.5 ${status === 'running' ? 'text-indigo-600 animate-pulse' : 'text-slate-400'}`} />
            <span>{formattedTime}</span>
          </div>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-1">
            {status === 'idle' && (
              <button
                onClick={startTimer}
                title="Start study session timer"
                className="flex h-7 items-center gap-1 rounded bg-indigo-600 px-2 text-xs font-medium text-white transition hover:bg-indigo-700"
              >
                <Play className="h-3 w-3 fill-white" />
                <span>Track</span>
              </button>
            )}

            {status === 'running' && (
              <>
                <button
                  onClick={pauseTimer}
                  title="Pause study timer"
                  className="flex h-7 w-7 items-center justify-center rounded bg-amber-100 text-amber-800 transition hover:bg-amber-200"
                >
                  <Pause className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleStop}
                  title="Finish and log study session"
                  className="flex h-7 w-7 items-center justify-center rounded bg-rose-100 text-rose-700 transition hover:bg-rose-200"
                >
                  <Square className="h-3 w-3 fill-rose-700" />
                </button>
              </>
            )}

            {status === 'paused' && (
              <>
                <button
                  onClick={resumeTimer}
                  title="Resume study session"
                  className="flex h-7 w-7 items-center justify-center rounded bg-emerald-100 text-emerald-800 transition hover:bg-emerald-200"
                >
                  <Play className="h-3 w-3 fill-emerald-800" />
                </button>
                <button
                  onClick={handleStop}
                  title="Finish and log study session"
                  className="flex h-7 w-7 items-center justify-center rounded bg-rose-100 text-rose-700 transition hover:bg-rose-200"
                >
                  <Square className="h-3 w-3 fill-rose-700" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* AI Provider Status Badge */}
        <div
          title={
            aiStatus.configured
              ? `Connected to ${aiStatus.provider.toUpperCase()} LLM API`
              : 'Running in Reliable Deterministic Fallback Mode (No API keys required)'
          }
          className="hidden md:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
        >
          <Sparkles className={`h-3.5 w-3.5 ${aiStatus.configured ? 'text-indigo-600' : 'text-amber-500'}`} />
          <span>{aiStatus.configured ? 'AI: Online' : 'AI: Extractive Mode'}</span>
        </div>

        {/* User Profile Area */}
        <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 font-semibold text-white text-xs shadow-sm">
            JB
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-slate-800 leading-none">Jyothi B</p>
            <p className="text-[10px] text-slate-500 leading-tight">Student · Track D</p>
          </div>
        </div>
      </div>
    </header>
  );
};

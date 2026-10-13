import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderArchive,
  Bot,
  HelpCircle,
  Search,
  Sparkles,
  Clock,
  LineChart,
  CalendarCheck,
  Settings,
  GraduationCap,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/materials', label: 'My Learning Materials', icon: FolderArchive },
  { to: '/tutor', label: 'AI Tutor', icon: Bot },
  { to: '/quiz', label: 'Quiz & Assessments', icon: HelpCircle },
  { to: '/misconceptions', label: 'Misconception Detective', icon: Search, badge: 'New' },
  { to: '/learning-twin', label: 'Learning Twin & Simulator', icon: Sparkles, badge: 'AI' },
  { to: '/tracker', label: 'Study Time Tracker', icon: Clock },
  { to: '/analytics', label: 'Learning Analytics', icon: LineChart },
  { to: '/study-plan', label: 'Personalized Study Plan', icon: CalendarCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-slate-200 bg-white select-none transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">
                AI StudyMate
              </h1>
              <p className="text-[11px] font-medium text-indigo-600 leading-tight">
                Personal AI Companion
              </p>
            </div>
          </div>

          {/* Close button for mobile */}
          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
            aria-label="Close sidebar"
          >
            <span className="text-xl font-bold">&times;</span>
          </button>
        </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0 transition-colors group-hover:text-indigo-600" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Track Info */}
      <div className="border-t border-slate-200 p-4">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          <p className="text-xs font-semibold text-indigo-900">Track D · Hackathon 2026</p>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Personalized Tutoring & Adaptive Learning
          </p>
        </div>
      </div>
    </aside>
    </>
  );
};

import React from 'react';
import { Citation } from '../../../../shared/types';
import { X, ExternalLink, Bookmark, FileText, CheckCircle } from 'lucide-react';

interface CitationModalProps {
  citation: Citation | null;
  onClose: () => void;
}

export const CitationModal: React.FC<CitationModalProps> = ({ citation, onClose }) => {
  if (!citation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Bookmark className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                Verified Grounded Source
              </span>
              <h3 className="text-base font-semibold text-slate-900">{citation.material_title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Source Coordinates */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
            <FileText className="h-3.5 w-3.5" />
            {citation.unit_label}
          </span>
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 uppercase">
            {citation.file_type}
          </span>
          {citation.relevance_score !== undefined && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle className="h-3 w-3" />
              Score: {Math.round(citation.relevance_score * 100)}%
            </span>
          )}
        </div>

        {/* Extracted Passage / Excerpt */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Extracted Material Passage:
          </p>
          <blockquote className="text-sm italic text-slate-700 leading-relaxed border-l-2 border-indigo-400 pl-3">
            "{citation.snippet}"
          </blockquote>
        </div>

        {/* Footer info */}
        <div className="mt-5 flex items-center justify-between pt-2">
          <p className="text-[11px] text-slate-400">
            Metadata preserved directly from original document upload.
          </p>
          <button
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

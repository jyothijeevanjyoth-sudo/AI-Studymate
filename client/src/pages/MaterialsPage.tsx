import React, { useState, useEffect, useRef } from 'react';
import { useCourse } from '../context/CourseContext';
import { api } from '../api/client';
import { LearningMaterial } from '../../../shared/types';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Video,
  File,
  Trash2,
  RefreshCw,
  Eye,
  CheckCircle,
  AlertCircle,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';

export const MaterialsPage: React.FC = () => {
  const { selectedCourse } = useCourse();
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Preview state
  const [previewData, setPreviewData] = useState<{ material: LearningMaterial; chunks: any[] } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMaterials = async () => {
    if (!selectedCourse) return;
    try {
      setLoading(true);
      const data = await api.getMaterials(selectedCourse.id);
      setMaterials(data);
    } catch (err: any) {
      console.error('Failed to load materials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [selectedCourse]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedCourse) return;
    const file = files[0];

    // Client-side validations
    const allowed = ['.pdf', '.pptx', '.txt', '.md', '.vtt', '.srt', '.mp4', '.webm', '.mov'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setUploadError(`Unsupported file format "${ext}". Supported: PDF, PPTX, TXT, MD, VTT, SRT, Video.`);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File exceeds 50 MB limit.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseId', selectedCourse.id);
    formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

    try {
      const res = await api.uploadMaterial(formData);
      setUploadSuccess(`"${res.material.title}" processed and indexed successfully into knowledge base!`);
      await loadMaterials();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadError(err.message || 'Upload processing failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await api.deleteMaterial(id);
      setMaterials(materials.filter((m) => m.id !== id));
      if (previewData?.material.id === id) setPreviewData(null);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      await api.reprocessMaterial(id);
      await loadMaterials();
      alert('Document reprocessed successfully!');
    } catch (err: any) {
      alert(`Reprocessing failed: ${err.message}`);
    }
  };

  const handlePreview = async (id: string) => {
    setPreviewLoading(true);
    try {
      const res = await api.previewMaterial(id);
      setPreviewData(res);
    } catch (err: any) {
      alert(`Could not load preview: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const getFormatIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-rose-500" />;
      case 'pptx':
        return <FileSpreadsheet className="h-5 w-5 text-amber-500" />;
      case 'transcript':
      case 'video':
        return <Video className="h-5 w-5 text-indigo-500" />;
      default:
        return <File className="h-5 w-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Source-Cited Knowledge Base
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
            My Learning Materials
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload textbooks, slides, and lecture transcripts to ground AI tutoring and quiz generation.
          </p>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFileUpload(e.dataTransfer.files);
        }}
        className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 p-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50/50"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.pptx,.txt,.md,.vtt,.srt,.mp4,.webm,.mov"
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
          id="file-upload-input"
        />

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md mb-3">
          <Upload className="h-6 w-6" />
        </div>

        <h3 className="text-base font-semibold text-slate-900">
          Upload PDF textbooks, PPTX slides, or transcripts
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md">
          Drag and drop files here, or click browse. Preserves page numbers, slide indexes, and video timestamps.
        </p>

        <label
          htmlFor="file-upload-input"
          className="mt-4 cursor-pointer rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
        >
          {uploading ? 'Processing & Chunking Document...' : 'Browse Educational File'}
        </label>

        {/* Upload feedback */}
        {uploadError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
        {uploadSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs text-emerald-700">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
        )}
      </div>

      {/* Materials List Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">
            Indexed Educational Resources ({materials.length})
          </h2>
          <span className="text-xs text-slate-500">Filter: {selectedCourse?.code}</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading resources...</div>
        ) : materials.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-500">No resources uploaded yet for this course.</p>
            <p className="text-xs text-slate-400 mt-1">Upload files above or click seed demo in settings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                <tr>
                  <th className="pb-3 pl-1">Document Title</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Source Units</th>
                  <th className="pb-3">Chunks</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right pr-1">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materials.map((mat) => (
                  <tr key={mat.id} className="group hover:bg-slate-50/70 transition">
                    <td className="py-3.5 pl-1">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                          {getFormatIcon(mat.file_type)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{mat.title}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{mat.file_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-700">
                        {mat.file_type}
                      </span>
                    </td>
                    <td className="py-3.5 text-xs text-slate-600 font-medium">
                      {mat.total_units} {mat.unit_type}s
                    </td>
                    <td className="py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold">
                        <Layers className="h-3 w-3" />
                        {mat.chunk_count || 0}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                        <CheckCircle className="h-3 w-3" />
                        Indexed
                      </span>
                    </td>
                    <td className="py-3.5 text-right pr-1 space-x-1">
                      <button
                        onClick={() => handlePreview(mat.id)}
                        title="Preview extracted units"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleReprocess(mat.id)}
                        title="Reprocess chunks"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(mat.id, mat.title)}
                        title="Delete material"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Extracted Text & Chunks Preview Drawer / Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-6 shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                  Extracted Units Preview
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  {previewData.material.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {previewData.chunks.length} indexed chunks · Preserved {previewData.material.unit_type} metadata
                </p>
              </div>
              <button
                onClick={() => setPreviewData(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Chunks List */}
            <div className="flex-1 space-y-3 overflow-y-auto py-4 pr-1">
              {previewData.chunks.map((chk, idx) => (
                <div key={chk.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                      {chk.unit_label}
                    </span>
                    <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      Topic: {chk.topic}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-sans">{chk.content}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 pt-3 text-right">
              <button
                onClick={() => setPreviewData(null)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

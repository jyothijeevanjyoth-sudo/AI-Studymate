import React, { useState, useEffect, useRef } from 'react';
import { useCourse } from '../context/CourseContext';
import { api } from '../api/client';
import { Conversation, ChatMessage, TutorMode, Citation } from '../../../shared/types';
import { CitationModal } from '../components/common/CitationModal';
import {
  Bot,
  User,
  Send,
  Plus,
  Trash2,
  Copy,
  Check,
  Bookmark,
  Sparkles,
  BookOpen,
  HelpCircle,
  Lightbulb,
  ListOrdered,
  Shuffle,
} from 'lucide-react';

const TUTOR_MODES: Array<{ mode: TutorMode; label: string; icon: any; description: string }> = [
  { mode: 'standard', label: 'Standard Tutor', icon: BookOpen, description: 'Grounded academic explanations' },
  { mode: 'beginner', label: 'Beginner Mode', icon: Lightbulb, description: 'Simple vocabulary, zero jargon' },
  { mode: 'step_by_step', label: 'Step-by-Step', icon: ListOrdered, description: 'Logical sequential numbered breakdown' },
  { mode: 'analogy', label: 'Analogy & Models', icon: Shuffle, description: 'Intuitive real-world comparisons' },
  { mode: 'practice', label: 'Practice Check', icon: HelpCircle, description: 'Formulates questions to test comprehension' },
];

const SUGGESTED_QUESTIONS = [
  'How does dynamic method dispatch work in Java polymorphism?',
  'What is the difference between method overloading and overriding?',
  'Why does Java use Generic Type Erasure in bytecode?',
  'Can a subclass access private fields of its parent class?',
];

export const TutorPage: React.FC = () => {
  const { selectedCourse } = useCourse();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedMode, setSelectedMode] = useState<TutorMode>('standard');
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Citation modal
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations when selected course changes
  const loadConversations = async () => {
    if (!selectedCourse) return;
    try {
      const convs = await api.getConversations(selectedCourse.id);
      setConversations(convs);
      if (convs.length > 0) {
        setActiveConvId(convs[0].id);
      } else {
        // Create initial conversation automatically
        const created = await api.createConversation({
          courseId: selectedCourse.id,
          title: 'General Tutoring Session',
        });
        setConversations([created]);
        setActiveConvId(created.id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [selectedCourse]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConvId) return;
    api.getMessages(activeConvId)
      .then((msgs) => {
        setMessages(msgs);
        scrollToBottom();
      })
      .catch((err) => console.error('Failed to load messages:', err));
  }, [activeConvId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleNewConversation = async () => {
    if (!selectedCourse) return;
    try {
      const created = await api.createConversation({
        courseId: selectedCourse.id,
        title: `Study Session ${conversations.length + 1}`,
      });
      setConversations([created, ...conversations]);
      setActiveConvId(created.id);
      setMessages([]);
    } catch (err: any) {
      alert(`Could not start new conversation: ${err.message}`);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Clear this conversation?')) return;
    try {
      await api.deleteConversation(id);
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (activeConvId === id) {
        setActiveConvId(remaining.length > 0 ? remaining[0].id : null);
        setMessages([]);
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || !activeConvId || sending) return;

    setInputPrompt('');
    setSending(true);

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      conversation_id: activeConvId,
      sender: 'user',
      content: text,
      tutor_mode: selectedMode,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    scrollToBottom();

    try {
      const res = await api.sendMessage(activeConvId, {
        content: text,
        mode: selectedMode,
      });
      setMessages((prev) => [...prev, res.message]);
      scrollToBottom();
    } catch (err: any) {
      alert(`Tutor error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-[calc(100vh-6.5rem)] gap-4 max-w-7xl mx-auto">
      {/* Citation Modal */}
      <CitationModal citation={activeCitation} onClose={() => setActiveCitation(null)} />

      {/* Left Drawer: Conversation History */}
      <div className="hidden md:flex w-64 flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Conversations</h2>
          <button
            onClick={handleNewConversation}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
            title="Start new conversation"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setActiveConvId(conv.id)}
              className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium cursor-pointer transition ${
                activeConvId === conv.id
                  ? 'bg-indigo-50 text-indigo-800 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="truncate pr-2">
                <p className="truncate">{conv.title}</p>
                <span className="text-[10px] text-slate-400">
                  {new Date(conv.created_at).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={(e) => handleDeleteConversation(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex flex-1 flex-col rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {/* Chat Header with Mode Selector */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-3 gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">AI Tutor Grounded Assistant</h2>
              <p className="text-[11px] text-slate-500">
                Course: <span className="font-semibold text-slate-700">{selectedCourse?.code}</span>
              </p>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
            {TUTOR_MODES.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.mode}
                  onClick={() => setSelectedMode(m.mode)}
                  title={m.description}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    selectedMode === m.mode
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">What would you like to learn today?</h3>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                Ask any question grounded in your uploaded textbooks, lecture slides, and transcripts. Verifiable citations will be attached to every answer.
              </p>

              {/* Starter Suggestion Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full text-left">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSendMessage(q)}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 transition leading-snug"
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : 'border border-slate-200 bg-white text-slate-900 rounded-tl-xs'
                  }`}
                >
                  {/* Mode Badge & Copy Button */}
                  {msg.sender === 'assistant' && (
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 text-[10px]">
                          {msg.tutor_mode ? msg.tutor_mode.toUpperCase() : 'STANDARD'} MODE
                        </span>
                        {msg.is_fallback && (
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 text-[10px]">
                            EXTRACTIVE FALLBACK
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition"
                        title="Copy answer"
                      >
                        {copiedId === msg.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Message Body */}
                  <div className="prose prose-sm max-w-none text-xs leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>

                  {/* Verifiable Clickable Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-2">
                        Supporting Sources & Citations:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((c, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveCitation(c)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
                          >
                            <Bookmark className="h-3 w-3" />
                            <span>
                              {c.material_title} ({c.unit_label})
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white shadow-xs">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="flex gap-3 items-center text-xs text-slate-500">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white animate-pulse">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
                <span className="inline-block h-2 w-2 rounded-full bg-indigo-600 animate-ping" />
                <span>Retrieving course citations and formulating response...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="border-t border-slate-100 bg-white p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={`Ask a question grounded in ${selectedCourse?.code || 'course'} materials...`}
              disabled={sending}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-900 shadow-inner focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={sending || !inputPrompt.trim()}
              className="flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
            >
              <span>Send</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

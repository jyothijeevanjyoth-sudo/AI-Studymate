import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCourse } from '../context/CourseContext';
import { api } from '../api/client';
import { Quiz, QuizAttempt, GradedAnswerResult, Difficulty, Citation } from '../../../shared/types';
import { CitationModal } from '../components/common/CitationModal';
import {
  HelpCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Bookmark,
  Award,
  AlertTriangle,
  History,
  Layers,
  Sparkles,
} from 'lucide-react';

export const QuizPage: React.FC = () => {
  const { selectedCourse } = useCourse();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'take' | 'history'>('take');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);

  // Quiz Taking State
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    attempt: QuizAttempt;
    gradedAnswers: GradedAnswerResult[];
    adaptiveFeedback: string;
    recommendedDifficulty: Difficulty;
    weakTopicsIdentified: string[];
  } | null>(null);

  // Generator form state
  const [genTopic, setGenTopic] = useState('Object-Oriented Programming');
  const [genDifficulty, setGenDifficulty] = useState<Difficulty>('intermediate');
  const [genCount, setGenCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Citation modal
  const [citationModal, setCitationModal] = useState<Citation | null>(null);

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0);

  const loadData = async () => {
    if (!selectedCourse) return;
    try {
      const qList = await api.getQuizzes(selectedCourse.id);
      setQuizzes(qList);
      if (qList.length > 0 && !activeQuiz) {
        // Load the full quiz with questions
        const fullQuiz = await api.getQuizById(qList[0].id);
        setActiveQuiz(fullQuiz);
      }

      const attList = await api.getQuizAttempts(selectedCourse.id);
      setAttempts(attList);
    } catch (err) {
      console.error('Failed to load quiz data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCourse]);

  // Quiz timer
  useEffect(() => {
    let interval: any;
    if (activeQuiz && !quizSubmitted) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeQuiz, quizSubmitted]);

  const handleGenerateQuiz = async () => {
    if (!selectedCourse || generating) return;
    setGenerating(true);
    try {
      const newQuiz = await api.generateQuiz({
        courseId: selectedCourse.id,
        topic: genTopic,
        difficulty: genDifficulty,
        questionsCount: genCount,
      });
      setQuizzes([newQuiz, ...quizzes]);
      setActiveQuiz(newQuiz);
      setUserAnswers({});
      setQuizSubmitted(false);
      setSubmissionResult(null);
      setTimerSeconds(0);
    } catch (err: any) {
      alert(`Quiz generation failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectQuiz = async (quizId: string) => {
    try {
      const full = await api.getQuizById(quizId);
      setActiveQuiz(full);
      setUserAnswers({});
      setQuizSubmitted(false);
      setSubmissionResult(null);
      setTimerSeconds(0);
    } catch (err: any) {
      alert(`Could not load quiz: ${err.message}`);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz || submitting) return;
    setSubmitting(true);

    const answersPayload = (activeQuiz.questions || []).map((q) => ({
      question_id: q.id,
      user_answer: userAnswers[q.id] || '',
    }));

    try {
      const result = await api.submitQuiz(activeQuiz.id, {
        answers: answersPayload,
        timeTakenSeconds: timerSeconds,
      });
      setSubmissionResult(result);
      setQuizSubmitted(true);
      // Reload attempts
      loadData();
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setUserAnswers({});
    setQuizSubmitted(false);
    setSubmissionResult(null);
    setTimerSeconds(0);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Citation Modal */}
      <CitationModal citation={citationModal} onClose={() => setCitationModal(null)} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Adaptive Assessment Engine
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
            Quiz & Assessments
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Grounded assessments that dynamically calibrate difficulty based on verified competency rules.
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
          <button
            onClick={() => setActiveTab('take')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === 'take' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Active Quiz</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === 'history' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Attempt History ({attempts.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'take' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Generator & Quiz Selector */}
          <div className="space-y-6">
            {/* Generator Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Generate New Quiz</h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Topic or Concept</label>
                  <input
                    type="text"
                    value={genTopic}
                    onChange={(e) => setGenTopic(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g. Inheritance, Polymorphism"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Difficulty</label>
                    <select
                      value={genDifficulty}
                      onChange={(e) => setGenDifficulty(e.target.value as Difficulty)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Questions</label>
                    <select
                      value={genCount}
                      onChange={(e) => setGenCount(parseInt(e.target.value, 10))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="3">3 Questions</option>
                      <option value="5">5 Questions</option>
                      <option value="8">8 Questions</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleGenerateQuiz}
                  disabled={generating}
                  className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {generating ? 'Generating from Sources...' : 'Generate Grounded Quiz'}
                </button>
              </div>
            </div>

            {/* Available Quizzes List */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Available Quizzes</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {quizzes.map((q) => (
                  <div
                    key={q.id}
                    onClick={() => handleSelectQuiz(q.id)}
                    className={`rounded-xl border p-3 cursor-pointer transition text-xs ${
                      activeQuiz?.id === q.id
                        ? 'border-indigo-500 bg-indigo-50/50'
                        : 'border-slate-200 bg-slate-50/30 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{q.title}</span>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                        {q.difficulty}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {q.questions_count} questions · Grounded in course chunks
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Quiz Taking & Graded Feedback */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            {!activeQuiz ? (
              <div className="py-24 text-center">
                <HelpCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No active quiz selected</p>
                <p className="text-xs text-slate-400 mt-1">Select a quiz or generate one on the left.</p>
              </div>
            ) : !quizSubmitted ? (
              /* Quiz Taking Mode */
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                      Assessment in Progress
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">{activeQuiz.title}</h2>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-xs font-semibold text-slate-700">
                    <Clock className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
                    <span>{timerSeconds}s</span>
                  </div>
                </div>

                {/* Questions List */}
                <div className="space-y-6">
                  {(activeQuiz.questions || []).map((q, qIndex) => (
                    <div key={q.id} className="rounded-xl border border-slate-200 p-5 bg-slate-50/30">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
                          {qIndex + 1}
                        </span>
                        <p className="flex-1 text-sm font-medium text-slate-800 leading-relaxed">
                          {q.question_text}
                        </p>
                      </div>

                      {/* Multiple Choice Options */}
                      {q.question_type === 'multiple_choice' && q.options && (
                        <div className="mt-3 space-y-2">
                          {q.options.map((opt, optIdx) => (
                            <label
                              key={optIdx}
                              className={`flex items-center gap-3 rounded-xl border p-3 text-xs font-medium cursor-pointer transition ${
                                userAnswers[q.id] === opt
                                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`question_${q.id}`}
                                value={opt}
                                checked={userAnswers[q.id] === opt}
                                onChange={() =>
                                  setUserAnswers({ ...userAnswers, [q.id]: opt })
                                }
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="leading-snug">{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Short Answer Input */}
                      {q.question_type === 'short_answer' && (
                        <div className="mt-3">
                          <textarea
                            rows={3}
                            value={userAnswers[q.id] || ''}
                            onChange={(e) =>
                              setUserAnswers({ ...userAnswers, [q.id]: e.target.value })
                            }
                            placeholder="Type your explanation based on course materials..."
                            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Submit Action */}
                <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {Object.keys(userAnswers).length} of {activeQuiz.questions?.length || 0} answered
                  </span>
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={submitting}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    <span>{submitting ? 'Grading & Adapting...' : 'Submit Answers'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* Graded Submission Results & Adaptive Rules Feedback */
              <div className="space-y-6">
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6 text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white mb-3 shadow-md">
                    <Award className="h-6 w-6" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Quiz Score: {submissionResult?.attempt.score} / {submissionResult?.attempt.total_questions} ({submissionResult?.attempt.percentage}%)
                  </h2>
                  <p className="text-xs font-medium text-slate-600 mt-2 max-w-lg mx-auto">
                    {submissionResult?.adaptiveFeedback}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <span className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      Next Recommended Difficulty: <strong className="text-indigo-600 uppercase">{submissionResult?.recommendedDifficulty}</strong>
                    </span>
                    {submissionResult?.weakTopicsIdentified && submissionResult.weakTopicsIdentified.length > 0 && (
                      <span className="rounded-md bg-rose-100 border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-800">
                        Weak Topic Identified: {submissionResult.weakTopicsIdentified.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Graded Questions Breakdown */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Detailed Answer Review & Supporting Citations</h3>
                  {submissionResult?.gradedAnswers.map((ans, idx) => (
                    <div
                      key={ans.question_id}
                      className={`rounded-xl border p-4 text-xs transition ${
                        ans.is_correct
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : 'border-rose-200 bg-rose-50/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {ans.is_correct ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                          )}
                          <span className="font-bold text-slate-900">
                            Question {idx + 1}: {ans.question_text}
                          </span>
                        </div>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            ans.is_correct ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {ans.is_correct ? 'Correct' : 'Needs Review'}
                        </span>
                      </div>

                      <p className="text-slate-600 mt-1">
                        <strong>Your Answer:</strong> {ans.user_answer || '(Empty)'}
                      </p>
                      {!ans.is_correct && (
                        <p className="text-slate-800 mt-1 font-semibold">
                          <strong>Correct Answer:</strong> {ans.correct_answer}
                        </p>
                      )}

                      <div className="mt-2 rounded-lg bg-white/80 p-2.5 border border-slate-200">
                        <p className="text-slate-600">
                          <strong>Source Explanation:</strong> {ans.explanation}
                        </p>
                        {ans.citation && (
                          <button
                            onClick={() => setCitationModal(ans.citation!)}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            <Bookmark className="h-3 w-3" />
                            <span>View Source: {ans.citation.material_title} ({ans.citation.unit_label})</span>
                          </button>
                        )}
                      </div>

                      {!ans.is_correct && (
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[11px] text-rose-700 italic">
                            Misconception detected for topic: {ans.topic}
                          </span>
                          <button
                            onClick={() => navigate('/misconceptions')}
                            className="text-xs font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
                          >
                            <span>Inspect Misconception</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Retry Quiz</span>
                  </button>
                  <button
                    onClick={() => navigate('/study-plan')}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                  >
                    <span>View Updated Study Plan</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Attempt History Tab */
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-4">Historical Quiz Attempts</h2>
          {attempts.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center italic">No quiz attempts recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 font-semibold uppercase text-slate-400">
                  <tr>
                    <th className="pb-3 pl-1">Quiz Title</th>
                    <th className="pb-3">Score</th>
                    <th className="pb-3">Accuracy</th>
                    <th className="pb-3">Duration</th>
                    <th className="pb-3">Completed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attempts.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 pl-1 font-semibold text-slate-900">
                        {att.quiz_title || 'Adaptive Diagnostic Quiz'}
                      </td>
                      <td className="py-3 text-slate-700">
                        {att.score} / {att.total_questions}
                      </td>
                      <td className="py-3 font-semibold text-indigo-600">
                        {att.percentage}%
                      </td>
                      <td className="py-3 text-slate-500 font-mono">
                        {att.time_taken_seconds}s
                      </td>
                      <td className="py-3 text-slate-400">
                        {new Date(att.completed_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

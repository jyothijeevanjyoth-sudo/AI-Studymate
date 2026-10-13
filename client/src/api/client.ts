import {
  Course,
  LearningMaterial,
  Conversation,
  ChatMessage,
  Quiz,
  QuizAttempt,
  GradedAnswerResult,
  Misconception,
  LearningTwinProfile,
  WhatIfSimulationRequest,
  WhatIfSimulationResult,
  StudyTimeStats,
  StudySession,
  DashboardStats,
  TopicPerformance,
  StudyPlan,
  SystemStatus,
  TutorMode,
  Difficulty,
  QuestionType,
} from '../../../shared/types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const json = await res.json();
      errorMsg = json.error || json.details || errorMsg;
    } catch {
      errorMsg = await res.text();
    }
    throw new Error(errorMsg);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Courses
  getCourses: () => request<Course[]>('/courses'),
  createCourse: (data: { code: string; title: string; description: string }) =>
    request<Course>('/courses', { method: 'POST', body: JSON.stringify(data) }),

  // Learning Materials
  getMaterials: (courseId?: string) =>
    request<LearningMaterial[]>(courseId ? `/materials?courseId=${courseId}` : '/materials'),
  
  uploadMaterial: async (formData: FormData): Promise<{ message: string; material: LearningMaterial }> => {
    const res = await fetch(`${API_BASE}/materials/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },

  previewMaterial: (id: string) =>
    request<{ material: LearningMaterial; chunks: any[] }>(`/materials/${id}/preview`),
  
  deleteMaterial: (id: string) =>
    request<{ message: string }>(`/materials/${id}`, { method: 'DELETE' }),

  reprocessMaterial: (id: string) =>
    request<{ message: string; chunks_count: number }>(`/materials/${id}/reprocess`, { method: 'POST' }),

  // AI Tutor
  getConversations: (courseId?: string) =>
    request<Conversation[]>(courseId ? `/tutor/conversations?courseId=${courseId}` : '/tutor/conversations'),

  createConversation: (data: { courseId: string; title?: string }) =>
    request<Conversation>('/tutor/conversations', { method: 'POST', body: JSON.stringify(data) }),

  deleteConversation: (id: string) =>
    request<{ message: string }>(`/tutor/conversations/${id}`, { method: 'DELETE' }),

  getMessages: (conversationId: string) =>
    request<ChatMessage[]>(`/tutor/conversations/${conversationId}/messages`),

  sendMessage: (
    conversationId: string,
    data: { content: string; mode?: TutorMode; materialIds?: string[] }
  ) =>
    request<{ message: ChatMessage; provider: string }>(
      `/tutor/conversations/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  // Quizzes & Assessments
  generateQuiz: (data: {
    courseId: string;
    topic?: string;
    difficulty?: Difficulty;
    questionsCount?: number;
    questionType?: QuestionType;
  }) => request<Quiz>('/quiz/generate', { method: 'POST', body: JSON.stringify(data) }),

  getQuizzes: (courseId?: string) =>
    request<Quiz[]>(courseId ? `/quiz?courseId=${courseId}` : '/quiz'),

  getQuizById: (id: string) => request<Quiz>(`/quiz/${id}`),

  submitQuiz: (
    quizId: string,
    data: { answers: Array<{ question_id: string; user_answer: string }>; timeTakenSeconds?: number }
  ) =>
    request<{
      attempt: QuizAttempt;
      gradedAnswers: GradedAnswerResult[];
      adaptiveFeedback: string;
      recommendedDifficulty: Difficulty;
      weakTopicsIdentified: string[];
    }>(`/quiz/${quizId}/submit`, { method: 'POST', body: JSON.stringify(data) }),

  getQuizAttempts: (courseId?: string) =>
    request<QuizAttempt[]>(courseId ? `/quiz/attempts/history?courseId=${courseId}` : '/quiz/attempts/history'),

  // Misconception Detective
  getMisconceptions: (courseId?: string, unresolved = false) =>
    request<Misconception[]>(
      `/misconceptions?courseId=${courseId || ''}&unresolved=${unresolved ? 'true' : 'false'}`
    ),

  verifyMisconception: (id: string, answer: string) =>
    request<{ isCorrect: boolean; feedback: string; wasResolved: boolean }>(
      `/misconceptions/${id}/verify`,
      { method: 'POST', body: JSON.stringify({ answer }) }
    ),

  // Learning Twin & What-If Simulator
  getLearningTwin: (courseId: string) =>
    request<LearningTwinProfile>(`/learning-twin?courseId=${courseId}`),

  simulateWhatIf: (data: WhatIfSimulationRequest) =>
    request<WhatIfSimulationResult>('/learning-twin/simulate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Daily Study Time Tracker
  getStudyTrackerStats: (courseId?: string) =>
    request<StudyTimeStats>(courseId ? `/study-tracker/stats?courseId=${courseId}` : '/study-tracker/stats'),

  recordStudySession: (data: {
    courseId: string;
    durationSeconds: number;
    sessionType?: 'platform' | 'offline_logged';
    notes?: string;
    startedAt?: string;
    endedAt?: string;
  }) => request<StudySession>('/study-tracker/session', { method: 'POST', body: JSON.stringify(data) }),

  // Analytics & Dashboard
  getDashboardStats: (courseId?: string) =>
    request<DashboardStats>(courseId ? `/analytics/dashboard?courseId=${courseId}` : '/analytics/dashboard'),

  getTopicPerformance: (courseId?: string) =>
    request<TopicPerformance[]>(courseId ? `/analytics/topics?courseId=${courseId}` : '/analytics/topics'),

  // Personalized Study Plan
  getStudyPlan: (courseId: string) => request<StudyPlan>(`/study-plan?courseId=${courseId}`),

  generateStudyPlan: (data: { courseId: string; dailyGoalMinutes?: number; targetDate?: string }) =>
    request<StudyPlan>('/study-plan/generate', { method: 'POST', body: JSON.stringify(data) }),

  togglePlanActivity: (activityId: string, isCompleted: boolean) =>
    request<{ message: string }>(`/study-plan/activities/${activityId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isCompleted }),
    }),

  // Settings & System Readiness
  getSystemStatus: () => request<SystemStatus>('/settings/status'),

  seedDatabase: () => request<{ message: string; result: any }>('/settings/seed', { method: 'POST' }),
};

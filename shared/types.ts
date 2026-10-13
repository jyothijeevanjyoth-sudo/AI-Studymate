export type FileType = 'pdf' | 'pptx' | 'txt' | 'transcript' | 'video';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type TutorMode = 'standard' | 'beginner' | 'step_by_step' | 'analogy' | 'practice';
export type QuestionType = 'multiple_choice' | 'short_answer';
export type TopicStatus = 'mastered' | 'practicing' | 'needs_improvement' | 'insufficient_data';

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  material_count?: number;
  created_at: string;
}

export interface LearningMaterial {
  id: string;
  course_id: string;
  course_title?: string;
  title: string;
  file_name: string;
  file_type: FileType;
  file_path: string;
  file_size: number;
  processing_status: ProcessingStatus;
  error_message?: string | null;
  total_units?: number | null; // pages, slides, or timestamp segments
  unit_type?: 'page' | 'slide' | 'timestamp' | 'section';
  chunk_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ChunkMetadata {
  material_id: string;
  material_title: string;
  file_type: FileType;
  page?: number;
  slide?: number;
  timestamp?: string;
  unit_label?: string; // e.g., "Page 12", "Slide 5", "03:45"
  topic?: string;
}

export interface DocumentChunk {
  id: string;
  material_id: string;
  course_id: string;
  chunk_index: number;
  content: string;
  metadata: ChunkMetadata;
  created_at: string;
}

export interface Citation {
  material_id: string;
  material_title: string;
  file_type: FileType;
  page?: number;
  slide?: number;
  timestamp?: string;
  unit_label: string; // e.g. "Page 4", "Slide 12", "04:15"
  snippet: string;
  relevance_score?: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  is_fallback?: boolean;
  tutor_mode?: TutorMode;
  created_at: string;
}

export interface Conversation {
  id: string;
  course_id: string;
  course_title?: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface QuizQuestion {
  id: string;
  quiz_id?: string;
  question_text: string;
  question_type: QuestionType;
  options?: string[]; // for multiple choice
  correct_answer: string;
  explanation: string;
  topic: string;
  difficulty: Difficulty;
  citation?: Citation;
}

export interface Quiz {
  id: string;
  course_id: string;
  course_title?: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  questions_count: number;
  is_adaptive?: boolean;
  created_at: string;
  questions?: QuizQuestion[];
}

export interface SubmittedAnswer {
  question_id: string;
  user_answer: string;
}

export interface GradedAnswerResult {
  question_id: string;
  question_text: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;
  topic: string;
  difficulty: Difficulty;
  citation?: Citation;
  recommendation?: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  quiz_title?: string;
  score: number;
  total_questions: number;
  percentage: number;
  passed: boolean;
  time_taken_seconds: number;
  completed_at: string;
  answers?: GradedAnswerResult[];
}

export interface TopicPerformance {
  topic: string;
  course_id: string;
  total_questions: number;
  correct_answers: number;
  accuracy: number; // 0 - 100
  status: TopicStatus;
  recommended_difficulty: Difficulty;
  last_practiced: string;
  recent_trend?: 'improving' | 'declining' | 'stable';
}

export interface StudyPlanActivity {
  id: string;
  topic: string;
  title: string;
  description: string;
  activity_type: 'review_material' | 'practice_quiz' | 'ask_tutor' | 'flashcards';
  material_id?: string;
  material_title?: string;
  unit_reference?: string; // e.g. "Page 15-20" or "Slide 4-8"
  estimated_minutes: number;
  priority: 'high' | 'medium' | 'low';
  is_completed: boolean;
  completed_at?: string;
}

export interface StudyPlan {
  id: string;
  course_id: string;
  daily_goal_minutes: number;
  target_date?: string;
  created_at: string;
  updated_at: string;
  activities: StudyPlanActivity[];
}

export interface Misconception {
  id: string;
  attempt_id: string;
  question_id: string;
  topic: string;
  misconception_text: string;
  evidence_explanation: string;
  follow_up_question: {
    question_text: string;
    options: string[];
    correct_answer: string;
    explanation: string;
  };
  is_resolved: boolean;
  resolved_at?: string;
  created_at: string;
}

export interface TopicTwin {
  topic: string;
  estimated_mastery: number; // 0 - 100
  confidence_level: number;  // 0 - 100 based on number of evidence points
  status: TopicStatus;
  total_evidence_count: number;
  recent_trend: 'improving' | 'declining' | 'stable';
  active_misconceptions: string[];
  recommended_next_step: string;
}

export interface LearningTwinProfile {
  student_id: string;
  course_id: string;
  overall_readiness_pct: number;
  overall_confidence: number;
  learning_velocity: string; // e.g. "Accelerating (+12% this week)"
  cognitive_readiness_note: string;
  topic_twins: TopicTwin[];
  unresolved_misconceptions_count: number;
  last_updated: string;
}

export interface StudySession {
  id: string;
  course_id: string;
  course_title?: string;
  duration_seconds: number;
  duration_minutes: number;
  session_type: 'platform' | 'offline_logged';
  notes?: string;
  started_at: string;
  ended_at: string;
  created_at: string;
}

export interface StudyTimeStats {
  today_minutes: number;
  week_minutes: number;
  total_minutes: number;
  subject_breakdown: Array<{
    course_id: string;
    course_title: string;
    minutes: number;
  }>;
  recent_sessions: StudySession[];
}

export interface WhatIfSimulationRequest {
  course_id: string;
  planned_study_minutes: number;
  focus_topics: string[];
  planned_quizzes_count: number;
}

export interface WhatIfSimulationResult {
  projected_readiness_pct: number;
  readiness_delta: number;
  projected_topic_outcomes: Array<{
    topic: string;
    current_mastery: number;
    projected_mastery: number;
    projected_status: TopicStatus;
    confidence_gain: number;
  }>;
  estimated_study_hours: number;
  disclaimer: string;
}

export interface DashboardStats {
  total_resources: number;
  study_sessions_completed: number;
  total_study_minutes: number;
  overall_quiz_accuracy: number;
  topics_mastered_count: number;
  topics_needing_improvement_count: number;
  mastered_topics: string[];
  weak_topics: string[];
  recent_activity: Array<{
    id: string;
    type: 'upload' | 'quiz' | 'tutor' | 'plan';
    title: string;
    description: string;
    timestamp: string;
    status?: string;
  }>;
  recommended_task: {
    title: string;
    topic: string;
    reason: string;
    action_type: 'quiz' | 'tutor' | 'review';
    action_target_id?: string;
  };
  progress_history: Array<{
    date: string;
    accuracy: number;
    quizzes: number;
  }>;
}

export interface SystemStatus {
  ai_provider: string;
  ai_configured: boolean;
  stt_provider: string;
  stt_configured: boolean;
  database_ready: boolean;
  total_materials: number;
  total_chunks: number;
}


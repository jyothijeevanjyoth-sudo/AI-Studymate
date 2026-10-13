-- ==============================================================================
-- AI StudyMate — Database Schema (SQLite)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS learning_materials (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'pdf', 'pptx', 'txt', 'transcript', 'video'
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'processing', 'completed', 'error'
    error_message TEXT,
    total_units INTEGER DEFAULT 0,
    unit_type TEXT DEFAULT 'page', -- 'page', 'slide', 'timestamp', 'section'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL REFERENCES learning_materials(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    page_num INTEGER,
    slide_num INTEGER,
    timestamp_val TEXT,
    unit_label TEXT NOT NULL,
    topic TEXT NOT NULL DEFAULT 'General',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chunks_course ON document_chunks(course_id);
CREATE INDEX IF NOT EXISTS idx_chunks_material ON document_chunks(material_id);
CREATE INDEX IF NOT EXISTS idx_chunks_topic ON document_chunks(topic);

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    citations_json TEXT, -- JSON Array of Citation
    is_fallback INTEGER NOT NULL DEFAULT 0,
    tutor_mode TEXT NOT NULL DEFAULT 'standard',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id);

CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'intermediate', -- 'beginner', 'intermediate', 'advanced'
    questions_count INTEGER NOT NULL,
    is_adaptive INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id TEXT PRIMARY KEY,
    quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'multiple_choice', -- 'multiple_choice', 'short_answer'
    options_json TEXT, -- JSON Array of string options
    correct_answer TEXT NOT NULL,
    explanation TEXT NOT NULL,
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'intermediate',
    citation_json TEXT -- JSON Citation
);

CREATE INDEX IF NOT EXISTS idx_questions_quiz ON quiz_questions(quiz_id);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT PRIMARY KEY,
    quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    percentage REAL NOT NULL,
    passed INTEGER NOT NULL,
    time_taken_seconds INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attempt_answers (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    user_answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL,
    feedback TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topic_performance (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    accuracy REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'insufficient_data', -- 'mastered', 'practicing', 'needs_improvement', 'insufficient_data'
    recommended_difficulty TEXT NOT NULL DEFAULT 'beginner',
    last_practiced TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(course_id, topic)
);

CREATE TABLE IF NOT EXISTS study_plans (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    daily_goal_minutes INTEGER NOT NULL DEFAULT 30,
    target_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS study_plan_activities (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    activity_type TEXT NOT NULL, -- 'review_material', 'practice_quiz', 'ask_tutor', 'flashcards'
    material_id TEXT REFERENCES learning_materials(id) ON DELETE SET NULL,
    unit_reference TEXT,
    estimated_minutes INTEGER NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS misconceptions (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    misconception_text TEXT NOT NULL,
    evidence_explanation TEXT NOT NULL,
    follow_up_question_json TEXT NOT NULL,
    is_resolved INTEGER NOT NULL DEFAULT 0,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_misconceptions_course ON misconceptions(course_id);
CREATE INDEX IF NOT EXISTS idx_misconceptions_resolved ON misconceptions(is_resolved);

CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    duration_seconds INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    session_type TEXT NOT NULL DEFAULT 'platform', -- 'platform', 'offline_logged'
    notes TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_course ON study_sessions(course_id);

CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);


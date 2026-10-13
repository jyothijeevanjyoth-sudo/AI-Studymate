# AI StudyMate — REST API Documentation

Base URL: `http://localhost:5000/api`

---

## 1. System & Readiness

### `GET /api/health`
Health check endpoint reporting uptime and environment.
* **Response (200 OK)**:
```json
{
  "status": "healthy",
  "uptime": 124,
  "timestamp": "2026-10-12T15:30:00.000Z",
  "environment": "development"
}
```

### `GET /api/settings/status`
Returns status of external LLM credentials, STT services, and SQLite storage.
* **Response (200 OK)**:
```json
{
  "ai_provider": "gemini",
  "ai_configured": false,
  "stt_provider": "mock",
  "stt_configured": true,
  "database_ready": true,
  "total_materials": 3,
  "total_chunks": 13
}
```

### `POST /api/settings/seed`
Seeds sample CS101 course, materials, chunks, quizzes, and active misconceptions.

---

## 2. Courses

### `GET /api/courses`
Returns list of all courses with associated material counts.

### `POST /api/courses`
Creates a new course.
* **Request Body**:
```json
{
  "code": "CS201",
  "title": "Data Structures & Algorithms",
  "description": "Advanced trees, graphs, and dynamic programming."
}
```

---

## 3. Learning Materials

### `GET /api/materials?courseId={id}`
Returns all uploaded materials filtered by course.

### `POST /api/materials/upload`
Uploads and indexes an educational document (`multipart/form-data`).
* **Fields**:
  * `file`: Binary file (`.pdf`, `.pptx`, `.txt`, `.md`, `.vtt`, `.srt`, `.mp4`)
  * `courseId`: string
  * `title`: string (optional)
* **Response (201 Created)**:
```json
{
  "message": "Material uploaded and processed successfully",
  "material": {
    "id": "mat_1791819500000",
    "title": "Java Lecture 08",
    "file_type": "pptx",
    "total_units": 5,
    "unit_type": "slide"
  },
  "extracted_units": 5,
  "chunks_generated": 5
}
```

### `GET /api/materials/:id/preview`
Returns extracted units (pages, slides, timestamps) and text chunks for previewing.

### `DELETE /api/materials/:id`
Deletes the material and cascades deletion across all associated chunks.

### `POST /api/materials/:id/reprocess`
Re-extracts and re-chunks the physical file on disk.

---

## 4. AI Tutor & RAG

### `GET /api/tutor/conversations?courseId={id}`
Lists conversation sessions for a course.

### `POST /api/tutor/conversations`
Creates a new conversation session.

### `GET /api/tutor/conversations/:id/messages`
Retrieves chat messages and citations.

### `POST /api/tutor/conversations/:id/messages`
Sends student question, performs source retrieval, and returns answer with verifiable citations.
* **Request Body**:
```json
{
  "content": "What is dynamic method dispatch?",
  "mode": "standard" // "standard" | "beginner" | "step_by_step" | "analogy" | "practice"
}
```
* **Response (201 Created)**:
```json
{
  "message": {
    "id": "msg_a_123",
    "sender": "assistant",
    "content": "Dynamic method dispatch executes overridden methods based on actual runtime object type...",
    "citations": [
      {
        "material_id": "mat_slides_lec08",
        "material_title": "CS101 Lecture 08: Inheritance & Dynamic Polymorphism",
        "file_type": "pptx",
        "unit_label": "Slide 1",
        "snippet": "In Java, dynamic method dispatch uses the actual runtime object type...",
        "relevance_score": 0.88
      }
    ],
    "is_fallback": true,
    "tutor_mode": "standard"
  },
  "provider": "StudyMate Extractive Engine (Offline / Fallback)"
}
```

---

## 5. Quizzes & Assessments

### `POST /api/quiz/generate`
Generates a quiz grounded in course chunks.
* **Request Body**:
```json
{
  "courseId": "crs_cs101_java",
  "topic": "Inheritance",
  "difficulty": "intermediate",
  "questionsCount": 3
}
```

### `GET /api/quiz/:id`
Retrieves quiz questions and options.

### `POST /api/quiz/:id/submit`
Grades submission, adaptively updates topic performance, and flags misconceptions.
* **Request Body**:
```json
{
  "answers": [
    { "question_id": "q_1", "user_answer": "Selected Option A" }
  ],
  "timeTakenSeconds": 45
}
```
* **Response (200 OK)**:
```json
{
  "attempt": {
    "id": "att_123",
    "score": 1,
    "total_questions": 3,
    "percentage": 33,
    "passed": false
  },
  "gradedAnswers": [ ... ],
  "adaptiveFeedback": "Performance is below 50%. Foundational revision recommended.",
  "recommendedDifficulty": "beginner",
  "weakTopicsIdentified": ["Inheritance"]
}
```

---

## 6. Misconception Detective

### `GET /api/misconceptions?courseId={id}&unresolved={true|false}`
Returns detected misconceptions with explanations and follow-up challenges.

### `POST /api/misconceptions/:id/verify`
Checks student's follow-up verification answer and resolves misconception upon correct response.
* **Request Body**:
```json
{
  "answer": "No, private variables are restricted to the declaring class..."
}
```
* **Response (200 OK)**:
```json
{
  "isCorrect": true,
  "feedback": "Outstanding! You successfully resolved this misconception.",
  "wasResolved": true
}
```

---

## 7. Learning Twin & What-If Simulator

### `GET /api/learning-twin?courseId={id}`
Returns student's Cognitive Learning Twin profile with topic mastery and sample-size calibrated confidence levels.

### `POST /api/learning-twin/simulate`
Simulates hypothetical learning scenarios.
* **Request Body**:
```json
{
  "course_id": "crs_cs101_java",
  "planned_study_minutes": 45,
  "focus_topics": ["Inheritance"],
  "planned_quizzes_count": 2
}
```
* **Response (200 OK)**:
```json
{
  "projected_readiness_pct": 76,
  "readiness_delta": 12,
  "projected_topic_outcomes": [ ... ],
  "estimated_study_hours": 0.8,
  "disclaimer": "Disclaimer: Simulated projections are mathematical estimates..."
}
```

---

## 8. Daily Study Time Tracker

### `GET /api/study-tracker/stats?courseId={id}`
Returns today's, weekly, and total study minutes alongside subject breakdown.

### `POST /api/study-tracker/session`
Persists a validated study session (`durationSeconds` must be $1 \le t \le 86400$).

# AI StudyMate — Your Personal AI Learning Companion

**Track D: Personalized Tutoring & Adaptive Learning | Multimodal AI Hackathon 2026**

[![Node.js](https://img.shields.io/badge/Node.js-v24+-339933?logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/SQLite-WAL--Mode-003B57?logo=sqlite)](https://sqlite.org)
[![Status](https://img.shields.io/badge/Hackathon--Readiness-Verified-10B981)](#)

---

## 🌟 Overview & Problem Statement

Modern students juggle disjointed educational materials: dense PDF textbooks, slide decks, video lectures, and lecture notes. **AI StudyMate** unifies these heterogeneous learning assets into a verifiable, source-cited knowledge base and powers:

1. **Source-Cited Multimodal RAG**: Grounds answers in student notes, slides, and transcripts with exact page, slide, and timestamp citations. Never fabricates citations.
2. **Adaptive Assessment Engine**: Generates grounded quizzes with dynamic difficulty calibration (<50% beginner, 50-79% intermediate, ≥80% advanced/mastered).
3. **Misconception Detective**: Automatically catches incorrect answers, pinpoints conceptual fallacies, presents verified course evidence, and challenges the student with follow-up verification questions.
4. **Cognitive Learning Twin & What-If Simulator**: A probabilistic representation of student competency tracking mastery estimates and sample-size confidence, alongside a What-If simulator to forecast study outcomes.
5. **Daily Study Time Tracker**: Real-time stopwatch and session logger persistent across browser page refreshes.
6. **Dynamic Personalized Study Plan**: Automatically creates actionable roadmaps targeting verified weak topics and links directly to textbook pages and slide numbers.
7. **Reliable Offline Fallback**: Operates 100% out of the box with zero external API dependencies via deterministic extractive retrieval.

---

## 🏗️ Technology Stack

* **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Recharts.
* **Backend**: Node.js 24, Express, TypeScript, Zod, Multer.
* **Database**: Native `node:sqlite` (SQLite in WAL mode) — zero C++ native compilation errors on Windows.
* **Document Extractors**:
  * PDF: Page-level text extraction preserving page boundaries (`pdf-parse`).
  * PPTX: Slide-level XML parsing preserving sequential slide numbers (`adm-zip`).
  * Transcripts: WebVTT / SRT / timestamped TXT parser preserving cue timestamps.
* **Testing**: Vitest + Supertest integration test suite covering critical learning workflows.

---

## 🚀 Quickstart Guide

### 1. Prerequisites
* **Node.js**: v20 or v24+ (Node 24 recommended).
* **npm**: v10+.

### 2. Install Dependencies
Run the install command from the root directory:
```bash
npm run install:all
```
*(Or install separately: `npm install`, `cd server && npm install`, `cd client && npm install`)*

### 3. Environment Configuration
The repository includes an active `.env` file pre-configured for offline fallback mode:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
AI_PROVIDER=gemini
GEMINI_API_KEY=
OPENAI_API_KEY=
STT_PROVIDER=mock
DATABASE_PATH=./data/studymate.sqlite
UPLOAD_DIR=./uploads
ENABLE_DEMO_SEEDING=true
```
*Note: AI StudyMate runs reliably in fallback mode without API keys. To connect live LLMs, optionally insert your `GEMINI_API_KEY` or `OPENAI_API_KEY` in `server/.env`.*

### 4. Seed the Demo Dataset
Seed the pre-packaged CS101 Object-Oriented Programming sample course, materials, chunks, quizzes, and misconceptions:
```bash
npm run seed
```

### 5. Launch the Application
Run both frontend and backend concurrently:
```bash
npm run dev
```

* **Client**: Open [http://localhost:5173](http://localhost:5173) in your browser.
* **Server**: Running at [http://localhost:5000](http://localhost:5000) (Health check: `/api/health`).

---

## 🧪 Running Automated Tests

AI StudyMate includes comprehensive integration tests verifying courses, materials, citation retrieval, quiz generation, adaptive grading, misconception detection, learning twin models, and study session tracking:
```bash
npm test
```
Or directly:
```bash
node server/node_modules/vitest/vitest.mjs run
```

---

## 🎯 10-Step Hackathon Demonstration Walkthrough

Follow these steps for a live judge demonstration:

1. **Dashboard (`/`)**:
   * Inspect the real metrics: Total Resources (3), Study Time (95 mins), Overall Accuracy, Mastered Topics (1), and Weak Topics (1: `Inheritance`).
   * Note the AI Recommended Next Step: *"Targeted Revision: Inheritance"*.

2. **Learning Materials (`/materials`)**:
   * View the 3 indexed resources: PDF textbook (4 pages), PPTX slides (5 slides), VTT transcript (4 timestamps).
   * Click the **Eye icon** to preview extracted units and view preserved `Page 1`, `Slide 2`, `02:30` coordinates.
   * Upload any custom PDF, PPTX, or notes file via drag-and-drop.

3. **AI Tutor (`/tutor`)**:
   * Ask: *"How does dynamic method dispatch work in Java polymorphism?"*
   * Click any pedagogical mode pill: **Beginner**, **Step-by-Step**, or **Analogy**.
   * View the answer and click the citation pill `[CS101 Lecture 08 Slides (Slide 2)]` to view the authentic grounded passage.

4. **Quiz & Assessments (`/quiz`)**:
   * Select the active **CS101 OOP Diagnostic Quiz**.
   * Answer the questions and click **Submit Answers**.
   * Observe immediate grading, adaptive difficulty calibration, and source citations for each explanation.

5. **Misconception Detective (`/misconceptions`)**:
   * View the active flagged misconception: *"Believing child classes automatically acquire access to private fields of the parent class"*.
   * Read the verified course evidence from Textbook Ch. 4 (Page 2).
   * Complete the interactive verification challenge and click **Verify Understanding** to resolve the misconception.

6. **Learning Twin & What-If Simulator (`/learning-twin`)**:
   * View the student's **Overall Readiness (64%)**, **Diagnostic Confidence (74%)**, and learning velocity.
   * Read the transparent cognitive modeling notice.
   * In the **What-If Simulator**, select focus topic *Inheritance*, set *Planned Study Time: 45 min*, *Planned Quizzes: 2*, and click **Simulate Learning Impact** to see projected gains (+12% delta).

7. **Study Time Tracker (`/tracker`)**:
   * Click **Start Session** on the live stopwatch.
   * Pause, resume, and refresh the browser page — observe that elapsed time persists without loss.
   * Click **Stop & Save** to persist the session to SQLite.
   * Log an offline textbook session using the offline form.

8. **Learning Analytics (`/analytics`)**:
   * View the Recharts interactive charts: Topic Accuracy with 50% (Weak) and 80% (Mastered) reference lines.
   * Inspect accuracy progression across quiz attempts.

9. **Personalized Study Plan (`/study-plan`)**:
   * Observe high-priority tasks generated specifically for weak topic *Inheritance*.
   * Check off an activity and view the completion percentage bar increase.
   * Adjust daily study goal and click **Regenerate Recommendations**.

10. **Settings (`/settings`)**:
    * Check system readiness (SQLite WAL mode, RAG engine, Sandboxing).
    * Use **Reset & Seed Demo Data** to reset the environment at any time.

---

## 🔒 Security & Data Integrity

* **Safe File Storage**: Unique filenames with directory traversal prevention (`path.basename` sanitation).
* **SQL Injection Defense**: Prepared statements with SQLite parameter binding across all endpoints.
* **Secret Isolation**: Zero API keys or secrets exposed to browser bundles.
* **CORS & Size Limits**: Strict origin restriction and 50 MB upload caps.
* **Untrusted Document Handling**: Document text is isolated and treated as passive data.

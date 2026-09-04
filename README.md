# AcogniX

**AcogniX** is a web-based learning platform that connects classroom management with AI-assisted self-study in one system. It is designed for three roles — **Learner**, **Educator**, and **System Administrator** — and combines course management, assessments, AI Workspace tools, learning progress tracking, personal notes, notifications, and administration.

The application is organized into three main parts:

- **Frontend** — React + Vite web application.
- **Main Backend** — Node.js + Express REST API connected to Supabase.
- **AI Microservice** — FastAPI service for document extraction/OCR, AI Tutor, practice quiz generation, flashcard generation, and document embeddings using Gemini.

---

## Table of Contents

1. [Core Features](#1-core-features)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Important Business Rules](#5-important-business-rules)
6. [Prerequisites](#6-prerequisites)
7. [Installation](#7-installation)
8. [Environment Variables](#8-environment-variables)
9. [Supabase Requirements](#9-supabase-requirements)
10. [Run the Application](#10-run-the-application)
11. [Main API Groups](#11-main-api-groups)
12. [AI Service Behavior](#12-ai-service-behavior)
13. [Assessment Behavior](#13-assessment-behavior)
14. [Analytics and Notifications](#14-analytics-and-notifications)
15. [Build for Production](#15-build-for-production)
16. [Testing](#16-testing)
17. [Troubleshooting](#17-troubleshooting)
18. [Security Notes](#18-security-notes)
19. [Known External Dependencies and Limitations](#19-known-external-dependencies-and-limitations)
20. [Repository](#20-repository)

---

# 1. Core Features

## 1.1 Learner

Learners can:

- Sign up, sign in, sign out, and manage their profile.
- Recover access through **Forgot Password**: the backend generates a new temporary password, updates the account credential, revokes active AcogniX sessions, and emails the temporary password to the registered address. The user can then sign in and change the password from Profile/Settings.
- Enroll in courses and view approved course content.
- View course materials and announcements.
- Complete educator-created quizzes and assignments.
- Upload files for assignment submissions where supported.
- Review successfully submitted assessments according to assessment rules.
- Use the **AI Workspace** with class projects and personal projects.
- Upload learning materials for AI-assisted study.
- Ask questions through the **AI Tutor** using selected learning materials as context.
- Generate practice quizzes from learning materials.
- Generate and review flashcard sets.
- Create and manage personal notes.
- View personal learning progress and study statistics.

## 1.2 Educator

Educators can:

- Create and manage courses.
- Archive educator-owned courses and restore courses that were archived by the educator. Courses archived by a System Administrator can only be restored by a System Administrator.
- Manage course information and classroom content.
- Review enrollment requests and manage course members.
- Upload course materials and announcements.
- Create quizzes and assignments.
- Publish, edit, and manage assessments according to assessment status rules.
- Review learner submissions.
- Open submitted learner files from **Submission Review & Grading**.
- Grade assignments manually and provide feedback.
- Update an existing score and feedback after grading.
- View gradebook information.
- View class-performance analytics.
- Receive weekly class-performance report notifications when reports are generated.

## 1.3 System Administrator

System Administrators can:

- Manage learner and educator accounts.
- Ban and unban normal user accounts.
- Delete normal user accounts.
- Change a normal user's role between **Learner** and **Educator**.
- Manage courses across the system, including archiving courses and restoring any archived course.
- Handle support tickets.
- View system/infrastructure information available in the administration area.

### Administrator protection rules

Administrator accounts are protected:

- An administrator account cannot be banned or unbanned through normal user management.
- An administrator account cannot be deleted through normal user management.
- An administrator role cannot be changed to Learner or Educator.
- A Learner or Educator cannot be promoted to System Administrator through the normal role selector.

---

# 2. System Architecture

```text
┌─────────────────────────────┐
│        React Frontend       │
│       Vite + Tailwind       │
└──────────────┬──────────────┘
               │ HTTP/REST
               ▼
┌─────────────────────────────┐
│    Node.js / Express API    │
│ Auth • Courses • Assessment │
│ Analytics • Notes • Admin   │
└───────┬─────────────┬───────┘
        │             │
        │             │ Internal API
        ▼             ▼
┌───────────────┐  ┌──────────────────────┐
│   Supabase    │  │ FastAPI AI Service   │
│ Auth / DB /   │  │ Extraction • Tutor   │
│ Storage / RPC │  │ Quiz • Flashcards    │
└───────────────┘  └──────────┬───────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │  Google Gemini   │
                     └──────────────────┘
```

The browser normally communicates with the **Node.js backend**. The Node.js backend calls the Python AI microservice through an internal shared-secret mechanism.

---

# 3. Technology Stack

## Frontend

- React
- React DOM
- React Router / React Router DOM
- Vite
- Tailwind CSS
- Chart.js
- react-chartjs-2
- react-markdown
- Supabase JavaScript client

## Main Backend

- Node.js
- Express
- Supabase JavaScript client
- Axios
- Socket.IO
- Multer
- Nodemailer
- node-cron
- dotenv
- CORS
- form-data

## AI Microservice

- Python
- FastAPI
- Uvicorn
- Google Gen AI SDK
- Supabase Python client
- PyMuPDF
- python-docx
- pytesseract
- Pillow
- Pydantic
- httpx
- python-multipart
- pytest

## External Services

- **Supabase** — authentication, PostgreSQL database, RPC functions, and file storage.
- **Google Gemini** — generation and embeddings for AI-assisted learning features.
- **Tesseract OCR** — OCR fallback for scanned PDFs and image-based documents.
- **Gmail / Nodemailer** — account and notification email delivery when credentials are configured.

---

# 4. Project Structure

```text
AcogniX/
├── app.js
├── package.json
├── package-lock.json
├── requirements.txt        # legacy/root package list; not Python requirements
├── .env                    # create locally; never commit
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── cron/
│   │   └── weeklyReport.js
│   ├── entities/
│   ├── enums/
│   ├── error/
│   ├── middleware/
│   ├── migrations/
│   ├── routes/
│   └── service/
│ 
├── db/
│   ├── role.sql
│   ├── course_f2a.sql
│   ├── core_tables.sql
│   ├── support_ticket.sql
│   ├── add_ai_feature_tables.sql
│   ├── Add_rag_pgvector.sql
│   └── trigger_indexes.sql
│
├── frontend/
│   ├── index.html
│   └── src/
│       ├── components/
│       ├── contexts/
│       ├── features/
│       ├── hooks/
│       ├── layouts/
│       ├── pages/
│       │   ├── admin/
│       │   ├── auth/
│       │   ├── educator/
│       │   ├── learner/
│       │   └── shared/
│       ├── routes/
│       ├── services/
│       ├── index.css
│       └── main.jsx
│
├── ai_service/
│   ├── .env                # create locally; never commit
│   ├── main.py
│   ├── config.py
│   ├── db.py
│   ├── requirements.txt
│   ├── api/
│   ├── llm_client/
│   ├── middleware/
│   ├── schemas/
│   ├── services/
│   └── tests/
│
├── automated_tests/
│   ├── package-lock.json
│   ├── package.json
│   ├── playwright.config.*
│   ├── fixtures/
│   └── tests/
│
└── dist/
    └── frontend/
```

`dist/frontend/` is generated by `npm run build`. The current `app.js` serves this directory as static content and falls back to `dist/frontend/index.html` for React Router routes.

---

# 5. Important Business Rules

## 5.1 Roles

The application uses three main roles:

```text
LEARNER
EDUCATOR
SYSTEM_ADMINISTRATOR
```

Normal account role changes are limited to:

```text
LEARNER ↔ EDUCATOR
```

System Administrator accounts are protected from normal account-management operations.

## 5.2 AI Workspace projects

Learners use two types of AI projects:

- **Class Project** — associated with an enrolled class.
- **Personal Project** — created manually by the learner.

Learning materials selected in a project are used as AI context for supported AI Workspace features.

## 5.3 Flashcard progress

The **Flashcards Reviewed** progress metric counts reviewed **flashcard sets/decks**, not the number of individual cards inside each set.

Example:

```text
6 completed flashcard sets = Flashcards Reviewed: 6
```

A set containing 20 cards still contributes **1** completed flashcard set when the set-level review requirement is satisfied.

## 5.4 Active study time

Active study tracking is intended to represent meaningful study interaction rather than simply keeping a page open. The tracking flow supports session checkpoints, idle exclusion, disconnection handling, and merging of overlapping study-session data where applicable.

## 5.5 Course archive and restore

Course archiving preserves course history instead of deleting the course.

- An **Educator** can archive an owned course.
- An Educator can restore a course only when that course was archived by the Educator side.
- A course archived by a **System Administrator** cannot be restored by the Educator; it must be restored by a System Administrator.
- A **System Administrator** can archive a course and can restore any archived course.
- Archived courses do not accept new enrollment approvals/requests that require an active course.
- When a course is archived, its related **Class Projects** in AI Workspace are synchronized to an archived/history-only state. Learning history remains readable, while AI chat, quiz/flashcard generation, uploads, deletes, and context-changing operations are disabled for the archived Class Project.
- When the course is restored, the related archived Class Projects are synchronized back to an active state.

## 5.6 Forgot Password

The Login-page **Forgot Password** flow uses a server-generated temporary password rather than a password-reset link.

```text
User enters account email
        ↓
Backend validates the request
        ↓
A new strong temporary password is generated
        ↓
Supabase Auth password is updated
        ↓
Existing AcogniX UserSession records are revoked
        ↓
Temporary password is sent to the registered email
        ↓
User signs in and can change the password from Profile/Settings
```

For an unknown email address, the public response remains generic so the endpoint does not reveal whether an account exists. If the password is changed successfully but email delivery fails, the backend reports an email-delivery failure rather than pretending the reset completed normally.

---

# 6. Prerequisites

Install or prepare the following before running AcogniX:

1. **Node.js 22.12.0 or later and npm**
2. **Python 3.11** and pip.
3. **Git** if cloning from GitHub.
4. A **Supabase account** and permission to create a new Supabase project.
5. A valid **Gemini API key** for AI Tutor, document embeddings, practice quizzes, and flashcards.
6. **Tesseract OCR** with English and Vietnamese language data if scanned-document OCR is required.
7. A Gmail account with a valid **Google App Password** if email-dependent features are required.

The complete local application uses:

```text
React frontend
        ↓
Node.js/Express application
        ↓
Supabase + FastAPI AI Microservice
        ↓
Google Gemini
```

---

# 7. Installation

> **Quick first-time setup:** clone or extract the repository → run `npm install` at the project root → create and activate `ai_service/.venv` → install `ai_service/requirements.txt` → configure both `.env` files → create and initialize the required Supabase project by following Section 9 → start the two terminals described in Section 10.


## 7.1 Clone the repository

```bash
git clone https://github.com/Intarn/AcogniX.git
cd AcogniX
```

If the project is provided as a ZIP file, extract it and open a terminal in the root directory containing:

```text
app.js
package.json
backend/
frontend/
ai_service/
```

## 7.2 Install Node.js dependencies

From the project root:

```bash
npm install
```

The checked-in `package.json` is the source of truth for Node.js dependencies and scripts. Do not install the package names from the root `requirements.txt` with `pip`; that file contains Node/npm package names in the current project snapshot.

`form-data` is declared as a direct dependency because the Node.js backend imports it in the AI-service client. A normal `npm install` installs it automatically; no extra package-install command should be necessary.

## 7.3 Create the AI-service Python virtual environment

Create and activate the virtual environment **inside `ai_service/`**.

### Windows PowerShell

```powershell
cd ai_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### Windows Command Prompt

```cmd
cd ai_service
python -m venv .venv
.venv\Scripts\activate
```

### macOS / Linux

```bash
cd ai_service
python3 -m venv .venv
source .venv/bin/activate
```

Upgrade pip:

```bash
python -m pip install --upgrade pip
```

Install the AI-service dependencies while still inside `ai_service/`:

```bash
pip install -r requirements.txt
```

## 7.4 Install Tesseract OCR

The `pytesseract` package is only a Python wrapper. The Tesseract application itself must also be installed.

The AI service uses:

```text
eng+vie
```

so English and Vietnamese language data should be available.

### Windows

If Tesseract is not in the system `PATH`, configure:

```env
TESSERACT_CMD=C:/Program Files/Tesseract-OCR/tesseract.exe
```

in `ai_service/.env`.

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install tesseract-ocr tesseract-ocr-eng tesseract-ocr-vie
```

### macOS

Install Tesseract using your preferred package manager and make sure the required language data is available.

---

# 8. Environment Variables

The current Vite configuration sets `root: './frontend'` and `envDir: '..'`. Therefore the frontend reads its `VITE_*` variables from the **project-root `.env`**. The normal setup uses:

```text
AcogniX/.env
AcogniX/ai_service/.env
```

Do **not** commit real secrets.

## 8.1 Main Backend `.env`

Create:

```text
AcogniX/.env
```

Example:

```env
# Main server
PORT=5000

# Use development for local setup.
# Set to production only in a deployed production environment.
NODE_ENV=development

# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# Browser-safe Supabase key used by the backend authentication client
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY

# Assessment storage
ASSESSMENT_STORAGE_BUCKET=assessment-files

# Public application URL used in links
CLIENT_URL=http://localhost:5000

# Frontend variables loaded by Vite from this same root .env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLIC_KEY

# Email
EMAIL_USER=YOUR_GMAIL_ADDRESS
EMAIL_APP_PASSWORD=YOUR_GMAIL_APP_PASSWORD

# AI microservice
AI_SERVICE_URL=http://127.0.0.1:8000
AI_SERVICE_INTERNAL_SECRET=CHANGE_THIS_TO_A_SHARED_SECRET

# Gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_1
PA5_BACKUP_GEMINI_API_KEY=YOUR_GEMINI_API_KEY_2

# Playwright automated-test learner account
# Required only when running the current automated_tests suite.
LEARNER_EMAIL=YOUR_TEST_LEARNER_EMAIL
LEARNER_PASSWORD=YOUR_TEST_LEARNER_PASSWORD
```

Important:

- `SUPABASE_SERVICE_ROLE_KEY` is a backend-only secret.
- `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_ANON_KEY` should use the same browser-safe publishable/anon key from the configured Supabase project.
- Never place the service-role key in any `VITE_*` variable.
- `VITE_*` values are embedded into the frontend during `npm run build`.
- Rebuild the frontend after changing a `VITE_*` value.
- `AI_SERVICE_INTERNAL_SECRET` must be identical in the root `.env` and `ai_service/.env`.
- `EMAIL_USER` and `EMAIL_APP_PASSWORD` are required for Forgot Password, account notifications, and administrator deletion verification.
- The Playwright account variables are not required for normal application startup.

## 8.2 AI Microservice `.env`

Create:

```text
AcogniX/ai_service/.env
```

Example:

```env
PORT=8000

# Gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_1
PA5_BACKUP_GEMINI_API_KEY=YOUR_GEMINI_API_KEY_2

# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# Shared secret with Node.js backend
AI_SERVICE_INTERNAL_SECRET=CHANGE_THIS_TO_A_SHARED_SECRET

# Optional Windows OCR path
TESSERACT_CMD=C:/Program Files/Tesseract-OCR/tesseract.exe

VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLIC_KEY
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLIC_KEY
```
The AI service reads these variables during startup. Missing `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or `AI_SERVICE_INTERNAL_SECRET` prevents the AI service from starting.

The Gemini API key must have access to the generation and embedding models used by the current source code.
---

# 9. Supabase Requirements

The project expects an existing Supabase project containing the required database schema, RPC functions, authentication configuration, and storage buckets.

## 9.1 First-time setup for a new Supabase project

The following procedure is required only when the user does not have access to the team's existing Supabase project and needs to create a new project.

> Run this procedure only on a new, empty Supabase project. Some base SQL files contain `DROP TABLE` statements and must not be executed on a populated database.

### Step 1 — Create the project

1. Create a new project from the Supabase Dashboard.
2. Wait until the project becomes available.
3. Open the project's **Connect** dialog or **Settings → API Keys**.
4. Copy the Project URL, browser-safe publishable key, and backend service-role key used by the current project.
5. Add those values to the environment files described in Section 8.

### Step 2 — Enable pgvector

Open the Supabase SQL Editor and run:

```sql
create extension if not exists vector with schema public;
```

The vector extension must be enabled before creating `Document_Chunk` because the application uses `vector(768)` embeddings.

### Step 3 — Create the base schema

Execute the complete contents of these files once in the following order:

1. `db/role.sql`
2. `db/course_f2a.sql`
3. `db/core_tables.sql`
4. `db/support_ticket.sql`
5. `db/add_ai_feature_tables.sql`
6. `db/Add_rag_pgvector.sql`

These six files contain the current base schema required for a new-project setup. After they have been executed successfully, continue with Step 4 before applying the migrations in Step 5.

### Step 4 — Create current compatibility objects

After creating the base schema, run:

```sql
create table if not exists public."System_Settings" (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value text not null,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists public."Study_Session" (
  "sessionId" uuid primary key,
  "learnerId" uuid not null
    references public."User"("userId")
    on delete cascade,
  "courseId" uuid
    references public."Course"("courseId")
    on delete set null,
  "startTime" timestamptz not null,
  "endTime" timestamptz not null,
  "durationMinutes" integer not null default 0
    check ("durationMinutes" >= 0)
);

create index if not exists "Study_Session_learner_time_idx"
  on public."Study_Session" (
    "learnerId",
    "startTime",
    "endTime"
  );

create index if not exists "Study_Session_course_idx"
  on public."Study_Session" ("courseId");

alter table public."CourseMaterial"
  add column if not exists "orderIndex" integer;

alter table public."Conversation"
  add column if not exists "updatedAt"
  timestamptz not null default now();

alter table public."Practice_Quiz"
  add column if not exists "createdAt"
  timestamptz not null default now();

alter table public."Flashcard_Set"
  add column if not exists "createdAt"
  timestamptz not null default now();

alter table public."System_Settings"
  enable row level security;

alter table public."Study_Session"
  enable row level security;

revoke all
  on table public."System_Settings"
  from anon, authenticated;

revoke all
  on table public."Study_Session"
  from anon, authenticated;

grant select, insert, update, delete
  on table public."System_Settings"
  to service_role;

grant select, insert, update, delete
  on table public."Study_Session"
  to service_role;

notify pgrst, 'reload schema';
```

### Step 5 — Apply the migrations

Execute the complete contents of these migration files once in the following order:

1. `backend/migrations/20260831_add_course_archive_metadata.sql`
2. `backend/migrations/20260901_course_material_storage_metadata.sql`
3. `backend/migrations/20260901_create_notification_table.sql`
4. `backend/migrations/20260901_hash_user_session_tokens.sql`
5. `backend/migrations/20260901_set_project_active_context.sql`
6. `backend/migrations/20260901_ai_generation_transactions.sql`
7. `backend/migrations/20260901_match_document_chunks_threshold.sql`
8. `backend/migrations/20260901_submission_uniqueness.sql`
9. `backend/migrations/20260902_submission_answer_uniqueness.sql`
10. `backend/migrations/20260902_two_factor_atomic_consume.sql`

Finally, execute:

```text
db/trigger_indexes.sql
```

Run `db/trigger_indexes.sql` only once on a new project because its trigger statements do not all use `IF NOT EXISTS`.

## 9.2 AI-related database objects

The AI service references tables including:

```text
Learning_Material
Processed_Document
Document_Chunk
Conversation
Chat_Message
Practice_Quiz
Practice_Question
Flashcard_Set
Flashcard
```

It also uses the Supabase RPC function:

```text
match_document_chunks
```

The AI source expects document embeddings compatible with:

```text
768 dimensions
```

## 9.3 Storage buckets

The backend references storage buckets including:

```text
materials
announcements
avatars
assessment-files
```

Create the buckets with the following visibility:

| Bucket | Visibility | Purpose |
|---|---|---|
| `materials` | Public | Course and personal learning materials |
| `announcements` | Public | Announcement attachments |
| `avatars` | Public | User profile images |
| `assessment-files` | Public | Assessment instructions and learner submissions |

The buckets can be created from the Supabase Storage Dashboard or by running:

```sql
insert into storage.buckets
  (id, name, public, file_size_limit)
values
  ('materials', 'materials', true, 52428800),
  ('announcements', 'announcements', true, 52428800),
  ('avatars', 'avatars', true, 5242880),
  ('assessment-files', 'assessment-files', true, 52428800)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;
```

Assessment uploads and application-level access checks are handled by the Node.js backend using the service-role key. The current `assessment-files` bucket is public, so anyone who knows a valid public object URL can access that file directly. The service-role key must never be exposed to the browser.

---

# 10. Run the Application

## 10.1 Before starting

For a **first-time clone**, complete these items before running the servers:

1. Run `npm install` in the project root.
2. Create `ai_service/.venv` and run `pip install -r requirements.txt` inside `ai_service/`.
3. Create the root `.env` and `ai_service/.env` using Section 8.
4. If using a new Supabase project, complete the database and Storage initialization procedure in Section 9. If using the team's existing project, verify that all required objects are already available.
5. Install Tesseract plus `eng` and `vie` language data if OCR features will be used.
6. Confirm the two `AI_SERVICE_INTERNAL_SECRET` values are identical.
7. Run `npm run build` again whenever a `VITE_*` value changes.

> The npm and Python installation commands do not create the Supabase project automatically. A new user must either receive access to the team's configured Supabase project or complete the new-project initialization procedure in Section 9.

## 10.2 Normal startup


The checked-in npm scripts relevant to normal startup are:

```text
npm run build  → vite build
npm start      → node app.js
```

The current project serves the built React frontend through the Node.js application, so the complete system only needs **two terminals**.

### Terminal 1 — AI Microservice

Open a terminal in the project root, enter the AI service folder, activate its Python virtual environment, then start FastAPI.

### Windows PowerShell

```powershell
cd ai_service
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

If the virtual environment was created in another location, activate that environment instead before running `uvicorn`.

AI service:

```text
http://127.0.0.1:8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

Expected healthy response:

```json
{
  "status": "ok"
}
```

Keep this terminal running.

### Terminal 2 — Build Frontend and Start Main Application

Open another terminal in the **project root** and run:

```bash
npm run build
npm start
```

`npm run build` runs Vite using the project-root configuration. Vite uses `frontend/` as its root and writes the production build to `dist/frontend/`. `npm start` runs `node app.js`; Express then serves both the REST API and that built SPA from the same server.

Main application:

```text
http://localhost:5000
```

REST API base URL:

```text
http://localhost:5000/api
```

There is no separate Vite development terminal required for the normal project startup flow. The `npm run dev` script is available only when a separate Vite development server is intentionally needed.

### Recommended startup order

```text
1. Supabase project is available
2. AI Microservice   → http://127.0.0.1:8000
3. npm run build
4. npm start         → http://localhost:5000
```

The Node.js backend communicates with the AI service using:

```text
X-Internal-Secret
```

and the shared `AI_SERVICE_INTERNAL_SECRET`.

## 10.3 Create the first application accounts

Learner and Educator accounts can be created from the public Sign Up page.

System Administrator accounts cannot be created through public registration. To create the first System Administrator:

1. Start the application.
2. Register the intended administrator account as a Learner.
3. Open the Supabase SQL Editor.
4. Replace the example email below with the registered account email and run:

```sql
update public."User"
set
  role = 'SYSTEM_ADMINISTRATOR',
  "updatedAt" = now()
where lower(email) = lower('admin@example.com');
```

5. Confirm that exactly one row was updated.
6. Sign out and sign in again.
7. The account should be redirected to the System Administrator dashboard.

For complete manual verification, create separate accounts for:

- one System Administrator;
- one Educator;
- one Learner.

---

# 11. Main API Groups

`app.js` mounts REST API groups including:

```text
/api/auth
/api/profile
/api/admin
/api/courses
/api/workspace
/api/enrollment
/api/ai
/api/assessments
/api/learning
/api/analytics
/api/admin/infrastructure
/api/support
```

The Python AI service exposes endpoints including:

```text
GET  /health
POST /api/extract
POST /api/chat
POST /api/generate-quiz
POST /api/generate-flashcards
```

The browser should normally call the Node.js backend rather than directly calling the Python AI service.

---

# 12. AI Service Behavior

## 12.1 Supported document extraction

Supported document/image MIME types include:

```text
application/pdf
application/vnd.openxmlformats-officedocument.wordprocessingml.document
image/jpeg
image/png
image/webp
```

PDF processing first attempts to use the embedded text layer. When the document contains little or no usable text, the service can fall back to Tesseract OCR.

## 12.2 Document processing flow

```text
Upload
  ↓
Extract text
  ↓
Clean text
  ↓
Chunk document
  ↓
Generate embeddings
  ↓
Store Document_Chunk records
```

For smaller supported documents, the AI flow can use full extracted context where appropriate instead of requiring chunk retrieval for every request.

## 12.3 AI Tutor

The AI Tutor uses selected learning materials as context and generates grounded answers through Gemini.

The current generation flow:

```text
Primary model:  gemini-3.6-flash
Fallback model: gemini-3.5-flash-lite
Embeddings:     gemini-embedding-001
```

The fallback generation model is used when the primary model is temporarily unavailable under supported provider-error conditions.

## 12.4 AI Tutor timeout requirement

The AI Tutor user-facing request must not wait indefinitely.

If the LLM request cannot complete within the allowed **30-second** window, the application returns:

```text
Connection to AI Tutor interrupted. Please try again.
```

An incomplete assistant message should not be saved as a successful AI response.

---

# 13. Assessment Behavior

AcogniX supports two educator-created assessment types:

```text
QUIZ
ASSIGNMENT
```

## 13.1 Quiz

- Quiz questions are multiple-choice questions.
- A quiz must contain at least one valid question before it can be published.
- Learner quiz answers are submitted through the assessment workflow.

## 13.2 Assignment

- An Assignment must contain at least one valid Essay/open-response question before it can be published.
- An instruction/reference file is optional.
- An instruction file does not replace the required Essay question.
- Learners may enter text responses and upload supporting files where supported.
- An Assignment without a valid Essay question must remain a Draft and must not be published.

## 13.3 Allow Late Submission

When **Allow Late Submission = OFF**:

- Publishing a Quiz or Assignment shows a confirmation warning that learners cannot submit after the deadline.
- Saving as Draft does not require this publish warning.
- If the deadline passes before the learner successfully submits, the unfinished attempt is discarded.
- An expired unfinished attempt is not retained for educator grading.
- The learner cannot review an expired unfinished attempt as if it were a valid submission.
- If a learner attempts to submit after the deadline, the backend rejects the submission rather than relying only on frontend validation.
- A submission successfully finalized before the deadline remains available.

When **Allow Late Submission = ON**, late-submission behavior follows the configured assessment rules.

## 13.4 Submission Review & Grading

Educators can:

- Open submitted learner files using the **Open** action.
- Review learner answers.
- Enter a score within the assessment point limit.
- Provide written feedback.
- Save grading results.
- Update a previously saved score and feedback.

---

# 14. Analytics and Notifications

## 14.1 Learner progress

The learner progress area can include metrics such as:

- Active Study Time
- Materials Studied
- Quiz Results
- Overall Performance
- Quizzes Passed
- Flashcards Reviewed

`Flashcards Reviewed` is set-based/deck-based rather than individual-card-based.

## 14.2 Educator class analytics

Educators can view class-performance statistics generated from course learning and assessment data available to the analytics service.

## 14.3 Weekly class-performance notifications

Weekly class-performance reports use backend analytics and persisted notification data rather than static/fake frontend entries.

Relevant routes include:

```text
POST  /api/analytics/courses/:courseId/weekly-report/generate
GET   /api/analytics/notifications
PATCH /api/analytics/notifications/:notificationId/read
GET   /api/analytics/courses/:courseId/weekly-report
```

The scheduled weekly-report process is implemented in the backend cron/reporting flow. The automatic weekly class-performance report scheduler runs only when `NODE_ENV=production`.

When running locally, `NODE_ENV` may be unset or set to `development`. In this case, the automatic scheduler is disabled, but educators can still use the authorized generate endpoint to verify the reporting flow manually. Production mode also disables development/test-only failure-simulation endpoints.

When a weekly report notification is available:

- it appears in the Educator notification bell;
- it is associated with the relevant course;
- opening it can navigate to the related analytics view;
- its read state is persisted.

---

# 15. Build for Production

`app.js` serves the production frontend from:

```text
dist/frontend
```

Build from the project root using the configured project script:

```bash
npm run build
```

Expected output:

```text
dist/
└── frontend/
    ├── index.html
    └── assets/
```

Then start the production Node.js application:

```bash
npm start
```

The Express server can then serve both the REST API and built SPA from:

```text
http://localhost:5000
```

---

# 16. Testing

AcogniX currently uses a separate **Playwright** project in `automated_tests/` for the checked-in PA5 browser tests. These tests are separate from the commands required to start the application.

## 16.1 First-time automated-test setup

The current automated tests require a valid Learner account. Add the following values to the **project-root `.env`**:

```env
LEARNER_EMAIL=your_learner_email
LEARNER_PASSWORD=your_learner_password
```

From the AcogniX root directory, install the normal application dependencies:

```bash
npm install
```

Then install the test-project dependencies and Chromium:

```bash
cd automated_tests
npm install
npx playwright install chromium
cd ..
```

## 16.2 Start AcogniX for the current automated tests

For the currently documented UC01 and UC04 Playwright tests, the AI microservice is **not required**.

Open **Terminal 1** in the AcogniX root directory:

```bash
npm run build
npm start
```

Keep that terminal running. The application should be available at:

```text
http://localhost:5000
```

## 16.3 Run all Playwright tests

Open **Terminal 2** in the AcogniX root directory:

```bash
cd automated_tests
npx playwright test --headed
```

## 16.4 Run a single use case

UC01:

```bash
npx playwright test tests/uc01.spec.js --headed
```

UC04:

```bash
npx playwright test tests/uc04.spec.js --headed
```

## 16.5 Run a specific scenario

Examples:

```bash
npx playwright test tests/uc01.spec.js -g "UC01-UI02" --headed
npx playwright test tests/uc01.spec.js -g "UC01-UI03" --headed
npx playwright test tests/uc01.spec.js -g "UC01-UI12" --headed
npx playwright test tests/uc04.spec.js -g "UC04-UI01" --headed
npx playwright test tests/uc04.spec.js -g "UC04-UI02" --headed
npx playwright test tests/uc04.spec.js -g "UC04-UI04" --headed
```

## 16.6 Open the Playwright report

After a test run:

```bash
npx playwright show-report
```

## 16.7 Manual system verification

Before a final release, verify at minimum:

- Authentication, Forgot Password, session behavior, and role access.
- Course creation, enrollment, members, archive, and restore synchronization.
- Course materials and announcements.
- Assessment Draft/Publish behavior, Quiz/Assignment rules, scheduling, and deadline boundaries.
- Quiz submission and assignment-file submission.
- Educator submission review, grading, score changes, and feedback updates.
- AI Workspace upload, extraction, project context, AI Tutor, practice quizzes, and flashcards.
- AI Tutor timeout/fallback behavior under provider failure.
- Learner progress metrics, including deck-based Flashcards Reviewed.
- Educator class analytics and persisted weekly-report notifications.
- System Administrator account-protection rules.
- Email-dependent flows using valid Gmail/Nodemailer credentials.

---

# 17. Troubleshooting

## `npm install` fails or dependencies are inconsistent

Use the checked-in `package.json` and `package-lock.json` from the same commit. From the project root:

```bash
npm install
```

If the local installation is corrupted, remove `node_modules` and install again. Do not use the root `requirements.txt` with `pip`; Python dependencies belong to `ai_service/requirements.txt`.


## `Cannot find module 'form-data'`

The current `package.json` declares `form-data` directly. Run:

```bash
npm install
```

If the error remains, make sure `package.json` and `package-lock.json` are from the same commit and reinstall `node_modules`.

## Missing Supabase backend credentials

Check the root `.env`:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_PUBLISHABLE_KEY=...
```

## Frontend cannot reach the backend

Check:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

and confirm the backend is running.

## Frontend reports missing Supabase variables

Check the **project-root `.env`** because `vite.config.mjs` uses `envDir: '..'`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Then rebuild and restart:

```bash
npm run build
npm start
```

## `AI_SERVICE_UNAVAILABLE`

Check:

```text
http://127.0.0.1:8000/health
```

and:

```env
AI_SERVICE_URL=http://127.0.0.1:8000
```

## AI service returns unauthorized / invalid internal secret

The following values must match exactly.

Backend `.env`:

```env
AI_SERVICE_INTERNAL_SECRET=your-secret
```

AI-service `.env`:

```env
AI_SERVICE_INTERNAL_SECRET=your-secret
```

## AI request returns provider quota/high-demand errors

Gemini is an external provider. AI features may temporarily fail because of:

- API quota exhaustion;
- per-project model quota limits;
- temporary provider `503 UNAVAILABLE` responses;
- invalid/expired API credentials;
- model availability differences.

The application includes fallback/error handling for supported cases, but it cannot guarantee provider availability.

## Tesseract not found

Install Tesseract OCR and optionally configure:

```env
TESSERACT_CMD=C:/Program Files/Tesseract-OCR/tesseract.exe
```

## OCR cannot load Vietnamese

Ensure both language packs are installed:

```text
eng
vie
```

## `Bucket not found`

Verify that the expected bucket exists in the same Supabase project referenced by `SUPABASE_URL`.

Expected bucket names include:

```text
materials
announcements
avatars
assessment-files
```

## `Object not found`

The bucket may exist while the referenced object path does not. Compare the stored path with the actual Supabase Storage object path.

## Weekly report generation returns a database error

Verify that:

- the request contains a real course UUID, not a course code or placeholder;
- the authenticated educator owns or is authorized for the course;
- the required analytics tables/data exist;
- Supabase credentials are valid.

## AI functions fail while the main website works

Check:

```text
GEMINI_API_KEY
AI_SERVICE_URL
AI_SERVICE_INTERNAL_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Also verify the required AI tables and:

```text
match_document_chunks
```

RPC function.

---

# 18. Security Notes

Never commit these secrets:

```text
SUPABASE_SERVICE_ROLE_KEY
EMAIL_APP_PASSWORD
GEMINI_API_KEY
AI_SERVICE_INTERNAL_SECRET
```

Only browser-safe credentials should be exposed through `VITE_*` frontend variables.

Recommended `.gitignore` entries:

```gitignore
.env
ai_service/.env
.venv/
node_modules/
dist/
__pycache__/
*.pyc
```

Additional recommendations:

- Keep authorization checks in the backend even when the frontend hides or disables an action.
- Validate assessment deadlines and submission eligibility on the server.
- Do not expose service-role credentials to the browser.
- Use a private bucket together with signed URLs when protected file access is required.
- Validate uploaded file type and size before processing.
- Revoke or rotate credentials immediately if they are accidentally committed.
- The current `assessment-files` bucket is public. Assessment instructions and learner submission files stored in this bucket must not be considered private or access-controlled by Storage RLS when downloaded through a public object URL.

---

# 19. Known External Dependencies and Limitations

AcogniX depends on several external services. A correctly running local application can still experience feature degradation when an external provider is unavailable.

## Supabase

Authentication, database operations, RPC calls, and file storage require the configured Supabase project to be available and correctly initialized.

## Gemini

AI Tutor, AI-generated quizzes, flashcards, and embeddings depend on Gemini availability and API quota. Provider quota is external to AcogniX.

## Email

Forgot-password and other email-dependent features require valid Gmail/Nodemailer credentials. If email configuration is missing, email delivery cannot complete successfully.

## OCR

Scanned-document OCR depends on the local Tesseract installation and required language data.

---

# 20. Repository

```text
https://github.com/Intarn/AcogniX.git
```

---

## Project Summary

AcogniX is intended to keep **classroom learning, educator-created assessment, AI-assisted self-study, learner progress, and administration connected in one platform**. Educator grading data remains separate from AI practice activities, while AI Workspace tools provide learners with additional self-study support using selected learning materials as context.

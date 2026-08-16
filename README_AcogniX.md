# AcogniX

AcogniX is a web-based learning platform that combines classroom management, AI-assisted self-study, assessment management, learning analytics, personal notes, and role-based administration.

The current system contains three main application parts:

- **Frontend**: React + Vite web application.
- **Main Backend**: Node.js + Express REST API connected to Supabase.
- **AI Microservice**: FastAPI service for document extraction/OCR, embeddings, AI Tutor, practice quiz generation, and flashcard generation using Gemini.

The main user roles are:

- **Learner** — enrolls in courses, views course content, works on assessments, uses AI Workspace features, and views personal learning progress.
- **Educator** — manages courses, class members, course materials, announcements, assessments, submissions, gradebook information, and class analytics.
- **System Administrator** — manages users/courses, support tickets, and system/infrastructure information.

---

## 1. Technology Stack

### Frontend

- React
- React DOM
- React Router / React Router DOM
- Vite
- Tailwind CSS
- Chart.js
- react-chartjs-2
- react-markdown
- Supabase JavaScript client

### Main Backend

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
- Jest

### AI Microservice

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

### External Services

- **Supabase** — authentication, PostgreSQL database, RPC functions, and file storage.
- **Google Gemini** — text generation and embeddings for the AI features.
- **Tesseract OCR** — OCR fallback for scanned PDFs and image files.
- **Gmail/Nodemailer** — email notifications when Gmail credentials are configured.

---

## 2. Project Structure

```text
AcogniX/
├── app.js
├── package.json
├── requirements.txt
├── .env
│
├── backend/
│   ├── config/
│   │   ├── emailClient.js
│   │   ├── supabaseAuthClient.js
│   │   └── supabaseClient.js
│   │
│   ├── controllers/
│   │   ├── AILearningController.js
│   │   ├── AnalyticsController.js
│   │   ├── AssessmentController.js
│   │   ├── AuthController.js
│   │   ├── CourseContentController.js
│   │   ├── CourseController.js
│   │   ├── EnrollmentController.js
│   │   ├── InfrastructureController.js
│   │   ├── NoteController.js
│   │   ├── ProfileController.js
│   │   ├── SupportTicketController.js
│   │   ├── UserManagementController.js
│   │   ├── WorkspaceController.js
│   │   └── aiController.js
│   │
│   ├── cron/
│   │   └── weeklyReport.js
│   │
│   ├── entities/
│   ├── enums/
│   ├── error/
│   ├── middleware/
│   ├── routes/
│   ├── service/
│   └── tests/
│       └── unit/
│
├── frontend/
│   ├── index.html
│   ├── .env
│   └── src/
│       ├── components/
│       │   ├── branding/
│       │   ├── common/
│       │   └── layout/
│       ├── contexts/
│       ├── features/
│       │   ├── admin/
│       │   ├── analytics/
│       │   ├── assessment/
│       │   ├── auth/
│       │   ├── classroom/
│       │   ├── community/
│       │   ├── notes/
│       │   └── workspace/
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
│   ├── .env
│   ├── main.py
│   ├── config.py
│   ├── db.py
│   ├── requirements.txt
│   ├── api/
│   │   ├── chat_router.py
│   │   ├── extraction_router.py
│   │   ├── flashcard_router.py
│   │   └── quiz_router.py
│   ├── llm_client/
│   ├── middleware/
│   ├── schemas/
│   ├── services/
│   └── tests/
│
└── dist/
    └── frontend/
```

`dist/frontend/` is generated when the frontend is built for production and is served by `app.js`.

---

## 3. Prerequisites

Install the following before running the project:

1. **Node.js and npm**
2. **Python 3 and pip**
3. **Git** if the project is cloned from GitHub
4. **Tesseract OCR** if scanned PDF/image extraction is required
5. Access to the configured **Supabase project**
6. A valid **Gemini API key**

A Supabase Dashboard invitation is not required just to run the application locally. However, the correct environment variables and project credentials must be available. Keep the Supabase service-role key private and never expose it in frontend code or a public Git repository.

---

## 4. Clone the Repository

```bash
git clone https://github.com/Intarn/AcogniX.git
cd AcogniX
```

If the project was provided as a ZIP file, extract it and open a terminal in the root folder containing:

```text
app.js
package.json
backend/
frontend/
ai_service/
```

---

# 5. Install Node.js Dependencies

From the project root:

```bash
npm install
```

The current backend imports `form-data` in:

```text
backend/service/AIServiceClient.js
```

but the provided `package.json` does not currently list `form-data`.

Install it once:

```bash
npm install form-data
```

After that, npm will add it to `package.json`/`package-lock.json`.

### Full manual Node.js installation command

Normally `npm install` is enough because the dependencies are already declared in `package.json`.

If the package file must be reconstructed manually, the current source uses:

```bash
npm install @supabase/supabase-js @tailwindcss/vite axios chart.js cors dotenv express form-data multer node-cron nodemailer react react-chartjs-2 react-dom react-markdown react-router react-router-dom socket.io tailwindcss
```

Development dependencies:

```bash
npm install --save-dev @vitejs/plugin-react jest vite
```

---

# 6. Install Python Dependencies

The Python dependencies are used by the `ai_service` FastAPI application.

## 6.1 Create a virtual environment

From the project root:

### Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### Windows Command Prompt

```cmd
python -m venv .venv
.venv\Scripts\activate
```

### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
```

## 6.2 Upgrade pip

```bash
python -m pip install --upgrade pip
```

## 6.3 Install all AI-service Python libraries

Using the root `requirements.txt`:

```bash
pip install -r requirements.txt
```

If `requirements.txt` is kept inside `ai_service/`, use:

```bash
pip install -r ai_service/requirements.txt
```

The complete required Python packages are:

```text
fastapi
uvicorn[standard]
python-dotenv
google-genai
supabase
pymupdf
python-docx
pytesseract
Pillow
pydantic
httpx
python-multipart
pytest
```

---

# 7. Install Tesseract OCR

The Python package `pytesseract` is only a Python wrapper. The **Tesseract OCR application itself must also be installed on the operating system**.

The AI service uses:

```text
eng+vie
```

for OCR, so both English and Vietnamese language data should be available.

## Windows

Install Tesseract OCR and make sure the executable is available.

If Tesseract is not added to `PATH`, configure the executable location in `ai_service/.env`, for example:

```env
TESSERACT_CMD=C:/Program Files/Tesseract-OCR/tesseract.exe
```

Also make sure the Tesseract installation contains English and Vietnamese trained language data.

## Ubuntu / Debian

A typical installation is:

```bash
sudo apt update
sudo apt install tesseract-ocr tesseract-ocr-eng tesseract-ocr-vie
```

## macOS

Install Tesseract using your package manager and ensure Vietnamese language data is also installed.

`TESSERACT_CMD` is optional when the `tesseract` executable is already available through the system `PATH`.

---

# 8. Supabase Requirements

The current application expects an existing Supabase project containing the database objects used by the backend and AI microservice.

The AI microservice directly references tables such as:

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

It also calls the Supabase RPC function:

```text
match_document_chunks
```

The `Document_Chunk.embedding` data used by the AI source is expected to be compatible with a **768-dimensional embedding**, because `ai_service/config.py` sets:

```text
EMBEDDING_DIMENSIONS = 768
```

The database schema/RPC definitions are not part of the three uploaded source folders, so the project must point to the team's existing Supabase database or be initialized separately with the correct schema.

## Required Storage Buckets

The current backend references these Supabase Storage buckets:

```text
materials
announcements
avatars
assessment-files
```

The current source uses `getPublicUrl()` for browser-accessible files in these features. Configure Storage access consistently with this implementation.

---

# 9. Environment Variables

The project uses three environment configurations:

```text
AcogniX/.env
AcogniX/frontend/.env
AcogniX/ai_service/.env
```

Do **not** commit real secrets to GitHub.

---

## 9.1 Main Backend `.env`

Create:

```text
AcogniX/.env
```

Example:

```env
# Main server
PORT=5000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY

# Supabase Storage
ASSESSMENT_STORAGE_BUCKET=assessment-files

# Frontend URL used by email/notification links
CLIENT_URL=http://localhost:5173

# Email notifications
EMAIL_USER=YOUR_GMAIL_ADDRESS
EMAIL_APP_PASSWORD=YOUR_GMAIL_APP_PASSWORD

# Python AI microservice
AI_SERVICE_URL=http://127.0.0.1:8000
AI_SERVICE_INTERNAL_SECRET=CHANGE_THIS_TO_A_SHARED_SECRET

# Workspace integration
ENABLE_WORKSPACE_INTEGRATION=true
```

Important:

- `SUPABASE_SERVICE_ROLE_KEY` is a backend secret.
- Never put `SUPABASE_SERVICE_ROLE_KEY` in `frontend/.env`.
- `AI_SERVICE_INTERNAL_SECRET` must match the value used by the Python AI microservice.

---

## 9.2 Frontend `.env`

Create:

```text
AcogniX/frontend/.env
```

Example:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLIC_KEY
```

After changing a Vite environment variable, restart the frontend development server.

---

## 9.3 AI Microservice `.env`

Create:

```text
AcogniX/ai_service/.env
```

Example:

```env
# Gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY

# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# Must be exactly the same as the Node.js backend value
AI_SERVICE_INTERNAL_SECRET=CHANGE_THIS_TO_A_SHARED_SECRET

# Optional on Windows if Tesseract is not in PATH
TESSERACT_CMD=C:/Program Files/Tesseract-OCR/tesseract.exe
```

The current AI source uses:

```text
gemini-3.6-flash
gemini-embedding-001
```

as the generation and embedding model identifiers configured in `ai_service/config.py`.

---

# 10. Run the Application in Development

For the complete application, run **three terminals**.

---

## Terminal 1 — AI Microservice

Activate the Python virtual environment first.

Then:

```bash
cd ai_service
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The AI service will run at:

```text
http://127.0.0.1:8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

A successful health response is:

```json
{
  "status": "ok"
}
```

Keep this terminal running.

---

## Terminal 2 — Main Backend

Open another terminal in the project root:

```bash
node app.js
```

or:

```bash
npm run dev:backend
```

Default backend address:

```text
http://localhost:5000
```

Default REST API base URL:

```text
http://localhost:5000/api
```

Keep this terminal running.

---

## Terminal 3 — Frontend

The current source stores `index.html` inside the `frontend/` directory.

From the project root, run:

```bash
npx vite frontend
```

Vite normally prints the local development URL in the terminal.

The frontend environment currently assumes:

```text
http://localhost:5173
```

for local development links.

### Alternative

You can also enter the frontend folder and launch Vite while npm packages remain installed in the project structure:

```bash
cd frontend
npx vite
```

---

# 11. Recommended Start Order

Start the services in this order:

```text
1. Supabase project is available
2. AI Microservice        → http://127.0.0.1:8000
3. Node.js Backend        → http://localhost:5000
4. React/Vite Frontend    → Vite local URL
```

The Node.js backend calls the Python service through:

```env
AI_SERVICE_URL=http://127.0.0.1:8000
```

and sends:

```text
X-Internal-Secret
```

using the shared `AI_SERVICE_INTERNAL_SECRET`.

---

# 12. Main API Groups

`app.js` currently mounts these REST API groups:

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

The Python AI microservice exposes:

```text
GET  /health
POST /api/extract
POST /api/chat
POST /api/generate-quiz
POST /api/generate-flashcards
```

The browser should normally call the **Node.js backend** rather than calling the Python AI microservice directly.

---

# 13. AI Microservice Capabilities

The current Python source supports:

### Document extraction

Accepted MIME types:

```text
application/pdf
application/vnd.openxmlformats-officedocument.wordprocessingml.document
image/jpeg
image/png
image/webp
```

PDF processing first attempts to read the embedded text layer. If little or no usable text is found, it falls back to Tesseract OCR.

### Document indexing

Extracted documents are:

```text
extract
→ clean text
→ split into chunks
→ generate embeddings
→ save Document_Chunk rows
```

### AI Tutor

The service retrieves relevant chunks from selected learning materials and generates a grounded answer using Gemini.

### Practice quizzes

The service generates quiz questions from selected material context.

### Flashcards

The service generates flashcards from selected learning material context.

---

# 14. Build Frontend for Production

`app.js` serves the production frontend from:

```text
dist/frontend
```

With the current folder structure, build the frontend from the project root using:

```bash
npx vite build frontend --outDir ../dist/frontend
```

After a successful build, the expected structure is:

```text
dist/
└── frontend/
    ├── index.html
    └── assets/
```

Then run:

```bash
npm start
```

The Express server will serve both the API and built SPA from:

```text
http://localhost:5000
```

---

# 15. Run Tests

## Node.js backend tests

From the project root:

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

Coverage:

```bash
npm run test:coverage
```

The uploaded backend contains Jest unit tests for areas including authentication, course management, enrollment, assessments, analytics, personal notes, workspace logic, infrastructure, and scheduled reporting.

## Python AI-service tests

Activate the Python virtual environment and run:

```bash
cd ai_service
pytest
```

or:

```bash
pytest -q
```

---

# 16. Quick Setup for a New Team Member

After cloning the repository:

```bash
npm install
npm install form-data
```

Create the Python environment:

```bash
python -m venv .venv
```

Activate it, then:

```bash
pip install -r requirements.txt
```

Create:

```text
.env
frontend/.env
ai_service/.env
```

with the correct project credentials.

Then start:

```text
Terminal 1: AI service
Terminal 2: Node backend
Terminal 3: React frontend
```

---

# 17. Common Errors

## `Cannot find module 'form-data'`

Run:

```bash
npm install form-data
```

---

## `Lack SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in file .env`

The Node backend cannot find the required Supabase backend credentials.

Check:

```text
AcogniX/.env
```

and verify:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## `Lack SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in .env`

Add the backend authentication-client key:

```env
SUPABASE_PUBLISHABLE_KEY=...
```

to the root `.env`.

---

## Frontend reports missing Supabase variables

Check:

```text
frontend/.env
```

for:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Restart Vite afterward.

---

## Frontend cannot reach backend

Check:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

and make sure the Node backend is running.

---

## `AI_SERVICE_UNAVAILABLE`

Check that the Python service is running:

```text
http://127.0.0.1:8000/health
```

and verify the backend `.env`:

```env
AI_SERVICE_URL=http://127.0.0.1:8000
```

---

## AI service returns Unauthorized / invalid internal secret

The following values must match exactly:

Backend `.env`:

```env
AI_SERVICE_INTERNAL_SECRET=your-secret
```

AI service `.env`:

```env
AI_SERVICE_INTERNAL_SECRET=your-secret
```

---

## Tesseract is not found

Install the Tesseract OCR application.

On Windows, set:

```env
TESSERACT_CMD=C:/Program Files/Tesseract-OCR/tesseract.exe
```

in `ai_service/.env`.

---

## OCR cannot load Vietnamese

The source calls Tesseract with:

```text
eng+vie
```

so install both English and Vietnamese trained data.

---

## `Bucket not found`

Check that the Storage bucket exists in the same Supabase project referenced by `SUPABASE_URL`.

Expected bucket names include:

```text
materials
announcements
avatars
assessment-files
```

---

## `Object not found`

The bucket exists, but the URL/path references an object that is not present at that exact Storage path.

Check the object path in Supabase Storage and compare it with the value stored by the application.

---

## AI functions fail although backend works

Check all of the following:

```text
GEMINI_API_KEY
AI_SERVICE_URL
AI_SERVICE_INTERNAL_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Also verify that the Supabase RPC:

```text
match_document_chunks
```

and required AI tables exist.

---

# 18. Security Notes

Do not commit these secrets:

```text
SUPABASE_SERVICE_ROLE_KEY
EMAIL_APP_PASSWORD
GEMINI_API_KEY
AI_SERVICE_INTERNAL_SECRET
```

Only public/browser-safe Supabase credentials should be exposed through `VITE_*` frontend variables.

Recommended `.gitignore` entries include:

```gitignore
.env
frontend/.env
ai_service/.env
.venv/
node_modules/
dist/
__pycache__/
*.pyc
```

---

# 19. Repository

```text
https://github.com/Intarn/AcogniX.git
```

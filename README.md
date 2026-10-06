# LogicLens

LogicLens is an AI-assisted code review workspace for DSA and competitive programming practice. It combines a FastAPI backend, a React/Vite frontend, structured LLM feedback, auth, saved history, progressive hints, complexity analysis, fix-code output with diff view, and an optional retrieval-augmented knowledge base.

## What It Does

- Reviews code for bugs, edge cases, and implementation risks
- Generates progressive DSA hints instead of dumping full solutions
- Explains time/space complexity and optimization opportunities
- Produces corrected code when `Fix Code` is used
- Saves review history per user
- Supports login, register, profile update, and password change
- Streams AI responses from the backend
- Uses cached reads for faster session and history loading
- Persists the current editor draft across refresh
- Supports optional PDF, Markdown, and TXT knowledge-base ingestion
- Chunks documents, generates embeddings, stores them in PostgreSQL with pgvector, retrieves relevant chunks with cosine similarity, and grounds LLM reviews with retrieved context
- Shows retrieved source documents in review results

## Tech Stack

### Frontend
- React 19
- Vite
- Tailwind CSS
- Monaco Editor
- Axios
- Lucide icons
- React Markdown

### Backend
- FastAPI
- SQLAlchemy
- PostgreSQL via `psycopg2-binary`
- pgvector for semantic retrieval
- JWT auth with `python-jose`
- Password hashing with `passlib` + `bcrypt`
- Groq SDK for LLM responses
- OpenAI embeddings API for retrieval vectors
- PyPDF for PDF text extraction
- Redis-backed rate limiting with in-memory fallback

## Project Structure

```text
LogicLens/
+- backend/
¦  +- app/
¦  ¦  +- api/
¦  ¦  +- core/
¦  ¦  +- models/
¦  ¦  +- services/
¦  ¦  +- db.py
¦  ¦  +- main.py
¦  +- requirements.txt
¦  +- .env
+- frontend/
¦  +- public/
¦  +- src/
¦  ¦  +- components/
¦  ¦  +- features/
¦  ¦  +- pages/
¦  ¦  +- api.js
¦  ¦  +- main.jsx
¦  +- package.json
¦  +- vite.config.js
+- README.md
```

## Core Features

### Auth
- Register with name, email, password, confirm password
- Server-side password validation
- Case-insensitive email login
- Inline auth errors in UI
- Simple human-verification math challenge

### Review Actions
- `Review`: structured bug/improvement analysis
- `Hint`: step-by-step DSA guidance
- `Complexity`: runtime and optimization analysis
- `Fix Code`: corrected code + diff view

### RAG Knowledge Base

RAG is disabled by default so existing deployments continue working without pgvector or embedding credentials.

When enabled:

1. Upload a PDF, Markdown, or TXT document from the workspace.
2. The backend extracts text and splits it into overlapping chunks.
3. Chunks are embedded with the configured OpenAI embedding model.
4. PostgreSQL + pgvector stores the vectors and performs cosine-similarity retrieval.
5. The most relevant chunks are injected into the review prompt as reference context.
6. Retrieved documents/chunks are shown in the UI so the user can see what grounded the review.

Set `RAG_ENABLED=true`, provide `OPENAI_API_KEY`, and enable `VITE_RAG_ENABLED=true` on the frontend.

The PostgreSQL instance must have the pgvector extension available. LogicLens creates the extension automatically when RAG is enabled.

## Environment Variables

Create `backend/.env` with values like these:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
SECRET_KEY=replace-with-a-long-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
GROQ_TIMEOUT_SECONDS=60
REVIEW_RATE_LIMIT_PER_MINUTE=5
MAX_CONCURRENT_AI_REVIEWS=16
REDIS_URL=redis://localhost:6379/0

RAG_ENABLED=true
OPENAI_API_KEY=your_openai_api_key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
RAG_TOP_K=5
RAG_CHUNK_SIZE=900
RAG_CHUNK_OVERLAP=120
RAG_MAX_QUERY_CHARS=4000
RAG_MAX_DOCUMENT_BYTES=5000000

FRONTEND_ORIGINS=http://localhost:5173,https://your-frontend-domain.vercel.app
```

Create `frontend/.env` if needed:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_RAG_ENABLED=true
```

## How To Run Locally

### 1. Start the backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend will run at:
- `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`

### 2. Start the frontend

Open another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend will run at:
- `http://localhost:5173`

## How To Use Swagger Auth

Swagger uses OAuth2 password flow UI.

For `Authorize`:
- `username` = your email
- `password` = your password
- leave `client_id` empty
- leave `client_secret` empty

If needed, you can also test login manually through `POST /auth/login` using JSON:

```json
{
  "email": "user@example.com",
  "password": "YourPassword123!"
}
```

## API Summary

### Public
- `POST /auth/register`
- `POST /auth/login`
- `GET /`

### Authenticated
- `GET /me`
- `POST /auth/change-password`
- `PUT /auth/profile`
- `GET /history/`
- `DELETE /history/`
- `DELETE /history/{session_id}`
- `POST /review/`
- `POST /review/stream`
- `GET /analytics/`
- `GET /knowledge/` (when RAG is enabled)
- `POST /knowledge/upload` (when RAG is enabled)
- `DELETE /knowledge/{document_id}` (when RAG is enabled)

## Running In Production

### Backend
Recommended start command:

```bash
gunicorn app.main:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
```

Notes:
- Do not hardcode ports like `7889`
- Railway/hosting platforms should provide `PORT`
- Make sure backend env vars are present
- Make sure dependencies from `backend/requirements.txt` are fully installed
- When RAG is enabled, use a PostgreSQL deployment with the pgvector extension

### Frontend
Set:

```env
VITE_API_BASE_URL=https://your-backend-domain
VITE_RAG_ENABLED=true
```

Then build/deploy normally with Vite.

## Deployment Notes

These issues were already accounted for in the codebase:
- CORS uses `FRONTEND_ORIGINS` as a comma-separated list
- backend config supports both `pydantic-settings` and `pydantic.v1` fallback
- auth login supports both frontend JSON login and Swagger form login
- `httpx` is pinned to a Groq-compatible version
- `bcrypt` is pinned to a passlib-compatible version
- `python-multipart` is included for Swagger/OAuth form parsing
- RAG remains additive and is disabled unless explicitly enabled

## Performance Notes

Fast APIs in this project:
- session lookup (`/me`)
- history loading (`/history/`)
- cached frontend reads

LLM-backed APIs are not millisecond operations:
- `Review`
- `Hint`
- `Complexity`
- `Fix Code`

When RAG is enabled, retrieval adds embedding generation and vector-search latency before the LLM call.

## Current UX Notes

- Desktop uses Monaco and resizable panes
- Mobile falls back to a simpler editor input for reliability
- History opens as a left drawer
- Auth is modal-based
- Optional Knowledge Base panel supports PDF/Markdown/TXT uploads

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).

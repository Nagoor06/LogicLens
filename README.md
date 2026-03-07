# LogicLens

LogicLens is an AI-assisted code review workspace for DSA and competitive programming practice. It combines a FastAPI backend, a React/Vite frontend, structured LLM feedback, auth, saved history, progressive hints, complexity analysis, and fix-code output with diff view.

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
- JWT auth with `python-jose`
- Password hashing with `passlib` + `bcrypt`
- Groq SDK for LLM responses
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

### Workspace
- Draft autosave across refresh
- History drawer with favorites and delete/clear actions
- Dark/light theme
- Mobile-aware editor fallback
- Resizable desktop panels

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
FRONTEND_ORIGINS=http://localhost:5173,https://your-frontend-domain.vercel.app
```

Create `frontend/.env` if needed:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
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

### Frontend
Set:

```env
VITE_API_BASE_URL=https://your-backend-domain
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

Those depend on model latency and network latency.

## Current UX Notes

- Desktop uses Monaco and resizable panes
- Mobile falls back to a simpler editor input for reliability
- History opens as a left drawer
- Auth is modal-based

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).

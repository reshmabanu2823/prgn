<div align="center">

<img src="https://img.shields.io/badge/Pragna--1%20A-AI%20Chat%20Assistant-gold?style=for-the-badge&logo=openai&logoColor=white" alt="Pragna-1 A" />

# 🤖 Pragna-1 A · Chat_Assistant_EtherX

**A multilingual, agentic AI assistant with RAG, voice, image generation, and a full-featured React UI — built for humans.**

[![Flask](https://img.shields.io/badge/Flask-Backend-000?style=flat-square&logo=flask)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?style=flat-square&logo=vite)](https://vite.dev/)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-white?style=flat-square)](https://ollama.com/)
[![Groq](https://img.shields.io/badge/Groq-Cloud%20LLM-FF6B35?style=flat-square)](https://groq.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat-square&logo=openai)](https://openai.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](backend/LICENSE)

---

</div>

## ✨ What Is Pragna?

**Pragna** (Sanskrit: *प्रज्ञा* — wisdom, intelligence) is a production-grade AI chat assistant with a clean, glassmorphism-styled React UI and a powerful Flask backend.
It is designed to be **provider-agnostic**, **privacy-friendly** (local Ollama models supported), and **deeply extensible** — from RAG-powered document Q&A to a sandboxed terminal coding agent.

---

## 🌟 Feature Highlights

### 🧠 Multi-Provider LLM Support

| Provider | Models | Notes |
|---|---|---|
| **Ollama (Cloud)** | `nemotron-3-super:cloud`, `gemma4:31b-cloud`, and more | Primary; free tier available |
| **Ollama (Local)** | Any model you've `ollama pull`-ed | 100% private, offline capable |
| **Groq** | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, etc. | Cloud fallback, ultra-fast |
| **OpenAI** | `gpt-4o`, `gpt-4o-mini` | Last-resort cloud fallback |

Intelligent **light/heavy model profiles** automatically route simple and complex tasks to the best model.
Cascading fallbacks ensure **zero downtime** even if a provider hits quota limits.

---

### 🌐 Multilingual Intelligence

Pragna speaks **5 Indian languages natively**:

| 🇬🇧 English | 🇮🇳 Hindi | 🇮🇳 Tamil | 🇮🇳 Telugu | 🇮🇳 Kannada |
|---|---|---|---|---|
| `en` | `hi` | `ta` | `te` | `kn` |

Auto-detection and response in the user's language with no extra configuration.

---

### 🔍 RAG — Retrieval-Augmented Generation

- **FAISS vector store** with `sentence-transformers/all-mpnet-base-v2` embeddings
- Ingests **web content, PDFs, and documents** into a local knowledge base
- Scheduled **background web-scraper** (`rag_scheduler.py`) refreshes topics hourly
- India current-affairs–biased scraping for topical awareness
- Transparent citations in responses

---

### 🌍 Real-Time Web Search

- **Serper API** integration for live Google Search during chat
- **NewsAPI** integration for breaking news queries
- Automatically activated by the **query classifier** when the user needs fresh data
- Summarised and cited inline in the AI's response

---

### 🎙️ Voice Interaction (STT & TTS)

| Direction | Technology |
|---|---|
| **Speech → Text** | Groq Whisper (multilingual, fast) |
| **Text → Speech** | OpenAI TTS (`tts-1`, voices: `alloy`, `echo`, `fable`, …) |

Click the mic, speak your question, hear Pragna reply — **hands-free conversations**.

---

### 🖼️ Image Studio

An in-app **AI image generation** page powered by multiple providers:

| Provider | Notes |
|---|---|
| **RunwayML** (`gen4_image`) | High-quality, cinematic |
| **OpenAI DALL·E 3** | Prompt-faithful generation |
| **Pollinations.ai** | Free fallback — always available |

Auto-fallback chain ensures images are generated even when one provider is unavailable.

---

### 🔐 OAuth & Social Authentication

Pragna supports seamless social authentication across major identity providers:

| Provider | Features | Callback Route |
|---|---|---|
| **Google** | One-click OAuth 2.0 login & signup | `/api/auth/google/callback` |
| **GitHub** | Developer-friendly authentication | `/api/auth/github/callback` |
| **Discord** | Community login with profile sync | `/api/auth/discord/callback` |

Session tokens are signed with secure JWTs, with dynamic redirect routing for both local development and multi-cloud deployments.

---

### 🤖 Agentic Coding Assistant

Two surfaces — **web panel** and **standalone CLI** — for AI-powered coding:

```
think → tool → observe → repeat → answer
```

**Tools available to the agent:**

| Tool | Type | Description |
|---|---|---|
| `read_file` | 🟢 Auto | Read any file in the sandbox |
| `list_dir` | 🟢 Auto | Browse directory structure |
| `search_code` | 🟢 Auto | Grep-style code search |
| `write_file` | 🔴 Confirm | Overwrite a file (diff preview) |
| `create_file` | 🔴 Confirm | Create a new file |
| `append_file` | 🔴 Confirm | Append to a file |
| `run_command` | 🔴 Confirm | Execute a shell command |

> **🛡️ Safety-first**: All mutating tools require explicit human approval via a diff/command preview before execution. Paths are sandboxed to a working-directory root.

**Web Agent Panel** — SSE-streamed, session-tracked in-browser coding assistant.
**CLI Agent** (`pragna_code.py`) — Standalone terminal agent, independent of Flask.

---

### 💬 Smart Chat Modes & Query Classification

The **query classifier** (`services/classifier.py`) routes every message through a pipeline:

```
classify_query → route_query → create_plan → AIOrchestrator.handle_query
```

Supported modes include:
- 💬 **General Chat** — Contextual conversation
- 🔍 **Web Search** — Live internet lookup
- 📰 **News** — Real-time news queries
- 📚 **RAG / Knowledge Base** — Document Q&A
- 🖼️ **Image Generation** — Triggered by generation intents
- 🧮 **Code** — Programming questions, analysis, generation

---

### 📊 Dashboard & Starred Requests

- **Usage dashboard** with conversation statistics and analytics
- **Star/bookmark** important requests for later reference
- **Chat search** — full-text search across all conversations
- **Compare mode** — side-by-side model comparison for any prompt

---

### 🔐 Authentication & User Management

| Feature | Detail |
|---|---|
| **Email/Password** | Bcrypt-hashed, JWT-issued (7-day expiry) |
| **OTP Verification** | Email OTP on signup via EmailJS or SMTP |
| **Password Reset** | Secure email link flow |
| **Google OAuth2** | One-click sign in with Google |
| **GitHub OAuth2** | One-click sign in with GitHub |

JWT tokens are verified on every protected route via the `require_auth` decorator.

---

### 🔗 Chat Sharing

Public **read-only share links** (`/share/<token>`) let you share any conversation externally — no login required for the recipient.

---

### 💾 Memory & Conversation Persistence

- **PostgreSQL** (Supabase) for persistent storage across deploys
- `services/memory_management.py` — token-budget-aware history pruning with importance scoring
- `smart_prune_history` ensures long conversations never exceed context windows
- Full conversation history, per-user, persisted across sessions

---

### 🎨 Frontend UI Highlights

- **Glassmorphism** dark-mode design with gold accents
- **Animated splash screen** on first load
- **Sidebar navigation** — Chat, Dashboard, Agent, Image Studio, Compare, Starred
- **Streaming responses** — word-by-word SSE rendering
- **Markdown rendering** with code block syntax highlighting
- **Artifact viewer** — renders structured agent outputs
- **Responsive** — works on desktop and mobile

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                     │
│  Auth → SplashScreen → PragnaApp → Chat / Agent / Studio    │
│           SSE streaming · Axios · JWT headers               │
└───────────────────────────┬─────────────────────────────────┘
                            │  /api/* (proxy → :5001)
┌───────────────────────────▼─────────────────────────────────┐
│                   Flask Backend (app.py)                     │
│  ~50 routes · JWT auth · Rate limiting · CORS               │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Classifier  │  │  Orchestrator│  │   LLM Service    │  │
│  │  + Router    │→ │  + Planner   │→ │  (multi-provider)│  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────┐ ┌───────┐ ┌────────┐  │
│  │   RAG    │ │  Memory  │ │ STT  │ │ Image │ │ Agent  │  │
│  │ (FAISS)  │ │  (DB)    │ │ TTS  │ │ Gen   │ │ (SSE)  │  │
│  └──────────┘ └──────────┘ └──────┘ └───────┘ └────────┘  │
└──────────────────────────────────┬──────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────┐
          ▼                        ▼                     ▼
   Ollama Cloud/Local          PostgreSQL           External APIs
   Groq · OpenAI               (Supabase)      Serper · News · Runway
```

---

## 📁 Project Structure

```
prgn/
├── backend/                    # Flask API server
│   ├── app.py                  # Main app (~2000 lines, ~50 routes)
│   ├── auth.py                 # JWT auth, OTP, password reset
│   ├── config.py               # All configuration & model registry
│   ├── database.py             # PostgreSQL via Supabase
│   ├── llm_service.py          # LLM dispatch layer
│   ├── stt_service.py          # Groq Whisper STT
│   ├── chat_management_api.py  # Chat blueprint (search, share, star)
│   └── services/
│       ├── classifier.py       # Query type classifier
│       ├── orchestrator.py     # AIOrchestrator — main request handler
│       ├── planner.py          # Request planning
│       ├── router.py           # Query routing
│       ├── rag_service.py      # FAISS RAG engine
│       ├── rag_scheduler.py    # Scheduled web-content refresh
│       ├── web_scraper.py      # Content scraping
│       ├── web_search_service.py # Serper + News integration
│       ├── memory_management.py  # Token-budget history pruning
│       ├── memory_db.py        # Conversation persistence
│       ├── code_agent.py       # Web agent loop (SSE)
│       ├── llm.py              # Low-level per-provider completions
│       ├── vision_service.py   # Image understanding
│       ├── document_generator.py # AI document generation
│       ├── email_service.py    # EmailJS / SMTP email
│       └── oauth_service.py    # Google & GitHub OAuth2
│
├── chatbot-ui-vite/            # React + Vite frontend
│   └── src/
│       ├── App.jsx             # Auth gate, splash, routing
│       ├── pragna/
│       │   ├── App.jsx         # Main shell (sidebar, view switching)
│       │   └── pages/
│       │       ├── HomePage.jsx          # Chat interface
│       │       ├── ImageStudioPage.jsx   # AI image generation
│       │       ├── ComparePage.jsx       # Model comparison
│       │       ├── StarredRequestsPage.jsx # Bookmarks
│       │       └── GptModesPage.jsx      # Mode selector
│       ├── components/
│       │   ├── agent/          # Web coding agent panel
│       │   ├── auth/           # Login, Register, Reset
│       │   ├── chat/           # Message bubbles, streaming, share
│       │   ├── dashboard/      # Stats & analytics
│       │   ├── artifact/       # Agent artifact viewer
│       │   └── input/          # Message input, voice, file upload
│       └── api/
│           ├── api.js          # fetch-based API client (manual JWT headers)
│           └── chatManagement.js # Axios client (auto JWT via interceptor)
│
├── pragna_code.py              # Standalone CLI coding agent
├── docker-compose.yml          # Docker full-stack setup
├── nginx.conf                  # Nginx reverse proxy config
└── render.yaml                 # Render.com deployment config
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+** with `pip`
- **Node.js 18+** with `npm`
- One or more of:
  - [Ollama](https://ollama.com/) (local or cloud API key)
  - [Groq API key](https://console.groq.com)
  - [OpenAI API key](https://platform.openai.com/api-keys)
- **PostgreSQL** — [Supabase free tier](https://supabase.com/) recommended

---

### 1️⃣ Clone & Set Up Backend

```bash
git clone https://github.com/shashidhar0109/Chat_Assistant_EtherX.git
cd Chat_Assistant_EtherX/backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys (see Configuration section below)
```

### 2️⃣ Set Up Frontend

```bash
cd ../chatbot-ui-vite
npm install
```

### 3️⃣ Start Everything

**Option A — One command (Windows):**

```cmd
cd ..
run_all.bat
```

**Option B — Manual:**

```bash
# Terminal 1 — Backend
cd backend
.venv\Scripts\python app.py

# Terminal 2 — Frontend
cd chatbot-ui-vite
npm run dev
```

**Option C — Docker:**

```bash
docker-compose up --build
```

Open **http://localhost:5180** in your browser. 🎉

---

## ⚙️ Configuration

Copy `backend/.env.example` to `backend/.env` and fill in the values:

### Minimum Configuration

```env
# Choose your LLM provider
LLM_PROVIDER=standard               # or "ollama_only"

# At least one LLM provider:
OLLAMA_API_KEY=your_ollama_key
GROQ_API_KEY=your_groq_key

# Database (required)
DATABASE_URL=postgresql://postgres.PROJECT:PASSWORD@HOST.pooler.supabase.com:5432/postgres

# Auth
JWT_SECRET=your-very-long-random-secret-here
```

### Full Configuration Reference

| Variable | Description | Default |
|---|---|---|
| `LLM_PROVIDER` | `standard` or `ollama_only` | `standard` |
| `OLLAMA_API_URL` | Ollama endpoint | `https://ollama.com` |
| `OLLAMA_MODEL` | Default Ollama model | `nemotron-3-super:cloud` |
| `GROQ_API_KEY` | Groq cloud key (fallback) | — |
| `OPENAI_API_KEY` | OpenAI key (fallback + images + TTS) | — |
| `SERPER_API_KEY` | Google Search via Serper | — |
| `NEWS_API_KEY` | NewsAPI for real-time news | — |
| `RUNWAY_API_KEY` | RunwayML image generation | — |
| `RAG_ENABLED` | Enable FAISS knowledge base | `True` |
| `SUPPORTED_LANGUAGES` | Comma-separated language codes | `en,hi,ta,te,kn` |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth2 | — |
| `GITHUB_CLIENT_ID/SECRET` | GitHub OAuth2 | — |
| `DEVELOPMENT_MODE` | Mock responses (dev only!) | `False` |
| `FLASK_PORT` | Backend server port | `5001` |

> ⚠️ **Never** set `DEVELOPMENT_MODE=True` or `FLASK_DEBUG=True` in production.

---

## 🖥️ CLI Coding Agent

Use Pragna as a terminal-based coding assistant — no browser required:

```bash
# Run on current directory
python pragna_code.py

# Run on a specific project
python pragna_code.py /path/to/your/project
```

The CLI agent has the same tool set as the web agent but blocks on a `y/N` prompt before any mutating operation.

---

## 🔌 Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Main streaming chat |
| `POST` | `/api/process_audio` | Audio transcription + response |
| `POST` | `/api/images/generate` | AI image generation |
| `GET` | `/api/models` | List available LLM models |
| `GET/POST` | `/api/rag/*` | RAG knowledge base management |
| `POST` | `/api/auth/register` | User registration |
| `POST` | `/api/auth/login` | Login → JWT |
| `GET` | `/api/auth/google` | Google OAuth2 flow |
| `GET` | `/api/auth/github` | GitHub OAuth2 flow |
| `POST` | `/api/agent/start` | Start web coding agent session |
| `GET` | `/api/agent/stream/<id>` | SSE stream for agent output |
| `POST` | `/api/agent/confirm/<id>` | Approve/deny agent action |
| `GET` | `/api/conversations` | List user conversations |
| `GET` | `/api/share/<token>` | Public shared conversation |
| `GET` | `/api/status` | Health check |

---

## 🐳 Docker Deployment

```bash
# Full stack (backend + frontend via Nginx)
docker-compose up -d

# View logs
docker-compose logs -f backend
```

The `docker-compose.yml` spins up the Flask backend and serves the built frontend through Nginx with proper reverse-proxy configuration.

---

## ☁️ Cloud Deployment (Render.com)

A `render.yaml` is included for one-click Render deployment:

1. Fork this repo
2. Connect it to [Render](https://render.com/)
3. Set environment variables in the Render dashboard
4. Deploy 🚀

---

## 🔒 Security Notes

- All passwords stored as **bcrypt hashes** — never plaintext
- JWT tokens are **short-lived** (7 days) and verified on every request
- Agent **sandboxing** prevents path traversal outside the working root
- Agent **confirm-before-act** prevents accidental destructive operations
- Rate limiting on expensive AI endpoints (image/document generation)
- `DEVELOPMENT_MODE=False` and `FLASK_DEBUG=False` **must** be set in production

---

## 🧪 Running Tests

Backend tests are standalone scripts (not pytest):

```bash
cd backend
python test_vision.py
python test_agent_sandbox.py
python test_rag_integration.py
python test_chat_search.py
# ... etc.
```

Frontend verification:

```bash
cd chatbot-ui-vite
npm run lint
npm run build
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes and test them
4. Open a Pull Request

Please keep the existing code style and always add tests for new backend features.

---

## 📄 License

[MIT License](backend/LICENSE) — free to use, modify, and distribute.

---

<div align="center">

**Built with ❤️ and प्रज्ञा**

*Pragna-1 A · Chat_Assistant_EtherX*

</div>

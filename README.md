# Paper Flashcard App

A personal learning application that intelligently selects papers from a Notion database, generates AI-powered flashcards based on paper content, and facilitates an iterative review loop with nuanced feedback using spaced repetition.

## Features

- **AI-Generated Questions**: Uses Claude API to generate contextual questions (1 MCQ + 5 open-ended) from your paper notes
- **Smart Answer Evaluation**: AI evaluates open-ended answers with detailed feedback on accuracy, completeness, and depth
- **Spaced Repetition**: SM-2 algorithm optimizes review scheduling for long-term retention
- **Notion Integration**: Syncs papers from your Notion database with automatic arXiv abstract enrichment
- **Progress Tracking**: Tracks mastery scores, review history, and session performance

## Project Structure

```
flashcard-app/
├── src/                      # Frontend (React + TypeScript)
│   ├── components/           # React UI components
│   │   ├── ErrorMessage.tsx
│   │   ├── FeedbackPanel.tsx
│   │   ├── FlashcardView.tsx   # MCQ question display
│   │   ├── HistoryView.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── OpenEndedView.tsx   # Open-ended question display
│   │   ├── PaperCard.tsx
│   │   ├── PaperDetail.tsx
│   │   ├── PaperFilters.tsx
│   │   ├── ProgressBar.tsx
│   │   └── SessionSummary.tsx
│   ├── constants/            # App constants and initial data
│   ├── hooks/                # Custom React hooks (useStorage)
│   ├── services/             # API services (claudeApi, notionApi)
│   ├── utils/                # Utility functions (priority, spacedRepetition)
│   └── App.tsx               # Main application component
├── server/                   # Backend (Express + TypeScript)
│   ├── routes/
│   │   ├── notion.ts         # Notion API routes
│   │   ├── generate.ts       # AI question generation
│   │   └── evaluate.ts       # AI answer evaluation
│   ├── utils/
│   │   └── arxiv.ts          # arXiv metadata fetching
│   └── index.ts              # Server entry point
├── shared/                   # Shared TypeScript types
│   └── types/
│       └── index.ts          # Type definitions for Paper, Flashcard, etc.
└── .env                      # Environment variables (not committed)
```

## Setup

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Configure Environment Variables

**Frontend** (`.env` in root):
```env
VITE_API_URL=http://localhost:3001
```

**Backend** (`server/.env`):
```env
NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_ID=your_database_id_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
PORT=3001
```

> **Note:** All API keys are stored only in `server/.env`. The frontend communicates with the backend, which handles all external API calls.

### 3. Set Up Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations) and create a new integration
2. Copy the API key to `server/.env`
3. Share your papers database with the integration
4. Copy the database ID from the URL to `server/.env`

**Required Notion Database Properties:**
- `Note` (Title): Paper title
- `Note Type` (Select): Should have "Paper" option

**Optional Properties** (auto-detected):
- `Tags`, `Labels`, or `Topics` (Multi-select): Topic tags
- `Authors` or `Author` (Rich text): Paper authors
- `URL`, `Link`, `Paper URL`, `Source`, or `userDefined:URL` (URL): Link to paper

**Optional Properties** (for syncing review stats back to Notion):
- `Last Reviewed` (Date)
- `Mastery Score` (Number)
- `Review Count` (Number)

## Running the App

### Development

```bash
# Terminal 1: Start the backend server
cd server
npm run dev

# Terminal 2: Start the frontend
npm run dev
```

The app will be available at `http://localhost:5173`

### Type Checking

```bash
# Frontend type check
npm run typecheck

# Backend type check
cd server
npm run typecheck
```

### Production Build

```bash
# Build frontend
npm run build

# Build backend
cd server
npm run build

# Start production server
npm start
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Express.js, TypeScript, @notionhq/client
- **AI**: Anthropic Claude API (claude-3-5-haiku)
- **Storage**: localStorage (client-side), Notion (server-side sync)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/papers` | Fetch all papers from Notion |
| GET | `/api/papers/:id` | Fetch single paper with content |
| PATCH | `/api/papers/:id` | Update paper review stats in Notion |
| GET | `/api/abstract/:id` | Fetch arXiv abstract for a paper |
| POST | `/api/generate` | Generate flashcard questions for a paper |
| POST | `/api/evaluate` | Evaluate an open-ended answer |

## Question Types

### MCQ (1 per session)
Quick recall check with 4 options covering key concepts from the paper.

### Open-ended (5 per session)
Deeper understanding questions with AI-powered evaluation:
- **Difficulty levels**: understand, apply, analyze, evaluate
- **Scoring**: 0-100 based on accuracy, completeness, and depth
- **Feedback**: What you got right, what's missing, actionable suggestions

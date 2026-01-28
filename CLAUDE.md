# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A flashcard quiz app for PhD researchers to review academic papers stored in Notion. Papers are fetched from a Notion database, AI-generated questions (1 MCQ + 5 open-ended) test comprehension with AI evaluation, and spaced repetition tracks mastery over time.

**Tech Stack:** TypeScript, React 19, Vite 7, Express, Notion API, Anthropic Claude API

### Question Types
- **MCQ (1 per session)**: Quick recall check with 4 options
- **Open-ended (5 per session)**: Deeper understanding questions with AI-powered evaluation
  - Difficulty levels: understand, apply, analyze, evaluate
  - Scoring: 0-100 based on accuracy, completeness, and depth
  - Feedback: What you got right, what's missing, actionable suggestions

## Commands

### Frontend (Vite + React + TypeScript)
```bash
npm run dev        # Start dev server (localhost:5173)
npm run build      # TypeScript check + production build
npm run lint       # ESLint
npm run typecheck  # TypeScript type checking only
```

### Backend (Express + TypeScript)
```bash
cd server
npm run dev        # Start with tsx watch (localhost:3001)
npm run build      # Compile TypeScript to dist/
npm start          # Production start (runs dist/index.js)
npm run typecheck  # TypeScript type checking only
```

Both must be running for full functionality. Frontend falls back to hardcoded papers if backend unavailable.

## Architecture

### Project Structure
```
flashcard-app/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # React components (.tsx)
│   ├── services/           # API clients (.ts)
│   ├── hooks/              # Custom hooks (.ts)
│   ├── utils/              # Utility functions (.ts)
│   ├── constants/          # Constants and fallback data (.ts)
│   ├── App.tsx             # Main app with reducer
│   └── main.tsx            # Entry point
├── server/                 # Backend (Express + TypeScript)
│   ├── routes/             # API route handlers (.ts)
│   ├── utils/              # Server utilities (.ts)
│   └── index.ts            # Server entry point
├── shared/                 # Shared code between frontend/backend
│   └── types/              # TypeScript type definitions
│       └── index.ts        # All shared types (Paper, Flashcard, etc.)
└── tsconfig.json           # Frontend TypeScript config
```

### Data Flow
1. **Notion DB** → Backend fetches papers filtered by `Note Type = "Paper"`
2. **Backend** (`server/`) → Express proxy handles Notion API, arXiv abstracts, AI question generation, and AI evaluation
3. **Frontend** → Displays papers, calls backend for questions, tracks progress in localStorage
4. **arXiv API** → Fetches abstracts for papers with arXiv URLs (enriches question generation)

### Key Services
- `src/services/claudeApi.ts` - Frontend wrapper that calls backend for question generation + evaluation
- `src/services/notionApi.ts` - Calls backend proxy at `VITE_API_URL` for papers and abstracts
- `server/routes/notion.ts` - Notion SDK integration, extracts page blocks, fetches arXiv abstracts
- `server/routes/generate.ts` - AI question generation endpoint (uses ANTHROPIC_API_KEY)
- `server/routes/evaluate.ts` - AI evaluation endpoint for open-ended answers
- `server/utils/arxiv.ts` - arXiv ID extraction and metadata fetching

### Key Components
- `src/components/FlashcardView.tsx` - MCQ question display and interaction
- `src/components/OpenEndedView.tsx` - Open-ended question display with textarea and AI feedback
- `src/components/SessionSummary.tsx` - Session results with expandable question details

### Shared Types (shared/types/index.ts)
All TypeScript types are centralized in `shared/types/index.ts`:
- `Paper`, `PaperStats` - Paper entity and review statistics
- `Flashcard` (union: `MCQFlashcard | OpenEndedFlashcard`) - Question types
- `Answer`, `FeedbackObject` - User answer and AI feedback
- `Session` - Quiz session record
- `AppState`, `AppAction` - Frontend state management types
- API request/response types for all endpoints

### State Management
Single `useReducer` in `App.tsx` manages:
- `screen`: 'home' | 'loading' | 'review' | 'summary' | 'history'
- `papers`, `paperStats`, `flashcards`, `currentCardIndex`, `answers`, `sessionHistory`

### Storage
`src/hooks/useStorage.ts` wraps localStorage with typed async interface:
- `paper-stats` - Mastery scores, review counts, SR intervals
- `sessions:{id}` - Session history with question details and feedback
- `flashcards:{paperId}` - Cached generated questions (MCQ + open-ended)
- `abstract:{paperId}` - Cached arXiv abstracts

### Spaced Repetition
SM-2 algorithm in `src/utils/spacedRepetition.ts`. Quality ratings (0-5) adjust ease factor and next review interval.

### Priority Calculation
`src/utils/priority.ts` weights: never reviewed (+50), days since review (capped +30), low mastery (+20), category importance, due for review (+25).

## Environment Variables

### Frontend (`.env`)
```
VITE_API_URL=http://localhost:3001  # Backend URL (handles all API calls)
```

### Backend (`server/.env`)
```
NOTION_API_KEY=secret_...           # Notion integration
NOTION_DATABASE_ID=...              # Papers database
ANTHROPIC_API_KEY=sk-ant-...        # For all AI operations (generation + evaluation)
```

**Note:** All API keys are stored only in `server/.env`. To change the Anthropic API key, update `server/.env` and restart the server - no frontend changes needed.

## Notion Database Schema

**Required properties:**
- `Note` (title) - Paper title
- `Note Type` (select) - Must include "Paper" option to filter papers

**Optional properties (auto-detected):**
- `Tags` (multi-select) - Also detects: Labels, Topics
- `Authors` or `Author` (rich text)
- `URL` (url) - Also detects: Link, Paper URL, Source, userDefined:URL

**Optional properties for syncing stats back to Notion:**
- `Last Reviewed` (date)
- `Mastery Score` (number)
- `Review Count` (number)

Note: Stats are always saved locally in localStorage. Notion sync is optional and only works if the properties exist.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A flashcard quiz app for PhD researchers to review academic papers stored in Notion. Papers are fetched from a Notion database, AI-generated questions (1 MCQ + 5 open-ended) test comprehension with AI evaluation, and spaced repetition tracks mastery over time.

### Question Types
- **MCQ (1 per session)**: Quick recall check with 4 options
- **Open-ended (5 per session)**: Deeper understanding questions with AI-powered evaluation
  - Difficulty levels: understand, apply, analyze, evaluate
  - Scoring: 0-100 based on accuracy, completeness, and depth
  - Feedback: What you got right, what's missing, actionable suggestions

## Commands

### Frontend (Vite + React)
```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # Production build
npm run lint     # ESLint
```

### Backend (Express proxy for Notion API)
```bash
cd server
npm run dev      # Start with --watch (localhost:3001)
npm start        # Production start
```

Both must be running for full functionality. Frontend falls back to hardcoded papers if backend unavailable.

## Architecture

### Data Flow
1. **Notion DB** → Backend fetches papers filtered by `Note Type = "Paper"`
2. **Backend** (`server/`) → Express proxy handles Notion API, arXiv abstracts, and AI evaluation
3. **Frontend** → Displays papers, generates mixed questions via Claude API, tracks progress in localStorage
4. **arXiv API** → Fetches abstracts for papers with arXiv URLs (enriches question generation)

### Key Services
- `src/services/claudeApi.js` - Question generation + evaluation via Anthropic API (`claude-haiku-4-5`)
- `src/services/notionApi.js` - Calls backend proxy at `VITE_API_URL` for papers and abstracts
- `server/routes/notion.js` - Notion SDK integration, extracts page blocks, fetches arXiv abstracts
- `server/routes/evaluate.js` - AI evaluation endpoint for open-ended answers
- `server/utils/arxiv.js` - arXiv ID extraction and metadata fetching

### Key Components
- `src/components/FlashcardView.jsx` - MCQ question display and interaction
- `src/components/OpenEndedView.jsx` - Open-ended question display with textarea and AI feedback
- `src/components/SessionSummary.jsx` - Session results with expandable question details

### State Management
Single `useReducer` in `App.jsx` manages:
- `screen`: 'home' | 'loading' | 'review' | 'summary' | 'history'
- `papers`, `paperStats`, `flashcards`, `currentCardIndex`, `answers`, `sessionHistory`

### Storage
`src/hooks/useStorage.js` wraps localStorage with async interface:
- `paper-stats` - Mastery scores, review counts, SR intervals
- `sessions:{id}` - Session history with question details and feedback
- `flashcards:{paperId}` - Cached generated questions (MCQ + open-ended)
- `abstract:{paperId}` - Cached arXiv abstracts

### Spaced Repetition
SM-2 algorithm in `src/utils/spacedRepetition.js`. Quality ratings (0-5) adjust ease factor and next review interval.

### Priority Calculation
`src/utils/priority.js` weights: never reviewed (+50), days since review (capped +30), low mastery (+20), category importance, due for review (+25).

## Environment Variables

### Frontend (`.env`)
```
VITE_ANTHROPIC_API_KEY=sk-ant-...   # For question generation
VITE_API_URL=http://localhost:3001
```

### Backend (`server/.env`)
```
NOTION_API_KEY=secret_...           # Notion integration
NOTION_DATABASE_ID=...              # Papers database
ANTHROPIC_API_KEY=sk-ant-...        # For AI evaluation of open-ended answers
```

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

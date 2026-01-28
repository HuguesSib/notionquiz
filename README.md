# Paper Flashcard App

A personal learning application that intelligently selects papers from a Notion database, generates AI-powered flashcards based on paper content, and facilitates an iterative review loop with nuanced feedback using spaced repetition.

## Features

- **AI-Generated Flashcards**: Uses Claude API to generate contextual flashcards from your paper notes
- **Smart Answer Evaluation**: AI evaluates your answers and provides constructive feedback
- **Spaced Repetition**: SM-2 algorithm optimizes review scheduling for long-term retention
- **Notion Integration**: Syncs papers from your Notion database
- **Progress Tracking**: Tracks mastery scores and review history

## Project Structure

```
flashcard-app/
├── src/
│   ├── components/       # React UI components
│   │   ├── ErrorMessage.jsx
│   │   ├── FeedbackPanel.jsx
│   │   ├── FlashcardView.jsx
│   │   ├── HistoryView.jsx
│   │   ├── LoadingSpinner.jsx
│   │   ├── PaperCard.jsx
│   │   ├── ProgressBar.jsx
│   │   └── SessionSummary.jsx
│   ├── constants/        # App constants and initial data
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API services (Claude, Notion)
│   ├── utils/            # Utility functions
│   └── App.jsx           # Main application component
├── server/               # Express backend for Notion API
│   ├── routes/
│   │   └── notion.js     # Notion API routes
│   └── index.js          # Server entry point
└── .env                  # Environment variables (not committed)
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
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key_here
VITE_API_URL=http://localhost:3001
```

**Backend** (`server/.env`):
```env
NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_ID=your_database_id_here
PORT=3001
```

### 3. Set Up Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations) and create a new integration
2. Copy the API key to `server/.env`
3. Share your papers database with the integration
4. Copy the database ID from the URL to `server/.env`

**Required Notion Database Properties:**
- `Note` (Title): Paper title
- `Note Type` (Select): Should have "Paper" option
- `[Paper] Category` (Select): Paper category
- `Tags` (Multi-select): Topic tags
- `Authors` (Text): Paper authors
- `userDefined:URL` or `URL` (URL): Link to paper

**Optional Properties** (for syncing review stats):
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

### Production Build

```bash
npm run build
npm run preview
```

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS
- **Backend**: Express.js, @notionhq/client
- **AI**: Anthropic Claude API (Haiku 4.5)
- **Storage**: LocalStorage (client-side), Notion (server-side)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/papers` | Fetch all papers from Notion |
| GET | `/api/papers/:id` | Fetch single paper |
| PATCH | `/api/papers/:id` | Update paper review stats |

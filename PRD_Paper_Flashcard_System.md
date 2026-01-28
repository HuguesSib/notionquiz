# Product Requirements Document: Paper Flashcard Review System

## Executive Summary

A personal learning application that intelligently selects papers from a Notion database, generates AI-powered flashcards based on paper content, and facilitates an iterative review loop with nuanced feedback. The system implements spaced repetition to optimize long-term retention of research concepts.

---

## 1. Problem Statement

### Current Pain Points
- **Passive Reading**: Reading papers once without active recall leads to poor retention
- **No Review System**: No structured way to revisit and reinforce paper concepts over time
- **Scattered Notes**: Paper notes exist in Notion but aren't transformed into testable knowledge
- **Time Inefficiency**: Manually creating flashcards is tedious and often skipped

### Target User
A PhD researcher who regularly reads and annotates academic papers in Notion, seeking to deepen understanding and retain key concepts from their research domain (Computer Vision, 3D Reconstruction, etc.).

---

## 2. Solution Overview

An artifact-based application that:
1. Connects to a Notion database filtered for papers
2. Selects papers using weighted random selection (prioritizing unreviewed/stale + important papers)
3. Generates contextual flashcards using Claude Opus 4.5 (via Anthropic API)
4. Runs an interactive review session with nuanced AI feedback
5. Tracks performance for spaced repetition scheduling
6. Stores session history for learning analytics

---

## 3. Data Architecture

### 3.1 Notion Database Schema (Existing)

| Property | Type | Usage |
|----------|------|-------|
| `Note` | Title | Paper title |
| `Note Type` | Select | Filter for "Paper" |
| `[Paper] Category` | Select | Importance proxy: "🏛️ Foundational" = highest |
| `Tags` | Multi-select | Topic categorization |
| `Authors` | Text | Paper authors |
| `userDefined:URL` | URL | Link to paper (arXiv, etc.) |
| `Publication Date` | Date | When published |
| `Created time` | Datetime | When added to Notion |
| `Last edited time` | Datetime | Last modification |

### 3.2 Suggested Notion Schema Additions

| Property | Type | Purpose |
|----------|------|---------|
| `Last Reviewed` | Date | Track when paper was last reviewed |
| `Review Count` | Number | Total review sessions for this paper |
| `Mastery Score` | Number (0-100) | Computed average performance |

> **Note**: These can be updated by the app after each session via Notion API, enabling cross-session persistence and Notion-native filtering.

### 3.3 Artifact Persistent Storage Schema

```javascript
// Storage Keys Structure

// Paper review metadata (synced with Notion ideally)
"papers:{paper_id}": {
  notionPageId: string,
  title: string,
  lastReviewed: ISO8601 | null,
  reviewCount: number,
  masteryScore: number,        // 0-100, rolling average
  conceptScores: {             // Per-concept tracking
    [conceptKey: string]: {
      correct: number,
      total: number,
      lastSeen: ISO8601
    }
  }
}

// Session history for analytics
"sessions:{session_id}": {
  id: string,
  paperId: string,
  paperTitle: string,
  startedAt: ISO8601,
  completedAt: ISO8601 | null,
  flashcards: [
    {
      question: string,
      expectedAnswer: string,
      userAnswer: string | null,
      feedback: string,
      score: number,           // 0-1 scale
      concept: string          // Tagged concept for tracking
    }
  ],
  overallScore: number
}

// Spaced repetition queue
"review-queue": {
  lastUpdated: ISO8601,
  queue: [
    {
      paperId: string,
      priority: number,        // Computed priority score
      dueDate: ISO8601,
      reason: string           // "new" | "due" | "struggling"
    }
  ]
}

// User preferences
"preferences": {
  cardsPerSession: number,     // Default: 6
  difficultyLevel: string,     // "foundational" | "detailed" | "advanced"
  focusTags: string[],         // Optional tag filters
  showHints: boolean
}
```

---

## 4. Feature Specifications

### 4.1 Paper Selection Algorithm

**Weighted Random Selection** considering:

| Factor | Weight | Logic |
|--------|--------|-------|
| Never reviewed | +50 | `lastReviewed === null` |
| Days since review | +2 per day | `daysSince(lastReviewed) * 2`, capped at 30 |
| Low mastery | +20 | `masteryScore < 50` |
| Category importance | +15 | "🏛️ Foundational" = +15, "🔬 Methodological" = +10 |
| Due for review (SR) | +25 | Based on spaced repetition interval |

**Selection Process**:
1. Fetch all papers from Notion (Note Type = "Paper")
2. Compute priority score for each
3. Apply softmax to convert to probabilities
4. Random sample weighted by probability

### 4.2 Flashcard Generation

**Input Sources**:
1. **Notion Content**: Personal notes, overview, key sections from the page
2. **Paper Source** (optional): Fetch abstract/key sections from arXiv URL if available

**Prompt Strategy**:
```
You are generating flashcards for a PhD researcher studying {tags}.

Paper: {title}
Authors: {authors}
User's Notes:
{notion_content}

Paper Abstract (if available):
{fetched_abstract}

Generate {n} flashcards that:
1. Test understanding, not just recall
2. Cover key concepts: methodology, contributions, limitations
3. Include at least one card on how this relates to the broader field
4. Vary difficulty: 2 foundational, 2-3 intermediate, 1-2 advanced
5. Focus on concepts the user highlighted in their personal notes

Format each card as:
{
  "question": "...",
  "expectedAnswer": "Key points the answer should cover",
  "concept": "tagged_concept_name",
  "difficulty": "foundational|intermediate|advanced",
  "hint": "Optional hint if they're stuck"
}
```

### 4.3 Review Session Flow

```
┌─────────────────────────────────────────────────────────┐
│                    SESSION START                         │
│  Paper: {title}                                          │
│  Category: {category} | Tags: {tags}                     │
│  Last reviewed: {date} | Mastery: {score}%               │
│  [Start Review] [Pick Different Paper]                   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   FLASHCARD VIEW                         │
│  Card 3 of 6                              [Skip Card]    │
│  ─────────────────────────────────────────────────────── │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                                                     │ │
│  │   What is the key innovation in MapAnything's      │ │
│  │   factored scene representation, and why does      │ │
│  │   it matter for multi-view reconstruction?         │ │
│  │                                                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  Your answer (optional):                                 │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                                                     │ │
│  │                                                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  [Show Hint]                        [Reveal Answer →]    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   ANSWER + FEEDBACK                      │
│  Card 3 of 6                                             │
│  ─────────────────────────────────────────────────────── │
│  Your answer:                                            │
│  "It separates depth maps, ray directions, poses..."     │
│                                                          │
│  ─────────────────────────────────────────────────────── │
│  Expected answer:                                        │
│  The factored representation explicitly separates:       │
│  - Per-view depth maps (Di)                              │
│  - Local ray directions (Ri)                             │
│  - Camera poses (Pi)                                     │
│  - Global metric scale factor (m)                        │
│                                                          │
│  This matters because it allows the model to leverage    │
│  partial information when available and maintain         │
│  consistency across different input configurations.      │
│                                                          │
│  ─────────────────────────────────────────────────────── │
│  AI Feedback:                                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ✓ You correctly identified the separation of       │ │
│  │   geometric components.                             │ │
│  │                                                     │ │
│  │ △ You could expand on WHY this matters:            │ │
│  │   - Enables graceful handling of missing info      │ │
│  │   - No expensive post-processing like DUSt3R       │ │
│  │                                                     │ │
│  │ Score: 0.75 - Good understanding of structure,     │ │
│  │ deepen understanding of practical benefits.        │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  How well did you know this?                             │
│  [😫 Forgot] [🤔 Struggled] [👍 Good] [🎯 Perfect]       │
│                                                          │
│                                    [Next Card →]         │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼ (after all cards)
┌─────────────────────────────────────────────────────────┐
│                  SESSION SUMMARY                         │
│  ─────────────────────────────────────────────────────── │
│  Paper: MapAnything                                      │
│  Session Score: 78%                                      │
│  Cards: 6 | Time: 12 min                                 │
│                                                          │
│  Concept Breakdown:                                      │
│  ├─ Architecture      ████████░░  80%                    │
│  ├─ Loss Functions    ██████░░░░  60%                    │
│  ├─ Methodology       █████████░  90%                    │
│  └─ Related Work      ███████░░░  70%                    │
│                                                          │
│  Areas to revisit:                                       │
│  • Log-space processing for scale invariance             │
│  • Comparison with DUSt3R's coupled representation       │
│                                                          │
│  Next review suggested: 3 days                           │
│                                                          │
│  [Review Again] [New Paper] [End Session]                │
└─────────────────────────────────────────────────────────┘
```

### 4.4 Feedback Evaluation System

**Evaluation Prompt**:
```
You are evaluating a researcher's flashcard answer.

Question: {question}
Expected key points: {expectedAnswer}
User's answer: {userAnswer}
Paper context: {relevantContext}

Evaluate based on:
1. Factual accuracy (does it contain correct information?)
2. Completeness (what key points are missing?)
3. Conceptual understanding (surface recall vs. deep understanding?)

Respond with:
{
  "score": 0.0-1.0,
  "correct_points": ["..."],
  "missing_points": ["..."],
  "misconceptions": ["..."] or null,
  "feedback": "Constructive 2-3 sentence feedback",
  "suggestion": "One thing to study further"
}
```

### 4.5 Spaced Repetition Algorithm

Based on a simplified SM-2 algorithm:

```javascript
function calculateNextReview(quality, previousInterval, easeFactor) {
  // quality: 0-5 scale (derived from user rating)
  // 😫 Forgot = 0, 🤔 Struggled = 2, 👍 Good = 4, 🎯 Perfect = 5
  
  if (quality < 3) {
    // Failed - reset to beginning
    return { interval: 1, easeFactor: Math.max(1.3, easeFactor - 0.2) };
  }
  
  let newInterval;
  if (previousInterval === 0) {
    newInterval = 1;
  } else if (previousInterval === 1) {
    newInterval = 3;
  } else {
    newInterval = Math.round(previousInterval * easeFactor);
  }
  
  const newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  return {
    interval: Math.min(newInterval, 60), // Cap at 60 days
    easeFactor: Math.max(1.3, newEaseFactor)
  };
}
```

---

## 5. Technical Architecture

### 5.1 Component Structure

```
┌────────────────────────────────────────────────────────────┐
│                     React Artifact                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   App.jsx    │  │   Hooks/     │  │  Components/ │     │
│  │  (Router)    │  │              │  │              │     │
│  └──────────────┘  │ useNotion    │  │ PaperCard    │     │
│                    │ useStorage   │  │ Flashcard    │     │
│  ┌──────────────┐  │ useReview    │  │ FeedbackPanel│     │
│  │   Screens/   │  │ useSR        │  │ ProgressBar  │     │
│  │              │  └──────────────┘  │ SessionStats │     │
│  │ HomeScreen   │                    └──────────────┘     │
│  │ ReviewScreen │  ┌──────────────┐                       │
│  │ SummaryScreen│  │   Services/  │  ┌──────────────┐     │
│  │ HistoryScreen│  │              │  │   Utils/     │     │
│  └──────────────┘  │ claudeAPI    │  │              │     │
│                    │ notionAPI    │  │ srAlgorithm  │     │
│                    │ storageAPI   │  │ scoring      │     │
│                    └──────────────┘  └──────────────┘     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 5.2 API Integration

**Anthropic API (Claude Opus 4.5)**:
- Flashcard generation
- Answer evaluation & feedback
- Used via artifact's built-in API access

**Notion MCP**:
- Fetch papers from database
- Update review metadata (Last Reviewed, Mastery Score)
- Read paper content and notes

**Persistent Storage**:
- Session history
- Spaced repetition state
- User preferences
- Concept-level tracking

### 5.3 State Management

```javascript
// Main application state
const AppState = {
  // Current session
  currentPaper: Paper | null,
  flashcards: Flashcard[],
  currentCardIndex: number,
  sessionAnswers: Answer[],
  
  // Review queue
  reviewQueue: QueuedPaper[],
  
  // Historical data (from storage)
  paperStats: Map<string, PaperStats>,
  sessionHistory: Session[],
  
  // UI state
  screen: 'home' | 'review' | 'summary' | 'history',
  isLoading: boolean,
  error: string | null
};
```

---

## 6. User Interface Specifications

### 6.1 Design Principles

1. **Focus Mode**: Minimal distractions during review
2. **Progressive Disclosure**: Show hints/answers only when requested
3. **Clear Feedback**: Visual distinction between correct/incorrect/partial
4. **Motivation**: Progress indicators, streaks, mastery visualization

### 6.2 Color Palette

| Element | Color | Usage |
|---------|-------|-------|
| Primary | `#6366f1` (Indigo) | Buttons, active states |
| Success | `#22c55e` (Green) | Correct answers |
| Warning | `#f59e0b` (Amber) | Partial answers |
| Error | `#ef4444` (Red) | Incorrect, reset |
| Background | `#f8fafc` | Main background |
| Card | `#ffffff` | Card surfaces |
| Text | `#1e293b` | Primary text |
| Muted | `#64748b` | Secondary text |

### 6.3 Key Interactions

| Action | Trigger | Response |
|--------|---------|----------|
| Reveal answer | Click button OR Enter key | Slide transition to answer view |
| Submit answer | Enter in textarea | Save answer, trigger evaluation |
| Self-rate | Click rating button | Update SR data, advance card |
| Skip card | Click skip | Mark as skipped, advance |
| Show hint | Click hint button | Fade in hint text |
| Navigate cards | Arrow keys | Move between cards |

---

## 7. Success Metrics

### 7.1 Learning Effectiveness
- **Retention Rate**: % of cards rated "Good" or "Perfect" on review
- **Mastery Growth**: Average mastery score increase over time
- **Concept Coverage**: % of paper concepts with scores > 70%

### 7.2 Engagement
- **Session Completion Rate**: % of started sessions completed
- **Review Frequency**: Average days between reviews
- **Time per Card**: Average review time (target: 30-90 seconds)

### 7.3 System Health
- **API Latency**: Flashcard generation < 5s, evaluation < 3s
- **Storage Reliability**: No data loss across sessions

---

## 8. Implementation Phases

### Phase 1: MVP (Core Loop)
- [ ] Paper fetching from Notion
- [ ] Basic weighted random selection
- [ ] Flashcard generation (5 cards)
- [ ] Review UI with answer input
- [ ] Basic AI feedback
- [ ] Session storage
- [ ] Simple summary screen

### Phase 2: Spaced Repetition
- [ ] SR algorithm implementation
- [ ] Review queue management
- [ ] Due date calculations
- [ ] Notion property updates (Last Reviewed)

### Phase 3: Analytics & Polish
- [ ] Session history view
- [ ] Concept-level tracking
- [ ] Performance visualizations
- [ ] Preferences panel
- [ ] Keyboard shortcuts

### Phase 4: Enhancements
- [ ] Paper content fetching from arXiv
- [ ] Multi-paper review sessions
- [ ] Export/import data
- [ ] Tag-based filtering

---

## 9. Open Questions & Decisions Needed

1. **Notion Schema Changes**: Should we add "Last Reviewed" and "Mastery Score" properties to your Notion database now, or keep all tracking in artifact storage?

2. **Difficulty Modes**: Should flashcard difficulty adapt automatically based on performance, or remain user-selectable?

3. **Session Length**: Fixed 5-8 cards, or dynamic based on available time?

4. **Related Papers**: Should the system suggest related papers after a session based on struggled concepts?

5. **Offline Capability**: Is offline review important, or is online-only acceptable?

---

## 10. Appendix

### A. Sample Flashcard Types

| Type | Example Question |
|------|------------------|
| **Conceptual** | "What problem does the factored scene representation solve compared to coupled representations?" |
| **Technical** | "What are the four components of MapAnything's factored representation (Di, Ri, Pi, m)?" |
| **Comparative** | "How does MapAnything differ from DUSt3R in handling multi-view reconstruction?" |
| **Application** | "In what scenarios would MapAnything's universal approach be most beneficial over specialized methods?" |
| **Critical** | "What are the main limitations of MapAnything mentioned by the authors?" |

### B. Notion Database Filter

```javascript
// Query to fetch papers for review
{
  filter: {
    property: "Note Type",
    select: { equals: "Paper" }
  },
  sorts: [
    { property: "Last edited time", direction: "descending" }
  ]
}
```

### C. Error Handling Strategy

| Error | User Message | Recovery |
|-------|--------------|----------|
| Notion API failure | "Couldn't load papers. Check your connection." | Retry button, offline mode |
| Claude API timeout | "Taking longer than usual..." | Show loading, auto-retry |
| Empty paper content | "This paper doesn't have enough notes yet." | Skip to next paper |
| Storage full | "Storage limit reached. Export your data." | Export option |

---

*Document Version: 1.0*  
*Last Updated: January 26, 2026*  
*Author: Claude (with user input)*

// ==================== Core Domain Types ====================

/**
 * Paper entity from Notion database
 */
export interface Paper {
  id: string;
  title: string;
  tags?: string[];
  authors?: string;
  url?: string;
  notionUrl?: string;
  content?: string;
  lastEdited?: string;
  createdAt?: string;
}

/**
 * Spaced repetition stats for a paper
 */
export interface PaperStats {
  lastReviewed?: string; // ISO date string
  masteryScore: number; // 0-100
  reviewCount: number;
  easeFactor: number; // SM-2 ease factor (typically 1.3-2.5)
  interval: number; // Days until next review
  dueDate?: string; // ISO date string
}

/**
 * Concept categories for questions
 */
export type QuestionConcept = 
  | 'main_contribution' 
  | 'technical' 
  | 'comparison' 
  | 'practical';

/**
 * Difficulty levels for open-ended questions (Bloom's taxonomy)
 */
export type QuestionDifficulty = 
  | 'understand' 
  | 'apply' 
  | 'analyze' 
  | 'evaluate';

/**
 * Question types
 */
export type QuestionType = 'mcq' | 'open-ended';

/**
 * Multiple choice question flashcard
 */
export interface MCQFlashcard {
  questionType: 'mcq';
  question: string;
  options: string[]; // Exactly 4 options
  correctIndex: number; // 0-3
  explanation: string;
  concept?: QuestionConcept;
  relatedPaper?: string;
}

/**
 * Open-ended question flashcard
 */
export interface OpenEndedFlashcard {
  questionType: 'open-ended';
  question: string;
  expectedPoints: string[];
  explanation: string;
  concept?: QuestionConcept;
  difficulty?: QuestionDifficulty;
}

/**
 * Union type for all flashcard types
 */
export type Flashcard = MCQFlashcard | OpenEndedFlashcard;

/**
 * AI evaluation feedback for open-ended answers
 */
export interface FeedbackObject {
  score: number; // 0-100
  correct?: string[];
  correct_points?: string[]; // Alternative naming from API
  missing?: string[];
  missing_points?: string[]; // Alternative naming from API
  misconceptions?: string[];
  feedback?: string;
  suggestion?: string;
}

/**
 * User's answer to a question
 */
export interface Answer {
  selectedIndex?: number; // For MCQ
  userText?: string; // For open-ended
  isCorrect: boolean;
  score: number; // 0-100
  feedback?: FeedbackObject;
}

/**
 * Flashcard data saved in session history
 */
export interface SessionFlashcard {
  question: string;
  questionType: QuestionType;
  correctAnswer: string;
  userAnswer?: string;
  isCorrect: boolean;
  score: number;
  feedback?: FeedbackObject;
  concept?: QuestionConcept;
}

/**
 * Quiz session record
 */
export interface Session {
  id: string;
  paperId?: string;
  paperTitle?: string;
  startedAt: string; // ISO date string
  completedAt: string; // ISO date string
  flashcards: SessionFlashcard[];
  overallScore: number; // 0-100
  correctCount: number;
  totalCount: number;
}

// ==================== Rating Types ====================

/**
 * Rating keys for spaced repetition
 */
export type RatingKey = 'forgot' | 'struggled' | 'good' | 'perfect';

/**
 * Rating configuration
 */
export interface RatingConfig {
  label: string;
  value: number; // SM-2 quality value (0-5)
  color: string;
}

/**
 * Rating map type
 */
export type RatingMap = Record<RatingKey, RatingConfig>;

// ==================== App State Types ====================

/**
 * Application screen states
 */
export type AppScreen = 'home' | 'loading' | 'review' | 'summary' | 'history';

/**
 * Sort options for papers
 */
export type SortOption = 
  | 'priority' 
  | 'new-first' 
  | 'mastery-asc' 
  | 'mastery-desc' 
  | 'recent' 
  | 'alphabetical';

/**
 * Application state shape
 */
export interface AppState {
  screen: AppScreen;
  papers: Paper[];
  paperStats: Record<string, PaperStats>;
  currentPaper: Paper | null;
  flashcards: Flashcard[];
  currentCardIndex: number;
  answers: Answer[];
  sessionHistory: Session[];
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  isAnswered: boolean;
  isEvaluating: boolean;
}

/**
 * Application reducer action types
 */
export type AppAction =
  | { type: 'SET_LOADING'; payload: { loading: boolean; message?: string } }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_EVALUATING'; payload: boolean }
  | { type: 'SET_PAPERS'; payload: Paper[] }
  | { type: 'SET_PAPER_STATS'; payload: Record<string, PaperStats> }
  | { type: 'SET_SESSION_HISTORY'; payload: Session[] }
  | { type: 'SELECT_PAPER'; payload: Paper }
  | { type: 'SET_FLASHCARDS'; payload: Flashcard[] }
  | { type: 'MARK_ANSWERED' }
  | { type: 'SAVE_ANSWER'; payload: Answer }
  | { type: 'NEXT_CARD' }
  | { type: 'PREV_CARD' }
  | { type: 'SET_SCREEN'; payload: AppScreen }
  | { type: 'RESET_SESSION' };

// ==================== API Request/Response Types ====================

/**
 * Generate flashcards request
 */
export interface GenerateRequest {
  paper: Paper;
  otherPapers?: Paper[];
  numCards?: number;
  abstract?: string | null;
}

/**
 * Generate flashcards response
 */
export interface GenerateResponse {
  flashcards: Flashcard[];
}

/**
 * Evaluate answer request
 */
export interface EvaluateRequest {
  question: string;
  expectedPoints: string[];
  userAnswer: string;
  paperContext?: string;
}

/**
 * Evaluate answer response
 */
export interface EvaluateResponse {
  score: number; // 0-100
  feedback: {
    correct: string[];
    missing: string[];
    suggestion: string;
  };
}

/**
 * Papers list response
 */
export interface PapersResponse {
  papers: Paper[];
  count: number;
  hasMore: boolean;
}

/**
 * Update paper stats request
 */
export interface UpdatePaperRequest {
  lastReviewed?: string;
  masteryScore?: number;
  reviewCount?: number;
}

/**
 * Update paper stats response
 */
export interface UpdatePaperResponse {
  success: boolean;
  updatedAt: string;
}

/**
 * Abstract fetch response
 */
export interface AbstractResponse {
  paperId?: string;
  arxivId: string;
  url?: string;
  abstract: string;
  arxivTitle?: string;
  title?: string;
  arxivAuthors?: string[];
  authors?: string[];
  arxivPublished?: string;
  published?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: string;
  message: string;
  hint?: string;
}

// ==================== ArXiv Types ====================

/**
 * ArXiv metadata
 */
export interface ArxivMetadata {
  title: string;
  abstract: string;
  authors: string[];
  published: string; // ISO date string
}

// ==================== Storage Types ====================

/**
 * Cached flashcards storage
 */
export interface CachedFlashcards {
  flashcards: Flashcard[];
  generatedAt: string;
  paperTitle: string;
  hadAbstract?: boolean;
}

/**
 * Cached abstract storage
 */
export interface CachedAbstract {
  abstract: string;
  arxivId: string;
  arxivTitle?: string;
  fetchedAt: string;
}

// ==================== Spaced Repetition Types ====================

/**
 * Spaced repetition calculation result
 */
export interface SpacedRepetitionResult {
  interval: number; // Days
  easeFactor: number;
}

/**
 * Priority label result
 */
export interface PriorityLabel {
  label: string;
  className: string;
}

// ==================== Type Guards ====================

/**
 * Check if a flashcard is an MCQ
 */
export function isMCQFlashcard(card: Flashcard): card is MCQFlashcard {
  return card.questionType === 'mcq';
}

/**
 * Check if a flashcard is open-ended
 */
export function isOpenEndedFlashcard(card: Flashcard): card is OpenEndedFlashcard {
  return card.questionType === 'open-ended';
}

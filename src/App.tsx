import { useState, useEffect, useCallback, useReducer } from 'react';
import { Brain, ChevronLeft, ExternalLink, History, Home, RotateCcw, Trash2 } from 'lucide-react';

// Import types
import type { 
  Paper, 
  PaperStats, 
  Flashcard, 
  Session, 
  AppState, 
  AppAction,
  SortOption,
  CachedFlashcards,
  CachedAbstract
} from '@shared/types';

// Import constants
import { INITIAL_PAPERS } from './constants';

// Import utilities
import { calculatePriority } from './utils/priority';
import { calculateNextReview } from './utils/spacedRepetition';

// Import services
import { generateFlashcards, evaluateAnswer } from './services/claudeApi';
import { fetchPapers, updatePaperStats, checkHealth, fetchAbstract, isArxivUrl, resetPaperStats } from './services/notionApi';

// Import storage hook
import storage from './hooks/useStorage';

// Import components
import {
  LoadingSpinner,
  ErrorMessage,
  PaperCard,
  PaperDetail,
  PaperFilters,
  FlashcardView,
  OpenEndedView,
  ProgressBar,
  SessionSummary,
  HistoryView
} from './components';

// ==================== STATE REDUCER ====================
const initialState: AppState = {
  screen: 'home',
  papers: INITIAL_PAPERS,
  paperStats: {},
  currentPaper: null,
  flashcards: [],
  currentCardIndex: 0,
  answers: [],
  sessionHistory: [],
  isLoading: false,
  loadingMessage: '',
  error: null,
  isAnswered: false,
  isEvaluating: false
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload.loading, loadingMessage: action.payload.message || '', error: null };
    case 'SET_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'SET_EVALUATING':
      return { ...state, isEvaluating: action.payload };
    case 'SET_PAPERS':
      return { ...state, papers: action.payload, isLoading: false };
    case 'SET_PAPER_STATS':
      return { ...state, paperStats: action.payload };
    case 'SET_SESSION_HISTORY':
      return { ...state, sessionHistory: action.payload };
    case 'SELECT_PAPER':
      return { ...state, currentPaper: action.payload, screen: 'loading' };
    case 'SET_FLASHCARDS':
      return { ...state, flashcards: action.payload, currentCardIndex: 0, answers: [], screen: 'review', isLoading: false, isAnswered: false, isEvaluating: false };
    case 'MARK_ANSWERED':
      return { ...state, isAnswered: true, isEvaluating: false };
    case 'SAVE_ANSWER': {
      const newAnswers = [...state.answers];
      newAnswers[state.currentCardIndex] = action.payload;
      return { ...state, answers: newAnswers };
    }
    case 'NEXT_CARD':
      if (state.currentCardIndex >= state.flashcards.length - 1) {
        return { ...state, screen: 'summary', isEvaluating: false };
      }
      return {
        ...state,
        currentCardIndex: state.currentCardIndex + 1,
        isAnswered: false,
        isEvaluating: false
      };
    case 'PREV_CARD':
      return {
        ...state,
        currentCardIndex: Math.max(0, state.currentCardIndex - 1),
        isAnswered: state.answers[Math.max(0, state.currentCardIndex - 1)] !== undefined,
        isEvaluating: false
      };
    case 'SET_SCREEN':
      return { ...state, screen: action.payload, isAnswered: false, isEvaluating: false };
    case 'RESET_SESSION':
      return { ...state, currentPaper: null, flashcards: [], currentCardIndex: 0, answers: [], screen: 'home', isAnswered: false, isEvaluating: false };
    default:
      return state;
  }
}

// ==================== MAIN APP ====================
export default function FlashcardApp() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [userText, setUserText] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetNotionToo, setResetNotionToo] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [cachedPapers, setCachedPapers] = useState<Set<string>>(new Set());
  
  // Filter/Search/Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [showDueOnly, setShowDueOnly] = useState(false);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      // Load paper stats from local storage
      let localStats = await storage.get<Record<string, PaperStats>>('paper-stats') || {};
      dispatch({ type: 'SET_PAPER_STATS', payload: localStats });

      // Load session history from local storage
      const sessionKeys = await storage.list('sessions:');
      const sessions: Session[] = [];
      for (const key of sessionKeys.slice(-20)) {
        const session = await storage.get<Session>(key);
        if (session) sessions.push(session);
      }
      dispatch({ type: 'SET_SESSION_HISTORY', payload: sessions });
      
      // Load cached flashcard paper IDs
      const flashcardKeys = await storage.list('flashcards:');
      const cachedIds = flashcardKeys.map(key => key.replace('flashcards:', ''));
      setCachedPapers(new Set(cachedIds));

      // Try to fetch papers from Notion via backend
      try {
        const isBackendHealthy = await checkHealth();
        if (isBackendHealthy) {
          dispatch({ type: 'SET_LOADING', payload: { loading: true, message: 'Loading papers from Notion...' } });
          const { papers } = await fetchPapers();
          if (papers && papers.length > 0) {
            dispatch({ type: 'SET_PAPERS', payload: papers });
            console.log(`Loaded ${papers.length} papers from Notion`);
            
            // Merge Notion stats with local stats
            // For each paper with notionStats, initialize or update local stats
            let statsUpdated = false;
            const mergedStats = { ...localStats };
            
            for (const paper of papers) {
              if (paper.notionStats) {
                const notionStats = paper.notionStats;
                const existingStats = mergedStats[paper.id];
                
                // If no local stats exist, initialize from Notion
                if (!existingStats) {
                  if (notionStats.lastReviewed || notionStats.masteryScore || notionStats.reviewCount) {
                    mergedStats[paper.id] = {
                      lastReviewed: notionStats.lastReviewed,
                      masteryScore: notionStats.masteryScore ?? 0,
                      reviewCount: notionStats.reviewCount ?? 0,
                      easeFactor: 2.5, // Default SM-2 ease factor
                      interval: 1 // Default interval
                    };
                    statsUpdated = true;
                    console.log(`Initialized stats from Notion for: ${paper.title}`);
                  }
                } else {
                  // If local stats exist, check if Notion has more recent data
                  const localDate = existingStats.lastReviewed ? new Date(existingStats.lastReviewed).getTime() : 0;
                  const notionDate = notionStats.lastReviewed ? new Date(notionStats.lastReviewed).getTime() : 0;
                  
                  if (notionDate > localDate) {
                    // Notion has more recent data, update local stats
                    mergedStats[paper.id] = {
                      ...existingStats,
                      lastReviewed: notionStats.lastReviewed,
                      masteryScore: notionStats.masteryScore ?? existingStats.masteryScore,
                      reviewCount: notionStats.reviewCount ?? existingStats.reviewCount
                    };
                    statsUpdated = true;
                    console.log(`Updated stats from Notion for: ${paper.title}`);
                  }
                }
              }
            }
            
            // If stats were updated, save and dispatch
            if (statsUpdated) {
              await storage.set('paper-stats', mergedStats);
              dispatch({ type: 'SET_PAPER_STATS', payload: mergedStats });
              console.log('Merged Notion stats with local storage');
            }
          }
        } else {
          console.log('Backend not available, using fallback papers');
        }
      } catch (error) {
        const err = error as Error;
        console.warn('Failed to fetch papers from Notion, using fallback:', err.message);
        dispatch({ type: 'SET_LOADING', payload: { loading: false, message: '' } });
      }
    }
    loadData();
  }, []);

  // Reset selected answer/text when card changes
  useEffect(() => {
    const existingAnswer = state.answers[state.currentCardIndex];
    setSelectedAnswer(existingAnswer?.selectedIndex ?? null);
    setUserText(existingAnswer?.userText ?? '');
  }, [state.currentCardIndex, state.answers]);

  const startReview = useCallback(async (paper: Paper, forceRegenerate = false) => {
    dispatch({ type: 'SELECT_PAPER', payload: paper });

    // Check for cached flashcards
    const cacheKey = `flashcards:${paper.id}`;
    const abstractCacheKey = `abstract:${paper.id}`;
    const cached = !forceRegenerate ? await storage.get<CachedFlashcards>(cacheKey) : null;

    if (cached && cached.flashcards?.length > 0) {
      dispatch({ type: 'SET_FLASHCARDS', payload: cached.flashcards });
      setSelectedAnswer(null);
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: { loading: true, message: 'Generating quiz questions...' } });
    try {
      // Fetch abstract if paper has an arXiv URL
      let abstract: string | null = null;
      if (isArxivUrl(paper.url)) {
        dispatch({ type: 'SET_LOADING', payload: { loading: true, message: 'Fetching paper abstract...' } });

        // Check cache first
        const cachedAbstract = await storage.get<CachedAbstract>(abstractCacheKey);
        if (cachedAbstract?.abstract) {
          abstract = cachedAbstract.abstract;
          console.log('Using cached abstract for:', paper.title);
        } else {
          // Fetch from arXiv via backend
          const abstractData = await fetchAbstract(paper.id);
          if (abstractData?.abstract) {
            abstract = abstractData.abstract;
            // Cache the abstract
            await storage.set<CachedAbstract>(abstractCacheKey, {
              abstract: abstractData.abstract,
              arxivId: abstractData.arxivId,
              arxivTitle: abstractData.arxivTitle,
              fetchedAt: new Date().toISOString()
            });
            console.log('Fetched and cached abstract for:', paper.title);
          }
        }
      }

      dispatch({ type: 'SET_LOADING', payload: { loading: true, message: 'Generating quiz questions...' } });

      // Pass other papers for comparison questions, include abstract
      const cards = await generateFlashcards(paper, state.papers, undefined, abstract);
      dispatch({ type: 'SET_FLASHCARDS', payload: cards });

      // Cache the flashcards (including abstract indicator)
      await storage.set<CachedFlashcards>(cacheKey, {
        flashcards: cards,
        generatedAt: new Date().toISOString(),
        paperTitle: paper.title,
        hadAbstract: !!abstract
      });

      // Update cached papers set
      setCachedPapers(prev => new Set([...prev, paper.id]));

      setSelectedAnswer(null);
    } catch (error) {
      const err = error as Error;
      dispatch({ type: 'SET_ERROR', payload: err.message });
      dispatch({ type: 'SET_SCREEN', payload: 'home' });
    }
  }, [state.papers]);

  const handleSubmitAnswer = useCallback(async () => {
    const card = state.flashcards[state.currentCardIndex];

    if (!state.isAnswered) {
      // First click: check the answer
      if (card.questionType === 'open-ended') {
        // For open-ended questions, call AI evaluation
        dispatch({ type: 'SET_EVALUATING', payload: true });

        try {
          const evaluation = await evaluateAnswer({
            question: card.question,
            expectedPoints: card.expectedPoints || [],
            userAnswer: userText,
            paperContext: state.currentPaper?.content?.slice(0, 2000)
          });

          const isCorrect = evaluation.score >= 70;
          dispatch({ type: 'SAVE_ANSWER', payload: {
            userText,
            isCorrect,
            score: evaluation.score,
            feedback: {
              ...evaluation.feedback,
              score: evaluation.score
            }
          }});
          dispatch({ type: 'MARK_ANSWERED' });
        } catch (error) {
          console.error('Evaluation failed:', error);
          // Fallback: save answer without AI feedback
          dispatch({ type: 'SAVE_ANSWER', payload: {
            userText,
            isCorrect: true,
            score: 70
          }});
          dispatch({ type: 'MARK_ANSWERED' });
        }
      } else {
        // MCQ logic
        const mcqCard = card as Extract<Flashcard, { questionType: 'mcq' }>;
        const isCorrect = selectedAnswer === mcqCard.correctIndex;
        dispatch({ type: 'SAVE_ANSWER', payload: {
          selectedIndex: selectedAnswer ?? undefined,
          isCorrect,
          score: isCorrect ? 100 : 0
        }});
        dispatch({ type: 'MARK_ANSWERED' });
      }
    } else {
      // Second click: go to next card
      dispatch({ type: 'NEXT_CARD' });
      setSelectedAnswer(null);
      setUserText('');
    }
  }, [state.flashcards, state.currentCardIndex, state.isAnswered, selectedAnswer, userText, state.currentPaper]);

  const saveSession = useCallback(async () => {
    const sessionId = `session-${Date.now()}`;
    const correctCount = state.answers.filter(a => a?.isCorrect).length;
    // Calculate average score (0-100 scale)
    const totalScore = state.answers.reduce((sum, a) => sum + (a?.score || 0), 0);
    const overallScore = Math.round(totalScore / state.answers.length);
    
    const session: Session = {
      id: sessionId,
      paperId: state.currentPaper?.id,
      paperTitle: state.currentPaper?.title,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      flashcards: state.flashcards.map((card, i) => ({
        question: card.question,
        questionType: card.questionType || 'mcq',
        correctAnswer: card.questionType === 'open-ended' 
          ? card.explanation 
          : (card as Extract<Flashcard, { questionType: 'mcq' }>).options?.[(card as Extract<Flashcard, { questionType: 'mcq' }>).correctIndex] || '',
        userAnswer: card.questionType === 'open-ended'
          ? state.answers[i]?.userText
          : (card as Extract<Flashcard, { questionType: 'mcq' }>).options?.[state.answers[i]?.selectedIndex ?? -1],
        isCorrect: state.answers[i]?.isCorrect || false,
        score: state.answers[i]?.score || 0,
        feedback: state.answers[i]?.feedback,
        concept: card.concept
      })),
      overallScore,
      correctCount,
      totalCount: state.flashcards.length
    };

    await storage.set(`sessions:${sessionId}`, session);

    // Update paper stats
    const stats = { ...state.paperStats };
    const paperId = state.currentPaper?.id;
    if (paperId) {
      const currentStats = stats[paperId] || { reviewCount: 0, masteryScore: 0, easeFactor: 2.5, interval: 0 };
      
      // Convert score to SM-2 quality (0-5)
      const quality = Math.round((overallScore / 100) * 5);
      const sr = calculateNextReview(quality, currentStats.interval, currentStats.easeFactor);
      
      const newMasteryScore = (currentStats.masteryScore * 0.7) + (overallScore * 0.3);
      const newReviewCount = currentStats.reviewCount + 1;
      const lastReviewed = new Date().toISOString();

      stats[paperId] = {
        ...currentStats,
        lastReviewed,
        reviewCount: newReviewCount,
        masteryScore: newMasteryScore,
        easeFactor: sr.easeFactor,
        interval: sr.interval,
        dueDate: new Date(Date.now() + sr.interval * 24 * 60 * 60 * 1000).toISOString()
      };
      
      await storage.set('paper-stats', stats);
      dispatch({ type: 'SET_PAPER_STATS', payload: stats });

      // Try to sync stats to Notion (non-blocking)
      try {
        await updatePaperStats(paperId, {
          lastReviewed,
          masteryScore: Math.round(newMasteryScore),
          reviewCount: newReviewCount
        });
        console.log('Synced stats to Notion for paper:', paperId);
      } catch (error) {
        const err = error as Error;
        console.warn('Failed to sync stats to Notion:', err.message);
      }
    }

    const newHistory = [...state.sessionHistory, session];
    dispatch({ type: 'SET_SESSION_HISTORY', payload: newHistory });
  }, [state.currentPaper, state.flashcards, state.answers, state.paperStats, state.sessionHistory]);

  // Save session when reaching summary
  useEffect(() => {
    if (state.screen === 'summary' && state.answers.length > 0) {
      saveSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen]);

  // Extract unique tags for filters
  const allTags = [...new Set(state.papers.flatMap(p => p.tags || []))];

  // Filter and sort papers
  const filteredPapers = state.papers.filter(paper => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = paper.title?.toLowerCase().includes(query);
      const matchesAuthors = paper.authors?.toLowerCase().includes(query);
      const matchesTags = paper.tags?.some(t => t.toLowerCase().includes(query));
      if (!matchesTitle && !matchesAuthors && !matchesTags) return false;
    }
    
    // Tags filter
    if (selectedTags.length > 0) {
      const hasMatchingTag = selectedTags.some(tag => paper.tags?.includes(tag));
      if (!hasMatchingTag) return false;
    }
    
    // Needs review filter: show New, Due, Soon, or Weak papers (hide Good papers)
    if (showDueOnly) {
      const stats = state.paperStats[paper.id];
      const isNew = !stats?.lastReviewed;
      const mastery = stats?.masteryScore || 0;
      const priority = calculatePriority(paper, stats);
      // Show if: never reviewed (New) OR low mastery (Weak) OR priority >= 40 (Soon/Due)
      const needsReview = isNew || mastery < 50 || priority >= 40;
      if (!needsReview) return false;
    }
    
    return true;
  });

  // Sort papers
  const sortedPapers = [...filteredPapers].sort((a, b) => {
    const statsA = state.paperStats[a.id];
    const statsB = state.paperStats[b.id];
    
    switch (sortBy) {
      case 'priority':
        return calculatePriority(b, statsB) - calculatePriority(a, statsA);
      case 'new-first': {
        // Papers never reviewed come first, then by title
        const aIsNew = !statsA?.lastReviewed;
        const bIsNew = !statsB?.lastReviewed;
        if (aIsNew && !bIsNew) return -1;
        if (!aIsNew && bIsNew) return 1;
        return (a.title || '').localeCompare(b.title || '');
      }
      case 'mastery-asc':
        return (statsA?.masteryScore || 0) - (statsB?.masteryScore || 0);
      case 'mastery-desc':
        return (statsB?.masteryScore || 0) - (statsA?.masteryScore || 0);
      case 'recent': {
        const dateA = statsA?.lastReviewed ? new Date(statsA.lastReviewed).getTime() : 0;
        const dateB = statsB?.lastReviewed ? new Date(statsB.lastReviewed).getTime() : 0;
        return dateB - dateA;
      }
      case 'alphabetical':
        return (a.title || '').localeCompare(b.title || '');
      default:
        return 0;
    }
  });

  const handleResetProgress = async () => {
    setIsResetting(true);
    
    try {
      // Clear local storage
      await storage.remove('paper-stats');
      const sessionKeys = await storage.list('sessions:');
      for (const key of sessionKeys) {
        await storage.remove(key);
      }
      // Also clear cached flashcards
      const flashcardKeys = await storage.list('flashcards:');
      for (const key of flashcardKeys) {
        await storage.remove(key);
      }
      
      // Optionally reset Notion stats
      if (resetNotionToo) {
        console.log('Resetting stats in Notion...');
        let resetCount = 0;
        for (const paper of state.papers) {
          const success = await resetPaperStats(paper.id);
          if (success) resetCount++;
        }
        console.log(`Reset stats for ${resetCount} papers in Notion`);
      }
      
      dispatch({ type: 'SET_PAPER_STATS', payload: {} });
      dispatch({ type: 'SET_SESSION_HISTORY', payload: [] });
      setCachedPapers(new Set());
    } catch (error) {
      console.error('Error during reset:', error);
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
      setResetNotionToo(true); // Reset checkbox for next time
    }
  };

  // Get current card for rendering
  const currentCard = state.flashcards[state.currentCardIndex];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-500" />
            <span className="font-semibold text-slate-800">Paper Quiz</span>
          </div>
          <nav className="flex items-center gap-2">
            <button
              onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'home' })}
              className={`p-2 rounded-lg ${state.screen === 'home' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
              title="Home"
            >
              <Home className="w-5 h-5" />
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'history' })}
              className={`p-2 rounded-lg ${state.screen === 'history' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
              title="History"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
              title="Reset Progress"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {state.error && (
          <div className="mb-6">
            <ErrorMessage message={state.error} />
          </div>
        )}

        {/* Home Screen */}
        {state.screen === 'home' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Your Papers</h1>
                <p className="text-slate-500">
                  {sortedPapers.length === state.papers.length 
                    ? `${state.papers.length} papers available` 
                    : `${sortedPapers.length} of ${state.papers.length} papers`}
                </p>
              </div>
              <a
                href="https://www.notion.so/25de9298d1ff8081aff2dcbc10184d7a"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <ExternalLink className="w-4 h-4" />
                Open Notion
              </a>
            </div>

            {state.isLoading && <LoadingSpinner message={state.loadingMessage} />}

            {!state.isLoading && (
              <>
                <PaperFilters
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  selectedTags={selectedTags}
                  setSelectedTags={setSelectedTags}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  showDueOnly={showDueOnly}
                  setShowDueOnly={setShowDueOnly}
                  allTags={allTags}
                />

                {sortedPapers.length > 0 ? (
                  <div className="grid gap-3 mb-6">
                    {sortedPapers.map(paper => (
                      <PaperCard
                        key={paper.id}
                        paper={paper}
                        stats={state.paperStats[paper.id]}
                        isSelected={selectedPaper?.id === paper.id}
                        onSelect={setSelectedPaper}
                        hasCachedQuestions={cachedPapers.has(paper.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <p className="text-lg mb-2">No papers match your filters</p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedTags([]);
                        setShowDueOnly(false);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 text-sm"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Paper Detail Panel */}
            {selectedPaper && (
              <PaperDetail
                paper={selectedPaper}
                stats={state.paperStats[selectedPaper.id]}
                sessions={state.sessionHistory}
                relatedPapers={state.papers.filter(p => 
                  p.id !== selectedPaper.id && 
                  p.tags?.some(t => selectedPaper.tags?.includes(t))
                )}
                onClose={() => setSelectedPaper(null)}
                onStartQuiz={() => {
                  startReview(selectedPaper);
                  setSelectedPaper(null);
                }}
              />
            )}
          </div>
        )}

        {/* Loading Screen */}
        {state.screen === 'loading' && (
          <LoadingSpinner message={state.loadingMessage} />
        )}

        {/* Review Screen */}
        {state.screen === 'review' && state.flashcards.length > 0 && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-medium text-slate-800">{state.currentPaper?.title}</h2>
              <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                {state.currentPaper?.tags && state.currentPaper.tags.length > 0 && (
                  <span>{state.currentPaper.tags.slice(0, 3).join(', ')}</span>
                )}
                {state.currentPaper?.url && (
                  <>
                    <span>•</span>
                    <a 
                      href={state.currentPaper.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Paper
                    </a>
                  </>
                )}
              </div>
            </div>

            <ProgressBar current={state.currentCardIndex} total={state.flashcards.length} />

            {state.isLoading ? (
              <LoadingSpinner message={state.loadingMessage} />
            ) : (
              // Render appropriate component based on question type
              currentCard?.questionType === 'open-ended' ? (
                <OpenEndedView
                  card={currentCard}
                  userText={userText}
                  setUserText={setUserText}
                  isAnswered={state.isAnswered}
                  isEvaluating={state.isEvaluating}
                  feedback={state.answers[state.currentCardIndex]?.feedback}
                  onSubmit={handleSubmitAnswer}
                />
              ) : currentCard && (
                <FlashcardView
                  card={currentCard as Extract<Flashcard, { questionType: 'mcq' }>}
                  selectedAnswer={selectedAnswer}
                  setSelectedAnswer={setSelectedAnswer}
                  isAnswered={state.isAnswered}
                  onSubmit={handleSubmitAnswer}
                />
              )
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() => dispatch({ type: 'PREV_CARD' })}
                disabled={state.currentCardIndex === 0}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-700 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => state.currentPaper && startReview(state.currentPaper, true)}
                  className="flex items-center gap-1 text-slate-500 hover:text-indigo-600"
                  title="Generate new questions"
                >
                  <RotateCcw className="w-4 h-4" />
                  New Questions
                </button>
                <button
                  onClick={() => dispatch({ type: 'RESET_SESSION' })}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Exit Quiz
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary Screen */}
        {state.screen === 'summary' && (
          <SessionSummary
            paper={state.currentPaper}
            answers={state.answers}
            flashcards={state.flashcards}
            onReviewAgain={() => state.currentPaper && startReview(state.currentPaper)}
            onNewPaper={() => dispatch({ type: 'RESET_SESSION' })}
            onEnd={() => dispatch({ type: 'RESET_SESSION' })}
          />
        )}

        {/* History Screen */}
        {state.screen === 'history' && (
          <HistoryView
            sessions={state.sessionHistory}
            onBack={() => dispatch({ type: 'SET_SCREEN', payload: 'home' })}
          />
        )}
      </main>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">Reset All Progress?</h3>
            </div>
            <div className="text-slate-600 mb-4">
              <p className="mb-3">This will permanently delete:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All quiz history and mastery scores</li>
                <li>Cached questions</li>
                {resetNotionToo && <li>Stats synced to your Notion database</li>}
              </ul>
              <p className="mt-3 text-sm">Your papers will remain, but all review progress will be lost.</p>
            </div>
            
            {/* Checkbox for Notion sync */}
            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg mb-4 cursor-pointer hover:bg-slate-100">
              <input
                type="checkbox"
                checked={resetNotionToo}
                onChange={(e) => setResetNotionToo(e.target.checked)}
                className="w-4 h-4 text-red-500 rounded border-slate-300 focus:ring-red-500"
              />
              <span className="text-sm text-slate-700">Also clear stats from Notion</span>
            </label>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetNotionToo(true);
                }}
                disabled={isResetting}
                className="flex-1 py-2 px-4 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetProgress}
                disabled={isResetting}
                className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isResetting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

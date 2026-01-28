import { useState } from 'react';
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Paper, Answer, Flashcard, QuestionConcept } from '@shared/types';

interface SessionSummaryProps {
  paper: Paper | null;
  answers: Answer[];
  flashcards: Flashcard[];
  onReviewAgain: () => void;
  onNewPaper: () => void;
  onEnd: () => void;
}

interface ConceptScore {
  totalScore: number;
  count: number;
}

const conceptLabels: Record<QuestionConcept | 'general', string> = {
  main_contribution: 'Key Contributions',
  technical: 'Technical Insights',
  comparison: 'Comparisons',
  practical: 'Practical Implications',
  general: 'General'
};

export default function SessionSummary({ 
  paper, 
  answers, 
  flashcards, 
  onReviewAgain, 
  onNewPaper, 
  onEnd 
}: SessionSummaryProps) {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  // Calculate average score (0-100 scale)
  const totalScore = answers.reduce((sum, a) => sum + (a?.score || 0), 0);
  const avgScore = Math.round(totalScore / answers.length);
  const correctCount = answers.filter(a => a?.isCorrect).length;
  const totalCount = answers.length;

  // Toggle card expansion
  const toggleCard = (index: number) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCards(newExpanded);
  };
  
  // Group by concept with actual scores
  const conceptScores: Record<string, ConceptScore> = {};
  flashcards.forEach((card, i) => {
    const concept = card.concept || 'general';
    if (!conceptScores[concept]) {
      conceptScores[concept] = { totalScore: 0, count: 0 };
    }
    conceptScores[concept].totalScore += (answers[i]?.score || 0);
    conceptScores[concept].count += 1;
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800 mb-1">Quiz Complete!</h2>
          <p className="text-slate-600 line-clamp-1">{paper?.title}</p>
        </div>

        {/* Score Stats */}
        <div className="p-6 grid grid-cols-3 gap-4 border-b border-slate-200">
          <div className="text-center">
            <div className={`text-3xl font-bold ${
              avgScore >= 80 ? 'text-green-600' : avgScore >= 60 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {avgScore}%
            </div>
            <div className="text-sm text-slate-500">Avg Score</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{correctCount}</div>
            <div className="text-sm text-slate-500">Passed</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-slate-800">{totalCount}</div>
            <div className="text-sm text-slate-500">Questions</div>
          </div>
        </div>

        {/* Concept Breakdown */}
        <div className="p-6 border-b border-slate-200">
          <h3 className="font-medium text-slate-800 mb-4">By Category</h3>
          <div className="space-y-3">
            {Object.entries(conceptScores).map(([concept, data]) => {
              const avgPct = Math.round(data.totalScore / data.count);
              return (
                <div key={concept}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{conceptLabels[concept as QuestionConcept | 'general'] || concept}</span>
                    <span className={avgPct >= 70 ? 'text-green-600' : avgPct >= 50 ? 'text-amber-600' : 'text-red-600'}>
                      {avgPct}% ({data.count} {data.count === 1 ? 'question' : 'questions'})
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        avgPct >= 70 ? 'bg-green-500' : avgPct >= 50 ? 'bg-amber-500' : 'bg-red-400'
                      }`}
                      style={{ width: `${avgPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Questions Review - Expandable */}
        <div className="p-6 border-b border-slate-200">
          <h3 className="font-medium text-slate-800 mb-3">Question Details</h3>
          <div className="space-y-2">
            {flashcards.map((card, i) => {
              const answer = answers[i];
              const isExpanded = expandedCards.has(i);
              const score = answer?.score || 0;
              const scoreColor = score >= 80 ? 'text-green-600 bg-green-50' : score >= 60 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
              const isMCQ = card.questionType !== 'open-ended';

              return (
                <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Header - always visible */}
                  <button
                    onClick={() => toggleCard(i)}
                    className="w-full p-3 flex items-center justify-between hover:bg-slate-50 text-left"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${scoreColor}`}>
                        {score}%
                      </span>
                      <span className="text-sm text-slate-700 truncate">{card.question}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-slate-100">
                      {/* MCQ Details */}
                      {isMCQ && card.questionType === 'mcq' && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                            <span className="text-green-700">{card.options?.[card.correctIndex]}</span>
                          </div>
                          {answer?.selectedIndex !== undefined && answer?.selectedIndex !== card.correctIndex && (
                            <div className="flex items-start gap-2 text-sm">
                              <X className="w-4 h-4 mt-0.5 text-red-500 flex-shrink-0" />
                              <span className="text-red-600 line-through">{card.options?.[answer.selectedIndex]}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Open-ended Details */}
                      {card.questionType === 'open-ended' && (
                        <div className="mt-2 space-y-3">
                          {/* User's answer */}
                          {answer?.userText && (
                            <div className="bg-slate-50 p-2 rounded text-sm">
                              <p className="text-xs text-slate-500 mb-1">Your answer:</p>
                              <p className="text-slate-700">{answer.userText}</p>
                            </div>
                          )}

                          {/* AI Feedback */}
                          {answer?.feedback && (
                            <div className="space-y-2">
                              {answer.feedback.correct && answer.feedback.correct.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-green-700 mb-1">What you got right:</p>
                                  <ul className="text-sm text-green-600 space-y-0.5">
                                    {answer.feedback.correct.map((point, j) => (
                                      <li key={j} className="flex items-start gap-1">
                                        <span className="text-green-500">+</span>
                                        <span>{point}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {answer.feedback.missing && answer.feedback.missing.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-amber-700 mb-1">What to review:</p>
                                  <ul className="text-sm text-amber-600 space-y-0.5">
                                    {answer.feedback.missing.map((point, j) => (
                                      <li key={j} className="flex items-start gap-1">
                                        <span className="text-amber-500">-</span>
                                        <span>{point}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {answer.feedback.suggestion && (
                                <p className="text-xs text-slate-600 italic">{answer.feedback.suggestion}</p>
                              )}
                            </div>
                          )}

                          {/* Model answer */}
                          <div className="bg-slate-100 p-2 rounded text-sm">
                            <p className="text-xs text-slate-500 mb-1">Model answer:</p>
                            <p className="text-slate-700">{card.explanation}</p>
                          </div>
                        </div>
                      )}

                      {/* MCQ Explanation */}
                      {isMCQ && card.explanation && (
                        <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-2 rounded">
                          {card.explanation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Success message */}
        {avgScore >= 90 && (
          <div className="p-6 border-b border-slate-200 bg-green-50">
            <p className="text-green-800 font-medium text-center">
              Excellent work! You&apos;ve demonstrated strong understanding of this paper.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="p-6 flex gap-3">
          <button
            onClick={onReviewAgain}
            className="flex-1 py-2 px-4 border border-indigo-500 text-indigo-600 rounded-lg hover:bg-indigo-50"
          >
            Try Again
          </button>
          <button
            onClick={onNewPaper}
            className="flex-1 py-2 px-4 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
          >
            New Paper
          </button>
          <button
            onClick={onEnd}
            className="py-2 px-4 text-slate-600 hover:text-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

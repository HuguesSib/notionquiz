import { useState, useEffect } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function OpenEndedView({
  card,
  userText,
  setUserText,
  isAnswered,
  isEvaluating,
  feedback,
  onSubmit
}) {
  const [localText, setLocalText] = useState(userText || '');

  useEffect(() => {
    setLocalText(userText || '');
  }, [userText, card]);

  const handleTextChange = (e) => {
    if (isAnswered) return;
    const text = e.target.value;
    setLocalText(text);
    setUserText(text);
  };

  const handleSubmit = () => {
    if (!localText.trim() || isEvaluating) return;
    onSubmit();
  };

  const difficultyLabels = {
    understand: { label: 'Explain', color: 'bg-blue-100 text-blue-700' },
    apply: { label: 'Apply', color: 'bg-green-100 text-green-700' },
    analyze: { label: 'Analyze', color: 'bg-purple-100 text-purple-700' },
    evaluate: { label: 'Evaluate', color: 'bg-amber-100 text-amber-700' }
  };

  const conceptLabels = {
    main_contribution: 'Key Contribution',
    technical: 'Technical Insight',
    comparison: 'Comparison',
    practical: 'Practical'
  };

  const difficultyInfo = difficultyLabels[card.difficulty] || difficultyLabels.understand;

  // Calculate score color
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6">
        {/* Tags */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${difficultyInfo.color}`}>
            {difficultyInfo.label}
          </span>
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
            {conceptLabels[card.concept] || card.concept}
          </span>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
            Open-ended
          </span>
        </div>

        {/* Question */}
        <p className="text-lg text-slate-800 leading-relaxed mb-6">{card.question}</p>

        {/* Answer textarea */}
        <div className="mb-4">
          <textarea
            value={localText}
            onChange={handleTextChange}
            disabled={isAnswered}
            placeholder="Type your answer here... (2-4 sentences recommended)"
            className={`w-full p-4 border-2 rounded-lg resize-none transition-colors min-h-[150px] ${
              isAnswered
                ? 'bg-slate-50 border-slate-200 text-slate-600'
                : 'border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
            }`}
            rows={5}
          />
          {!isAnswered && (
            <p className="text-xs text-slate-500 mt-1">
              {localText.length > 0 ? `${localText.split(/\s+/).filter(Boolean).length} words` : 'Be specific and mention key concepts'}
            </p>
          )}
        </div>

        {/* Feedback after evaluation */}
        {isAnswered && feedback && (
          <div className="space-y-4">
            {/* Score display */}
            <div className={`p-4 rounded-lg ${feedback.score >= 70 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-2xl font-bold ${getScoreColor(feedback.score)}`}>
                  {feedback.score}%
                </span>
                <span className={`text-sm font-medium ${feedback.score >= 70 ? 'text-green-700' : 'text-amber-700'}`}>
                  {feedback.score >= 80 ? 'Excellent!' : feedback.score >= 70 ? 'Good!' : feedback.score >= 50 ? 'Needs improvement' : 'Review this topic'}
                </span>
              </div>

              {/* What was correct */}
              {feedback.correct?.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-green-700 mb-1">What you got right:</p>
                  <ul className="text-sm text-green-600 space-y-1">
                    {feedback.correct.map((point, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">+</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What was missing */}
              {feedback.missing?.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-amber-700 mb-1">What to add:</p>
                  <ul className="text-sm text-amber-600 space-y-1">
                    {feedback.missing.map((point, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">-</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggestion */}
              {feedback.suggestion && (
                <p className="text-sm text-slate-600 italic border-t border-slate-200 pt-2 mt-2">
                  {feedback.suggestion}
                </p>
              )}
            </div>

            {/* Model answer */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm font-medium text-slate-700 mb-2">Model answer:</p>
              <p className="text-sm text-slate-600">{card.explanation}</p>
            </div>
          </div>
        )}

        {/* Fallback: show explanation if no feedback (AI evaluation not available) */}
        {isAnswered && !feedback && card.explanation && (
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-sm font-medium text-slate-700 mb-2">Model answer:</p>
            <p className="text-sm text-slate-600">{card.explanation}</p>
            {card.expectedPoints?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-sm font-medium text-slate-700 mb-1">Key points to cover:</p>
                <ul className="text-sm text-slate-600 space-y-1">
                  {card.expectedPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-slate-400">-</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
        {!isAnswered ? (
          <button
            onClick={handleSubmit}
            disabled={!localText.trim() || isEvaluating}
            className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isEvaluating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Evaluating...
              </>
            ) : (
              <>
                Check Answer
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onSubmit}
            className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors flex items-center gap-2"
          >
            Next Question
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

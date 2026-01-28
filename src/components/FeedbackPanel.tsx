import { Zap } from 'lucide-react';
import { RATING_MAP } from '../constants';
import type { FeedbackObject, RatingKey } from '@shared/types';

interface FeedbackPanelProps {
  feedback: FeedbackObject | null | undefined;
  onRate?: (key: RatingKey) => void;
}

export default function FeedbackPanel({ feedback, onRate }: FeedbackPanelProps) {
  if (!feedback) return null;

  const scorePercent = Math.round(feedback.score);
  const scoreColor = scorePercent >= 75 ? 'text-green-600' : scorePercent >= 50 ? 'text-amber-600' : 'text-red-600';

  // Support both naming conventions for feedback points
  const correctPoints = feedback.correct_points || feedback.correct || [];
  const missingPoints = feedback.missing_points || feedback.missing || [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-4">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-slate-800">AI Feedback</h4>
          <span className={`text-2xl font-bold ${scoreColor}`}>{scorePercent}%</span>
        </div>

        {correctPoints.length > 0 && (
          <div className="mb-3">
            <p className="text-sm font-medium text-green-700 mb-1">✓ Correct points:</p>
            <ul className="text-sm text-green-600 pl-4">
              {correctPoints.map((p, i) => <li key={i}>• {p}</li>)}
            </ul>
          </div>
        )}

        {missingPoints.length > 0 && (
          <div className="mb-3">
            <p className="text-sm font-medium text-amber-700 mb-1">△ Missing points:</p>
            <ul className="text-sm text-amber-600 pl-4">
              {missingPoints.map((p, i) => <li key={i}>• {p}</li>)}
            </ul>
          </div>
        )}

        {feedback.misconceptions && feedback.misconceptions.length > 0 && (
          <div className="mb-3">
            <p className="text-sm font-medium text-red-700 mb-1">✗ Misconceptions:</p>
            <ul className="text-sm text-red-600 pl-4">
              {feedback.misconceptions.map((p, i) => <li key={i}>• {p}</li>)}
            </ul>
          </div>
        )}

        {feedback.feedback && <p className="text-slate-700 mt-4">{feedback.feedback}</p>}
        
        {feedback.suggestion && (
          <p className="text-sm text-indigo-600 mt-2">
            <Zap className="w-3 h-3 inline mr-1" />
            {feedback.suggestion}
          </p>
        )}
      </div>

      {onRate && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
          <p className="text-sm text-slate-600 mb-3">How well did you know this?</p>
          <div className="flex gap-2">
            {(Object.entries(RATING_MAP) as [RatingKey, typeof RATING_MAP[RatingKey]][]).map(([key, { label, color }]) => (
              <button
                key={key}
                onClick={() => onRate(key)}
                className={`flex-1 py-2 px-3 rounded-lg text-white text-sm font-medium transition-transform hover:scale-105 ${color}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

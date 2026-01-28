import { useState } from 'react';
import { X, ExternalLink, FileText, Clock, Target, TrendingUp, BookOpen, Tag, Settings2, Minus, Plus } from 'lucide-react';
import type { Paper, PaperStats, Session, QuizConfig } from '@shared/types';

interface PaperDetailProps {
  paper: Paper | null;
  stats?: PaperStats;
  sessions: Session[];
  relatedPapers: Paper[];
  onClose: () => void;
  onStartQuiz: (config: QuizConfig) => void;
}

export default function PaperDetail({ 
  paper, 
  stats, 
  sessions,
  relatedPapers,
  onClose, 
  onStartQuiz 
}: PaperDetailProps) {
  const [numMCQ, setNumMCQ] = useState(1);
  const [numOpenEnded, setNumOpenEnded] = useState(5);
  const [showConfig, setShowConfig] = useState(false);
  
  if (!paper) return null;
  
  const totalQuestions = numMCQ + numOpenEnded;
  const isValidConfig = totalQuestions >= 1 && totalQuestions <= 10;

  const masteryScore = stats?.masteryScore || 0;
  const reviewCount = stats?.reviewCount || 0;
  const daysSinceReview = stats?.lastReviewed 
    ? Math.floor((new Date().getTime() - new Date(stats.lastReviewed).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Get past sessions for this paper
  const paperSessions = sessions.filter(s => s.paperId === paper.id).slice(-5).reverse();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="relative w-full max-w-md bg-white shadow-xl overflow-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-slate-800 line-clamp-2">{paper.title}</h2>
            {paper.authors && (
              <p className="text-sm text-slate-500 mt-1 line-clamp-1">{paper.authors}</p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <Target className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-indigo-700">{Math.round(masteryScore)}%</div>
              <div className="text-xs text-indigo-600">Mastery</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <BookOpen className="w-5 h-5 text-purple-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-purple-700">{reviewCount}</div>
              <div className="text-xs text-purple-600">Reviews</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <Clock className="w-5 h-5 text-amber-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-amber-700">
                {daysSinceReview !== null ? `${daysSinceReview}d` : '--'}
              </div>
              <div className="text-xs text-amber-600">Since Review</div>
            </div>
          </div>

          {/* Tags */}
          {paper.tags && paper.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                <Tag className="w-4 h-4" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-1">
                {paper.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-1 bg-indigo-100 text-indigo-600 rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
              <ExternalLink className="w-4 h-4" />
              Links
            </h3>
            <div className="flex flex-wrap gap-2">
              {paper.url && (
                <a
                  href={paper.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
                >
                  <FileText className="w-4 h-4" />
                  Paper
                </a>
              )}
              {paper.notionUrl && (
                <a
                  href={paper.notionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
                >
                  <ExternalLink className="w-4 h-4" />
                  Notion
                </a>
              )}
            </div>
          </div>

          {/* Past Quiz Results */}
          {paperSessions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Recent Quizzes
              </h3>
              <div className="space-y-2">
                {paperSessions.map((session, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                  >
                    <span className="text-sm text-slate-600">
                      {new Date(session.completedAt).toLocaleDateString()}
                    </span>
                    <span className={`text-sm font-medium ${
                      session.overallScore >= 80 ? 'text-green-600' :
                      session.overallScore >= 60 ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {session.correctCount}/{session.totalCount} ({Math.round(session.overallScore)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Papers */}
          {relatedPapers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Related Papers</h3>
              <div className="space-y-2">
                {relatedPapers.slice(0, 3).map((related, i) => (
                  <div 
                    key={i}
                    className="p-2 bg-slate-50 rounded-lg"
                  >
                    <p className="text-sm text-slate-700 line-clamp-1">{related.title}</p>
                    <p className="text-xs text-slate-500">{related.tags?.slice(0, 2).join(', ') || ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content Preview */}
          {paper.content && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Notes Preview</h3>
              <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 max-h-40 overflow-auto">
                {paper.content.slice(0, 500)}
                {paper.content.length > 500 && '...'}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4">
          {/* Quiz Configuration Toggle */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="w-full flex items-center justify-center gap-2 text-sm text-slate-600 hover:text-slate-800 mb-3"
          >
            <Settings2 className="w-4 h-4" />
            {showConfig ? 'Hide options' : 'Customize quiz'}
          </button>
          
          {/* Quiz Configuration Panel */}
          {showConfig && (
            <div className="bg-slate-50 rounded-lg p-4 mb-3 space-y-4">
              <div className="text-sm font-medium text-slate-700 mb-2">Quiz Configuration</div>
              
              {/* MCQ Count */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-700">Multiple Choice</div>
                  <div className="text-xs text-slate-500">Quick recall questions</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNumMCQ(Math.max(0, numMCQ - 1))}
                    disabled={numMCQ <= 0}
                    className="p-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-medium text-slate-800">{numMCQ}</span>
                  <button
                    onClick={() => setNumMCQ(Math.min(5, numMCQ + 1))}
                    disabled={numMCQ >= 5}
                    className="p-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Open-Ended Count */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-700">Open-Ended</div>
                  <div className="text-xs text-slate-500">Deeper understanding</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNumOpenEnded(Math.max(0, numOpenEnded - 1))}
                    disabled={numOpenEnded <= 0}
                    className="p-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-medium text-slate-800">{numOpenEnded}</span>
                  <button
                    onClick={() => setNumOpenEnded(Math.min(5, numOpenEnded + 1))}
                    disabled={numOpenEnded >= 5}
                    className="p-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Summary */}
              <div className={`text-center text-sm ${isValidConfig ? 'text-slate-600' : 'text-red-500'}`}>
                {isValidConfig 
                  ? `Total: ${totalQuestions} question${totalQuestions !== 1 ? 's' : ''}`
                  : 'Select at least 1 question'}
              </div>
            </div>
          )}
          
          <button
            onClick={() => onStartQuiz({ numMCQ, numOpenEnded })}
            disabled={!isValidConfig}
            className="w-full py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Quiz ({totalQuestions} question{totalQuestions !== 1 ? 's' : ''})
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

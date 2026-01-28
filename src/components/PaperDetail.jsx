import { X, ExternalLink, FileText, Clock, Target, TrendingUp, BookOpen, Tag } from 'lucide-react';

export default function PaperDetail({ 
  paper, 
  stats, 
  sessions,
  relatedPapers,
  onClose, 
  onStartQuiz 
}) {
  if (!paper) return null;

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
          {paper.tags?.length > 0 && (
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
          <button
            onClick={onStartQuiz}
            className="w-full py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600"
          >
            Start Quiz
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

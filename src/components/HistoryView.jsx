import { Calendar, CheckCircle2, History, X } from 'lucide-react';

export default function HistoryView({ sessions, onBack }) {
  const sortedSessions = [...sessions].sort((a, b) => 
    new Date(b.completedAt || b.startedAt) - new Date(a.completedAt || a.startedAt)
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-800">Quiz History</h2>
        <button onClick={onBack} className="text-slate-600 hover:text-slate-800">
          <X className="w-5 h-5" />
        </button>
      </div>

      {sortedSessions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No quiz sessions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedSessions.map((session, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-slate-800 line-clamp-1 flex-1 pr-2">{session.paperTitle}</h3>
                <span className={`px-2 py-0.5 rounded text-sm font-medium flex-shrink-0 ${
                  session.overallScore >= 80 ? 'bg-green-100 text-green-700' :
                  session.overallScore >= 60 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {Math.round(session.overallScore)}%
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(session.completedAt || session.startedAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {session.correctCount !== undefined 
                    ? `${session.correctCount}/${session.totalCount} correct`
                    : `${session.flashcards?.length || 0} questions`
                  }
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { MouseEvent, useMemo } from 'react';
import { CheckCircle, Clock, ExternalLink, FileText, Sparkles } from 'lucide-react';
import { calculatePriority } from '../utils/priority';
import type { Paper, PaperStats } from '@shared/types';

interface MasteryRingProps {
  percentage: number;
  size?: number;
}

interface ColorScheme {
  stroke: string;
  bg: string;
  text: string;
}

interface StatusBadge {
  label: string;
  color: string;
}

// Circular progress ring component
function MasteryRing({ percentage, size = 48 }: MasteryRingProps) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  // Color based on mastery level
  const getColor = (pct: number): ColorScheme => {
    if (pct >= 80) return { stroke: '#22c55e', bg: '#dcfce7', text: '#166534' }; // green
    if (pct >= 60) return { stroke: '#3b82f6', bg: '#dbeafe', text: '#1e40af' }; // blue
    if (pct >= 40) return { stroke: '#f59e0b', bg: '#fef3c7', text: '#92400e' }; // amber
    if (pct > 0) return { stroke: '#ef4444', bg: '#fee2e2', text: '#991b1b' };   // red
    return { stroke: '#94a3b8', bg: '#f1f5f9', text: '#475569' };                // slate
  };
  
  const colors = getColor(percentage);
  
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth="4"
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.stroke}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold" style={{ color: colors.text }}>
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
}

// Get single status badge - considers both urgency and mastery
function getStatusBadge(stats: PaperStats | undefined, priority: number): StatusBadge {
  const mastery = stats?.masteryScore || 0;
  
  // Never reviewed = New
  if (!stats?.lastReviewed) {
    return { label: 'New', color: 'bg-indigo-100 text-indigo-700' };
  }
  // Due for review (high priority based on time)
  if (priority > 60) {
    return { label: 'Due', color: 'bg-red-100 text-red-700' };
  }
  // Low mastery = needs more practice
  if (mastery < 50) {
    return { label: 'Weak', color: 'bg-amber-100 text-amber-700' };
  }
  // Coming up soon (time-based)
  if (priority > 40) {
    return { label: 'Soon', color: 'bg-amber-100 text-amber-700' };
  }
  // Good mastery and not urgent
  return { label: 'Good', color: 'bg-green-100 text-green-700' };
}

interface PaperCardProps {
  paper: Paper;
  stats?: PaperStats;
  onSelect: (paper: Paper) => void;
  isSelected: boolean;
  hasCachedQuestions: boolean;
}

export default function PaperCard({ paper, stats, onSelect, isSelected, hasCachedQuestions }: PaperCardProps) {
  const priority = calculatePriority(paper, stats);
  const masteryScore = stats?.masteryScore || 0;
  const statusBadge = getStatusBadge(stats, priority);
  // Calculate days since review - Date.now() is intentional here as we want
  // to show current relative time, not a cached value
  const daysSinceReview = useMemo(() => {
    if (!stats?.lastReviewed) return null;
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    return Math.floor((now - new Date(stats.lastReviewed).getTime()) / (1000 * 60 * 60 * 24));
  }, [stats?.lastReviewed]);

  const handleLinkClick = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      onClick={() => onSelect(paper)}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected 
          ? 'border-indigo-500 bg-indigo-50' 
          : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
      }`}
    >
      <div className="flex gap-4">
        {/* Mastery Ring */}
        <MasteryRing percentage={masteryScore} size={48} />
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-medium text-slate-800 line-clamp-2 flex-1 pr-2">{paper.title}</h3>
            {/* Single Status Badge */}
            <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>
          
          {paper.tags && paper.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {paper.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded text-xs">
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {daysSinceReview !== null ? (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {daysSinceReview === 0 ? 'Today' : `${daysSinceReview}d ago`}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-indigo-600">
                <Sparkles className="w-3 h-3" />
                Never reviewed
              </span>
            )}
            {stats?.reviewCount && stats.reviewCount > 0 && (
              <span className="text-slate-400">
                {stats.reviewCount} review{stats.reviewCount !== 1 ? 's' : ''}
              </span>
            )}
            {hasCachedQuestions && (
              <span className="flex items-center gap-1 text-green-600" title="Questions ready">
                <CheckCircle className="w-3 h-3" />
                Quiz ready
              </span>
            )}
            {paper.url && (
              <a 
                href={paper.url} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={handleLinkClick}
                className="flex items-center gap-1 text-slate-400 hover:text-indigo-600 ml-auto"
              >
                <FileText className="w-3 h-3" />
                Paper
              </a>
            )}
            {paper.notionUrl && (
              <a 
                href={paper.notionUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={handleLinkClick}
                className="flex items-center gap-1 text-slate-400 hover:text-indigo-600"
              >
                <ExternalLink className="w-3 h-3" />
                Notion
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

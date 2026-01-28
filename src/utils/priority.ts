// ==================== PRIORITY CALCULATION ====================

import type { Paper, PaperStats, PriorityLabel } from '@shared/types';

/**
 * Calculate review priority for a paper
 * Higher priority = should be reviewed sooner
 * 
 * @param paper - Paper object
 * @param stats - Review stats for the paper
 * @returns Priority score
 */
export function calculatePriority(_paper: Paper, stats?: PaperStats): number {
  let priority = 0;
  
  // Never reviewed: high priority (+50)
  if (!stats?.lastReviewed) {
    priority += 50;
  } else {
    // Days since last review (capped at 30 points)
    const daysSince = Math.floor(
      (Date.now() - new Date(stats.lastReviewed).getTime()) / (1000 * 60 * 60 * 24)
    );
    priority += Math.min(daysSince * 2, 30);
  }
  
  // Low mastery score (+20)
  if (stats?.masteryScore !== undefined && stats.masteryScore < 50) {
    priority += 20;
  }
  
  // Due for review based on spaced repetition (+25)
  if (stats?.dueDate && new Date(stats.dueDate) <= new Date()) {
    priority += 25;
  }
  
  return priority;
}

/**
 * Get priority label for display
 * @param priority - Priority score
 * @returns Label and CSS class name
 */
export function getPriorityLabel(priority: number): PriorityLabel {
  if (priority > 60) {
    return { label: 'Due', className: 'bg-red-100 text-red-700' };
  }
  if (priority > 40) {
    return { label: 'Soon', className: 'bg-amber-100 text-amber-700' };
  }
  return { label: 'OK', className: 'bg-green-100 text-green-700' };
}

/**
 * Sort papers by priority (highest first)
 * @param papers - Array of paper objects
 * @param paperStats - Object with paper stats keyed by paper id
 * @returns Sorted papers
 */
export function sortByPriority(papers: Paper[], paperStats: Record<string, PaperStats>): Paper[] {
  return [...papers].sort((a, b) => {
    const priorityA = calculatePriority(a, paperStats[a.id]);
    const priorityB = calculatePriority(b, paperStats[b.id]);
    return priorityB - priorityA;
  });
}

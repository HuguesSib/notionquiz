// ==================== PRIORITY CALCULATION ====================

/**
 * Calculate review priority for a paper
 * Higher priority = should be reviewed sooner
 * 
 * @param {Object} paper - Paper object
 * @param {Object} stats - Review stats for the paper
 * @returns {number} Priority score
 */
export function calculatePriority(paper, stats) {
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
  if (stats?.masteryScore < 50) {
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
 * @param {number} priority - Priority score
 * @returns {{ label: string, className: string }}
 */
export function getPriorityLabel(priority) {
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
 * @param {Array} papers - Array of paper objects
 * @param {Object} paperStats - Object with paper stats keyed by paper id
 * @returns {Array} Sorted papers
 */
export function sortByPriority(papers, paperStats) {
  return [...papers].sort((a, b) => {
    const priorityA = calculatePriority(a, paperStats[a.id]);
    const priorityB = calculatePriority(b, paperStats[b.id]);
    return priorityB - priorityA;
  });
}

// ==================== SPACED REPETITION ====================
// Based on a simplified SM-2 algorithm

import type { SpacedRepetitionResult, RatingKey } from '@shared/types';

/**
 * Calculate the next review interval based on the SM-2 algorithm
 * @param quality - Quality of recall (0-5 scale)
 *   - 0: Complete blackout (Forgot)
 *   - 2: Struggled but recalled with hints
 *   - 4: Good recall with some effort
 *   - 5: Perfect recall
 * @param previousInterval - Previous interval in days (default: 0)
 * @param easeFactor - Current ease factor (default: 2.5)
 * @returns New interval and ease factor
 */
export function calculateNextReview(
  quality: number,
  previousInterval = 0,
  easeFactor = 2.5
): SpacedRepetitionResult {
  // If quality < 3, the item needs to be relearned
  if (quality < 3) {
    return { 
      interval: 1, 
      easeFactor: Math.max(1.3, easeFactor - 0.2) 
    };
  }
  
  // Calculate new interval
  let newInterval: number;
  if (previousInterval === 0) {
    newInterval = 1; // First review: 1 day
  } else if (previousInterval === 1) {
    newInterval = 3; // Second review: 3 days
  } else {
    newInterval = Math.round(previousInterval * easeFactor);
  }
  
  // Update ease factor based on quality
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  return {
    interval: Math.min(newInterval, 60), // Cap at 60 days
    easeFactor: Math.max(1.3, newEaseFactor) // Minimum ease factor of 1.3
  };
}

/**
 * Quality map for rating keys
 */
const qualityMap: Record<RatingKey, number> = {
  forgot: 0,
  struggled: 2,
  good: 4,
  perfect: 5
};

/**
 * Get the quality rating value from a rating key
 * @param ratingKey - Rating key (forgot, struggled, good, perfect)
 * @returns Quality value (0-5)
 */
export function getRatingQuality(ratingKey: RatingKey): number {
  return qualityMap[ratingKey] ?? 2;
}

/**
 * Calculate the due date for next review
 * @param interval - Interval in days
 * @returns ISO date string
 */
export function calculateDueDate(interval: number): string {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + interval);
  return dueDate.toISOString();
}

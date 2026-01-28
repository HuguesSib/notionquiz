// ==================== NOTION API SERVICE ====================
// This service communicates with the backend proxy for Notion API calls

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Fetch all papers from Notion via backend
 * @returns {Promise<{papers: Array, count: number, hasMore: boolean}>}
 */
export async function fetchPapers() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/papers`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to fetch papers: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch papers from Notion:', error);
    throw error;
  }
}

/**
 * Fetch a single paper by ID
 * @param {string} paperId - The Notion page ID
 * @returns {Promise<Object>} Paper object
 */
export async function fetchPaper(paperId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/papers/${paperId}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to fetch paper: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch paper ${paperId}:`, error);
    throw error;
  }
}

/**
 * Update paper review stats in Notion
 * @param {string} paperId - The Notion page ID
 * @param {Object} stats - Stats to update
 * @param {string} [stats.lastReviewed] - ISO date string of last review
 * @param {number} [stats.masteryScore] - Mastery score (0-100)
 * @param {number} [stats.reviewCount] - Total review count
 * @returns {Promise<{success: boolean, updatedAt: string}>}
 */
export async function updatePaperStats(paperId, stats) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/papers/${paperId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stats)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to update paper: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to update paper ${paperId}:`, error);
    throw error;
  }
}

/**
 * Check if the backend server is healthy
 * @returns {Promise<boolean>}
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch abstract for a paper from arXiv via backend
 * @param {string} paperId - The Notion page ID
 * @returns {Promise<{abstract: string, arxivId: string, arxivTitle: string, arxivAuthors: string[], arxivPublished: string}|null>}
 */
export async function fetchAbstract(paperId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/papers/${paperId}/abstract`);

    if (!response.ok) {
      // Non-arXiv papers or missing URL will return 400/404 - that's expected
      if (response.status === 400 || response.status === 404) {
        return null;
      }
      const error = await response.json();
      throw new Error(error.message || `Failed to fetch abstract: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(`Could not fetch abstract for paper ${paperId}:`, error.message);
    return null;
  }
}

/**
 * Fetch abstract directly from a URL (for papers without Notion ID)
 * @param {string} url - The paper URL (arXiv)
 * @returns {Promise<{abstract: string, arxivId: string, title: string, authors: string[], published: string}|null>}
 */
export async function fetchAbstractFromUrl(url) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/abstract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      // Non-arXiv URLs will return 400 - that's expected
      if (response.status === 400) {
        return null;
      }
      const error = await response.json();
      throw new Error(error.message || `Failed to fetch abstract: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(`Could not fetch abstract from URL ${url}:`, error.message);
    return null;
  }
}

/**
 * Check if a URL is an arXiv URL (client-side check)
 * @param {string} url - URL to check
 * @returns {boolean}
 */
export function isArxivUrl(url) {
  if (!url) return false;
  return /arxiv\.org\/(?:abs|pdf)\//.test(url);
}

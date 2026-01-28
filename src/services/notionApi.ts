// ==================== NOTION API SERVICE ====================
// This service communicates with the backend proxy for Notion API calls

import type {
  Paper,
  PapersResponse,
  UpdatePaperRequest,
  UpdatePaperResponse,
  AbstractResponse,
  ErrorResponse,
} from '@shared/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Fetch all papers from Notion via backend
 * @returns Papers list with count and pagination info
 */
export async function fetchPapers(): Promise<PapersResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/papers`);
    
    if (!response.ok) {
      const error = await response.json() as ErrorResponse;
      throw new Error(error.message || `Failed to fetch papers: ${response.status}`);
    }
    
    return await response.json() as PapersResponse;
  } catch (error) {
    console.error('Failed to fetch papers from Notion:', error);
    throw error;
  }
}

/**
 * Fetch a single paper by ID
 * @param paperId - The Notion page ID
 * @returns Paper object
 */
export async function fetchPaper(paperId: string): Promise<Paper> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/papers/${paperId}`);
    
    if (!response.ok) {
      const error = await response.json() as ErrorResponse;
      throw new Error(error.message || `Failed to fetch paper: ${response.status}`);
    }
    
    return await response.json() as Paper;
  } catch (error) {
    console.error(`Failed to fetch paper ${paperId}:`, error);
    throw error;
  }
}

/**
 * Update paper review stats in Notion
 * @param paperId - The Notion page ID
 * @param stats - Stats to update
 * @returns Success status and update timestamp
 */
export async function updatePaperStats(
  paperId: string,
  stats: UpdatePaperRequest
): Promise<UpdatePaperResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/papers/${paperId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stats)
    });
    
    if (!response.ok) {
      const error = await response.json() as ErrorResponse;
      throw new Error(error.message || `Failed to update paper: ${response.status}`);
    }
    
    return await response.json() as UpdatePaperResponse;
  } catch (error) {
    console.error(`Failed to update paper ${paperId}:`, error);
    throw error;
  }
}

/**
 * Check if the backend server is healthy
 * @returns true if backend is available
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch abstract for a paper from arXiv via backend
 * @param paperId - The Notion page ID
 * @returns Abstract data or null if not available
 */
export async function fetchAbstract(paperId: string): Promise<AbstractResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/papers/${paperId}/abstract`);

    if (!response.ok) {
      // Non-arXiv papers or missing URL will return 400/404 - that's expected
      if (response.status === 400 || response.status === 404) {
        return null;
      }
      const error = await response.json() as ErrorResponse;
      throw new Error(error.message || `Failed to fetch abstract: ${response.status}`);
    }

    return await response.json() as AbstractResponse;
  } catch (error) {
    const err = error as Error;
    console.warn(`Could not fetch abstract for paper ${paperId}:`, err.message);
    return null;
  }
}

/**
 * Fetch abstract directly from a URL (for papers without Notion ID)
 * @param url - The paper URL (arXiv)
 * @returns Abstract data or null if not available
 */
export async function fetchAbstractFromUrl(url: string): Promise<AbstractResponse | null> {
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
      const error = await response.json() as ErrorResponse;
      throw new Error(error.message || `Failed to fetch abstract: ${response.status}`);
    }

    return await response.json() as AbstractResponse;
  } catch (error) {
    const err = error as Error;
    console.warn(`Could not fetch abstract from URL ${url}:`, err.message);
    return null;
  }
}

/**
 * Check if a URL is an arXiv URL (client-side check)
 * @param url - URL to check
 * @returns true if URL is from arXiv
 */
export function isArxivUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return /arxiv\.org\/(?:abs|pdf)\//.test(url);
}

/**
 * Reset paper stats in Notion (set to zero/null)
 * @param paperId - The Notion page ID
 * @returns Success status
 */
export async function resetPaperStats(paperId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/papers/${paperId}/reset`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      // If reset fails (e.g., properties don't exist), that's okay
      if (response.status === 400 || response.status === 404) {
        return false;
      }
      throw new Error(`Failed to reset paper stats: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.warn(`Failed to reset stats for paper ${paperId}:`, error);
    return false;
  }
}

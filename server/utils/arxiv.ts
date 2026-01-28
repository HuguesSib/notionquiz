/**
 * arXiv API utility functions
 * Handles ID extraction and abstract fetching from arXiv papers
 */

import type { ArxivMetadata } from '../../shared/types/index.js';

/**
 * Response from fetchAbstractFromUrl
 */
export interface ArxivAbstractResult {
  abstract: string;
  arxivTitle: string;
  arxivAuthors: string[];
  arxivPublished: string | null;
}

/**
 * Extract arXiv ID from various URL formats
 * @param url - URL that may contain an arXiv link
 * @returns arXiv ID or null if not an arXiv URL
 *
 * Handles formats:
 * - https://arxiv.org/abs/2509.13414
 * - https://arxiv.org/abs/2509.13414v1
 * - https://arxiv.org/pdf/2509.13414.pdf
 * - https://arxiv.org/pdf/2509.13414v2.pdf
 * - http://arxiv.org/abs/cs/0501001 (old format)
 */
export function extractArxivId(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;

  // New format: arxiv.org/abs/YYMM.NNNNN or arxiv.org/pdf/YYMM.NNNNN
  const newFormatMatch = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i);
  if (newFormatMatch) {
    // Remove version suffix for API call (API accepts with or without)
    return newFormatMatch[1].replace(/v\d+$/, '');
  }

  // Old format: arxiv.org/abs/category/NNNNNNN
  const oldFormatMatch = url.match(/arxiv\.org\/(?:abs|pdf)\/([a-z-]+\/\d{7})/i);
  if (oldFormatMatch) {
    return oldFormatMatch[1];
  }

  return null;
}

/**
 * Check if a URL is an arXiv URL
 * @param url - URL to check
 * @returns true if URL is from arXiv
 */
export function isArxivUrl(url: string | null | undefined): boolean {
  return extractArxivId(url) !== null;
}

/**
 * Fetch paper metadata from arXiv API
 * @param arxivId - arXiv ID (e.g., "2509.13414" or "cs/0501001")
 * @returns Paper metadata or null if not found
 */
export async function fetchArxivMetadata(arxivId: string | null | undefined): Promise<ArxivMetadata | null> {
  if (!arxivId) return null;

  try {
    const response = await fetch(`http://export.arxiv.org/api/query?id_list=${arxivId}`);

    if (!response.ok) {
      console.error(`arXiv API error: ${response.status}`);
      return null;
    }

    const xml = await response.text();

    // Parse the XML response
    const metadata = parseArxivXml(xml);

    if (!metadata || !metadata.abstract) {
      console.warn(`No abstract found for arXiv ID: ${arxivId}`);
      return null;
    }

    return metadata;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to fetch arXiv metadata for ${arxivId}:`, errorMessage);
    return null;
  }
}

/**
 * Parse arXiv Atom XML response
 * @param xml - Raw XML string from arXiv API
 * @returns Parsed metadata or null if parsing fails
 */
function parseArxivXml(xml: string): ArxivMetadata | null {
  try {
    // Extract title
    // Filter out the feed title (which is "ArXiv Query..."), get the entry title
    const allTitles = xml.match(/<entry>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/);
    const title = allTitles ? allTitles[1].replace(/\s+/g, ' ').trim() : null;

    // Extract abstract (summary)
    const abstractMatch = xml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
    const abstract = abstractMatch ? abstractMatch[1].replace(/\s+/g, ' ').trim() : null;

    // Extract authors
    const authorMatches = [...xml.matchAll(/<author>\s*<name>([^<]+)<\/name>/g)];
    const authors = authorMatches.map(m => m[1].trim());

    // Extract published date
    const publishedMatch = xml.match(/<published>([^<]+)<\/published>/);
    const published = publishedMatch ? publishedMatch[1].trim() : '';

    // Check if we actually found an entry (not just an empty result)
    if (!title || !abstract) {
      return null;
    }

    return {
      title,
      abstract,
      authors,
      published
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to parse arXiv XML:', errorMessage);
    return null;
  }
}

/**
 * Fetch abstract from URL if it's an arXiv paper
 * @param url - Paper URL
 * @returns Abstract and metadata or null if not an arXiv paper
 */
export async function fetchAbstractFromUrl(url: string | null | undefined): Promise<ArxivAbstractResult | null> {
  const arxivId = extractArxivId(url);
  if (!arxivId) return null;

  const metadata = await fetchArxivMetadata(arxivId);
  if (!metadata) return null;

  return {
    abstract: metadata.abstract,
    arxivTitle: metadata.title,
    arxivAuthors: metadata.authors,
    arxivPublished: metadata.published
  };
}

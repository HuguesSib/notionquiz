import express, { Request, Response, Router } from 'express';
import { Client } from '@notionhq/client';
import type {
  PageObjectResponse,
  BlockObjectResponse,
  RichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints.js';
import { extractArxivId, fetchArxivMetadata, isArxivUrl } from '../utils/arxiv.js';
import type {
  Paper,
  PapersResponse,
  UpdatePaperRequest,
  UpdatePaperResponse,
  AbstractResponse,
  ErrorResponse,
} from '../../shared/types/index.js';

const router: Router = express.Router();

// Notion API error type
interface NotionAPIError extends Error {
  code?: string;
  status?: number;
}

// Property lookup result type
interface PropertyLookupResult {
  name: string;
  property: PageObjectResponse['properties'][string];
}

// Lazy initialization of Notion client (to ensure env vars are loaded)
let notion: Client | null = null;

function getNotionClient(): Client {
  if (!notion) {
    notion = new Client({
      auth: process.env.NOTION_API_KEY
    });
  }
  return notion;
}

function getDatabaseId(): string | undefined {
  return process.env.NOTION_DATABASE_ID;
}

/**
 * Helper function to extract text from Notion rich text array
 */
function extractText(richTextArray: RichTextItemResponse[] | undefined): string {
  if (!richTextArray || !Array.isArray(richTextArray)) return '';
  return richTextArray.map(item => item.plain_text || '').join('');
}

/**
 * Helper function to extract page content from blocks
 */
async function getPageContent(pageId: string): Promise<string> {
  try {
    const blocks = await getNotionClient().blocks.children.list({
      block_id: pageId,
      page_size: 100
    });

    let content = '';
    for (const block of blocks.results) {
      const typedBlock = block as BlockObjectResponse;
      
      switch (typedBlock.type) {
        case 'paragraph':
          content += extractText(typedBlock.paragraph?.rich_text) + '\n\n';
          break;
        case 'heading_1':
          content += '# ' + extractText(typedBlock.heading_1?.rich_text) + '\n\n';
          break;
        case 'heading_2':
          content += '## ' + extractText(typedBlock.heading_2?.rich_text) + '\n\n';
          break;
        case 'heading_3':
          content += '### ' + extractText(typedBlock.heading_3?.rich_text) + '\n\n';
          break;
        case 'bulleted_list_item':
          content += '- ' + extractText(typedBlock.bulleted_list_item?.rich_text) + '\n';
          break;
        case 'numbered_list_item':
          content += '1. ' + extractText(typedBlock.numbered_list_item?.rich_text) + '\n';
          break;
        case 'code':
          content += '```\n' + extractText(typedBlock.code?.rich_text) + '\n```\n\n';
          break;
        case 'quote':
          content += '> ' + extractText(typedBlock.quote?.rich_text) + '\n\n';
          break;
        case 'callout':
          content += '> ' + extractText(typedBlock.callout?.rich_text) + '\n\n';
          break;
        case 'toggle':
          content += extractText(typedBlock.toggle?.rich_text) + '\n';
          break;
        default:
          // Skip unsupported block types
          break;
      }
    }

    return content.trim();
  } catch (error) {
    const err = error as Error;
    console.error(`Failed to get content for page ${pageId}:`, err.message);
    return '';
  }
}

/**
 * Auto-detect a property by type from the page properties
 */
function findPropertyByType(
  properties: PageObjectResponse['properties'],
  type: string,
  preferredNames: string[] = []
): PropertyLookupResult | null {
  // First check preferred names
  for (const name of preferredNames) {
    if (properties[name]?.type === type) {
      return { name, property: properties[name] };
    }
  }
  
  // Then search all properties for the type
  for (const [name, property] of Object.entries(properties)) {
    if (property.type === type) {
      return { name, property };
    }
  }
  
  return null;
}

/**
 * Transform Notion page to paper object
 * Required properties: Note (title), Note Type (select)
 * Optional properties: Tags (multi_select), Authors (rich_text), URL (url), Category (select)
 */
async function transformNotionPage(page: PageObjectResponse, includeContent = true): Promise<Paper> {
  const properties = page.properties;
  
  // REQUIRED: Extract title (Note property - this is the title type)
  const noteProperty = properties.Note;
  const title = noteProperty?.type === 'title' 
    ? extractText(noteProperty.title) 
    : 'Untitled';
  
  // OPTIONAL: Extract tags - try common names or auto-detect multi_select
  let tags: string[] = [];
  const tagsProperty = properties.Tags;
  if (tagsProperty?.type === 'multi_select') {
    tags = tagsProperty.multi_select.map(tag => tag.name);
  } else {
    // Try to find any multi_select property
    const multiSelectProp = findPropertyByType(properties, 'multi_select', ['Tags', 'Labels', 'Topics']);
    if (multiSelectProp && multiSelectProp.property.type === 'multi_select') {
      tags = multiSelectProp.property.multi_select?.map(tag => tag.name) || [];
    }
  }
  
  // OPTIONAL: Extract authors - try common names or auto-detect rich_text
  let authors = '';
  const authorsProperty = properties.Authors;
  const authorProperty = properties.Author;
  if (authorsProperty?.type === 'rich_text') {
    authors = extractText(authorsProperty.rich_text);
  } else if (authorProperty?.type === 'rich_text') {
    authors = extractText(authorProperty.rich_text);
  }
  
  // OPTIONAL: Extract URL - try common names or auto-detect url type
  let url = '';
  const urlProp = findPropertyByType(properties, 'url', ['URL', 'userDefined:URL', 'Link', 'Paper URL', 'Source']);
  if (urlProp && urlProp.property.type === 'url') {
    url = urlProp.property.url || '';
  }
  
  // Get page content if requested
  let content = '';
  if (includeContent) {
    content = await getPageContent(page.id);
  }

  // OPTIONAL: Extract sync stats if properties exist
  let notionStats: Paper['notionStats'] = undefined;
  
  // Try to get Last Reviewed
  const lastReviewedProp = properties['Last Reviewed'];
  const lastReviewed = lastReviewedProp?.type === 'date' && lastReviewedProp.date?.start
    ? lastReviewedProp.date.start
    : undefined;
  
  // Try to get Mastery Score
  const masteryScoreProp = properties['Mastery Score'];
  const masteryScore = masteryScoreProp?.type === 'number' && masteryScoreProp.number !== null
    ? masteryScoreProp.number
    : undefined;
  
  // Try to get Review Count
  const reviewCountProp = properties['Review Count'];
  const reviewCount = reviewCountProp?.type === 'number' && reviewCountProp.number !== null
    ? reviewCountProp.number
    : undefined;
  
  // Only include notionStats if at least one property exists
  if (lastReviewed !== undefined || masteryScore !== undefined || reviewCount !== undefined) {
    notionStats = {
      lastReviewed,
      masteryScore,
      reviewCount
    };
  }

  return {
    id: page.id,
    title,
    tags,
    authors,
    url,
    notionUrl: `https://www.notion.so/${page.id.replace(/-/g, '')}`,
    content,
    lastEdited: page.last_edited_time,
    createdAt: page.created_time,
    notionStats
  };
}

/**
 * GET /api/papers
 * Fetch all papers from Notion database
 */
router.get('/papers', async (_req: Request, res: Response<PapersResponse | ErrorResponse>) => {
  try {
    const databaseId = getDatabaseId();
    if (!databaseId) {
      return res.status(500).json({ 
        error: 'NOTION_DATABASE_ID not configured',
        message: 'Please add NOTION_DATABASE_ID to your server/.env file'
      });
    }

    if (!process.env.NOTION_API_KEY || process.env.NOTION_API_KEY === 'your_notion_api_key_here') {
      return res.status(500).json({ 
        error: 'NOTION_API_KEY not configured',
        message: 'Please add your Notion API key to server/.env'
      });
    }

    // Query the database for papers
    const response = await getNotionClient().databases.query({
      database_id: databaseId,
      filter: {
        property: 'Note Type',
        select: {
          equals: 'Paper'
        }
      },
      sorts: [
        {
          property: 'Last edited time',
          direction: 'descending'
        }
      ],
      page_size: 100
    });

    // Transform pages to paper objects (with content)
    const papers = await Promise.all(
      response.results
        .filter((page): page is PageObjectResponse => 'properties' in page)
        .map(page => transformNotionPage(page, true))
    );

    res.json({
      papers,
      count: papers.length,
      hasMore: response.has_more
    });
  } catch (error) {
    const err = error as NotionAPIError;
    console.error('Failed to fetch papers:', err);
    
    if (err.code === 'unauthorized') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid Notion API key. Please check your NOTION_API_KEY in server/.env'
      });
    }
    
    if (err.code === 'object_not_found') {
      return res.status(404).json({
        error: 'Database not found',
        message: 'The specified database was not found. Please check your NOTION_DATABASE_ID and ensure the integration has access to the database.'
      });
    }

    res.status(500).json({ 
      error: 'Failed to fetch papers',
      message: err.message 
    });
  }
});

/**
 * GET /api/papers/:id
 * Fetch a single paper by ID
 */
router.get('/papers/:id', async (req: Request<{ id: string }>, res: Response<Paper | ErrorResponse>) => {
  try {
    const { id } = req.params;
    
    const page = await getNotionClient().pages.retrieve({ page_id: id });
    
    if (!('properties' in page)) {
      return res.status(404).json({
        error: 'Paper not found',
        message: `No paper found with ID: ${id}`
      });
    }
    
    const paper = await transformNotionPage(page as PageObjectResponse, true);
    
    res.json(paper);
  } catch (error) {
    const err = error as NotionAPIError;
    console.error(`Failed to fetch paper ${req.params.id}:`, err);
    
    if (err.code === 'object_not_found') {
      return res.status(404).json({
        error: 'Paper not found',
        message: `No paper found with ID: ${req.params.id}`
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch paper',
      message: err.message 
    });
  }
});

/**
 * PATCH /api/papers/:id
 * Update paper review stats in Notion
 */
router.patch('/papers/:id', async (
  req: Request<{ id: string }, UpdatePaperResponse | ErrorResponse, UpdatePaperRequest>,
  res: Response<UpdatePaperResponse | ErrorResponse>
) => {
  try {
    const { id } = req.params;
    const { lastReviewed, masteryScore, reviewCount } = req.body;

    // Build properties to update
    const properties: Record<string, unknown> = {};
    
    if (lastReviewed) {
      properties['Last Reviewed'] = {
        date: {
          start: lastReviewed
        }
      };
    }
    
    if (masteryScore !== undefined) {
      properties['Mastery Score'] = {
        number: Math.round(masteryScore)
      };
    }
    
    if (reviewCount !== undefined) {
      properties['Review Count'] = {
        number: reviewCount
      };
    }

    // Only update if there are properties to update
    if (Object.keys(properties).length === 0) {
      return res.status(400).json({
        error: 'No properties to update',
        message: 'Please provide at least one property to update (lastReviewed, masteryScore, or reviewCount)'
      });
    }

    const response = await getNotionClient().pages.update({
      page_id: id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: properties as any
    });

    res.json({
      success: true,
      updatedAt: 'last_edited_time' in response ? response.last_edited_time : new Date().toISOString()
    });
  } catch (error) {
    const err = error as NotionAPIError;
    
    if (err.code === 'object_not_found') {
      console.warn(`Paper not found: ${req.params.id}`);
      return res.status(404).json({
        error: 'Paper not found',
        message: `No paper found with ID: ${req.params.id}`
      });
    }
    
    if (err.code === 'validation_error') {
      // Quiet log for missing properties - this is expected if user hasn't set up Notion columns
      console.log('Notion sync skipped: missing properties in database (this is OK - stats saved locally)');
      return res.status(400).json({
        error: 'Validation error',
        message: err.message,
        hint: 'Optional: Add "Last Reviewed" (date), "Mastery Score" (number), and "Review Count" (number) to your Notion database to sync stats'
      });
    }
    
    console.error(`Failed to update paper ${req.params.id}:`, err);
    res.status(500).json({
      error: 'Failed to update paper',
      message: err.message
    });
  }
});

/**
 * POST /api/papers/:id/reset
 * Reset paper review stats in Notion (set to zero/clear)
 */
router.post('/papers/:id/reset', async (
  req: Request<{ id: string }>,
  res: Response<UpdatePaperResponse | ErrorResponse>
) => {
  try {
    const { id } = req.params;

    // Build properties to reset
    const properties: Record<string, unknown> = {
      'Mastery Score': { number: 0 },
      'Review Count': { number: 0 },
      'Last Reviewed': { date: null } // Clear the date
    };

    const response = await getNotionClient().pages.update({
      page_id: id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: properties as any
    });

    res.json({
      success: true,
      updatedAt: 'last_edited_time' in response ? response.last_edited_time : new Date().toISOString()
    });
  } catch (error) {
    const err = error as NotionAPIError;
    
    if (err.code === 'object_not_found') {
      return res.status(404).json({
        error: 'Paper not found',
        message: `No paper found with ID: ${req.params.id}`
      });
    }
    
    if (err.code === 'validation_error') {
      // Properties don't exist in the database - that's okay
      console.log('Notion reset skipped: missing properties in database');
      return res.status(400).json({
        error: 'Validation error',
        message: err.message,
        hint: 'Stats properties may not exist in your Notion database'
      });
    }
    
    console.error(`Failed to reset paper ${req.params.id}:`, err);
    res.status(500).json({
      error: 'Failed to reset paper',
      message: err.message
    });
  }
});

/**
 * GET /api/papers/:id/abstract
 * Fetch abstract from arXiv if the paper has an arXiv URL
 */
router.get('/papers/:id/abstract', async (
  req: Request<{ id: string }>,
  res: Response<AbstractResponse | ErrorResponse>
) => {
  try {
    const { id } = req.params;

    // Get the paper from Notion to get its URL
    const page = await getNotionClient().pages.retrieve({ page_id: id });
    
    if (!('properties' in page)) {
      return res.status(404).json({
        error: 'Paper not found',
        message: `No paper found with ID: ${id}`
      });
    }
    
    // Auto-detect URL property
    const urlProp = findPropertyByType(
      (page as PageObjectResponse).properties, 
      'url', 
      ['URL', 'userDefined:URL', 'Link', 'Paper URL', 'Source']
    );
    const url = urlProp?.property.type === 'url' ? urlProp.property.url || '' : '';

    if (!url) {
      return res.status(404).json({
        error: 'No URL found',
        message: 'This paper does not have a URL property set'
      });
    }

    // Check if it's an arXiv URL
    if (!isArxivUrl(url)) {
      return res.status(400).json({
        error: 'Not an arXiv paper',
        message: 'The paper URL is not an arXiv link. Abstract fetching is only supported for arXiv papers.'
      });
    }

    // Extract arXiv ID and fetch metadata
    const arxivId = extractArxivId(url);
    const metadata = await fetchArxivMetadata(arxivId);

    if (!metadata) {
      return res.status(404).json({
        error: 'Abstract not found',
        message: `Could not fetch abstract from arXiv for ID: ${arxivId}`
      });
    }

    res.json({
      paperId: id,
      arxivId: arxivId!,
      url,
      abstract: metadata.abstract,
      arxivTitle: metadata.title,
      arxivAuthors: metadata.authors,
      arxivPublished: metadata.published
    });
  } catch (error) {
    const err = error as NotionAPIError;
    console.error(`Failed to fetch abstract for paper ${req.params.id}:`, err);

    if (err.code === 'object_not_found') {
      return res.status(404).json({
        error: 'Paper not found',
        message: `No paper found with ID: ${req.params.id}`
      });
    }

    res.status(500).json({
      error: 'Failed to fetch abstract',
      message: err.message
    });
  }
});

// Request body type for POST /abstract
interface AbstractRequestBody {
  url?: string;
}

/**
 * POST /api/abstract
 * Fetch abstract directly from a URL (doesn't require Notion paper ID)
 */
router.post('/abstract', async (
  req: Request<object, AbstractResponse | ErrorResponse, AbstractRequestBody>,
  res: Response<AbstractResponse | ErrorResponse>
) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'Missing URL',
        message: 'Please provide a URL in the request body'
      });
    }

    if (!isArxivUrl(url)) {
      return res.status(400).json({
        error: 'Not an arXiv URL',
        message: 'The provided URL is not an arXiv link'
      });
    }

    const arxivId = extractArxivId(url);
    const metadata = await fetchArxivMetadata(arxivId);

    if (!metadata) {
      return res.status(404).json({
        error: 'Abstract not found',
        message: `Could not fetch abstract from arXiv for ID: ${arxivId}`
      });
    }

    res.json({
      arxivId: arxivId!,
      url,
      abstract: metadata.abstract,
      title: metadata.title,
      authors: metadata.authors,
      published: metadata.published
    });
  } catch (error) {
    const err = error as Error;
    console.error('Failed to fetch abstract:', err);
    res.status(500).json({
      error: 'Failed to fetch abstract',
      message: err.message
    });
  }
});

export default router;

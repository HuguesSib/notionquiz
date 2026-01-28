import express from 'express';
import { Client } from '@notionhq/client';
import { extractArxivId, fetchArxivMetadata, isArxivUrl } from '../utils/arxiv.js';

const router = express.Router();

// Lazy initialization of Notion client (to ensure env vars are loaded)
let notion = null;
function getNotionClient() {
  if (!notion) {
    notion = new Client({
      auth: process.env.NOTION_API_KEY
    });
  }
  return notion;
}

function getDatabaseId() {
  return process.env.NOTION_DATABASE_ID;
}

/**
 * Helper function to extract text from Notion rich text array
 */
function extractText(richTextArray) {
  if (!richTextArray || !Array.isArray(richTextArray)) return '';
  return richTextArray.map(item => item.plain_text || '').join('');
}

/**
 * Helper function to extract page content from blocks
 */
async function getPageContent(pageId) {
  try {
    const blocks = await getNotionClient().blocks.children.list({
      block_id: pageId,
      page_size: 100
    });

    let content = '';
    for (const block of blocks.results) {
      switch (block.type) {
        case 'paragraph':
          content += extractText(block.paragraph?.rich_text) + '\n\n';
          break;
        case 'heading_1':
          content += '# ' + extractText(block.heading_1?.rich_text) + '\n\n';
          break;
        case 'heading_2':
          content += '## ' + extractText(block.heading_2?.rich_text) + '\n\n';
          break;
        case 'heading_3':
          content += '### ' + extractText(block.heading_3?.rich_text) + '\n\n';
          break;
        case 'bulleted_list_item':
          content += '- ' + extractText(block.bulleted_list_item?.rich_text) + '\n';
          break;
        case 'numbered_list_item':
          content += '1. ' + extractText(block.numbered_list_item?.rich_text) + '\n';
          break;
        case 'code':
          content += '```\n' + extractText(block.code?.rich_text) + '\n```\n\n';
          break;
        case 'quote':
          content += '> ' + extractText(block.quote?.rich_text) + '\n\n';
          break;
        case 'callout':
          content += '> ' + extractText(block.callout?.rich_text) + '\n\n';
          break;
        case 'toggle':
          content += extractText(block.toggle?.rich_text) + '\n';
          break;
        default:
          // Skip unsupported block types
          break;
      }
    }

    return content.trim();
  } catch (error) {
    console.error(`Failed to get content for page ${pageId}:`, error.message);
    return '';
  }
}

/**
 * Auto-detect a property by type from the page properties
 * @param {Object} properties - Notion page properties
 * @param {string} type - Property type to find (e.g., 'url', 'multi_select')
 * @param {string[]} preferredNames - Preferred property names to check first
 * @returns {Object|null} The found property or null
 */
function findPropertyByType(properties, type, preferredNames = []) {
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
async function transformNotionPage(page, includeContent = true) {
  const properties = page.properties;
  
  // REQUIRED: Extract title (Note property - this is the title type)
  const title = extractText(properties.Note?.title) || 'Untitled';
  
  // OPTIONAL: Extract tags - try common names or auto-detect multi_select
  let tags = [];
  if (properties.Tags?.multi_select) {
    tags = properties.Tags.multi_select.map(tag => tag.name);
  } else {
    // Try to find any multi_select property
    const multiSelectProp = findPropertyByType(properties, 'multi_select', ['Tags', 'Labels', 'Topics']);
    if (multiSelectProp) {
      tags = multiSelectProp.property.multi_select?.map(tag => tag.name) || [];
    }
  }
  
  // OPTIONAL: Extract authors - try common names or auto-detect rich_text
  let authors = '';
  if (properties.Authors?.rich_text) {
    authors = extractText(properties.Authors.rich_text);
  } else if (properties.Author?.rich_text) {
    authors = extractText(properties.Author.rich_text);
  }
  
  // OPTIONAL: Extract URL - try common names or auto-detect url type
  let url = '';
  const urlProp = findPropertyByType(properties, 'url', ['URL', 'userDefined:URL', 'Link', 'Paper URL', 'Source']);
  if (urlProp) {
    url = urlProp.property.url || '';
  }
  
  // Get page content if requested
  let content = '';
  if (includeContent) {
    content = await getPageContent(page.id);
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
    createdAt: page.created_time
  };
}

/**
 * GET /api/papers
 * Fetch all papers from Notion database
 */
router.get('/papers', async (req, res) => {
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
      response.results.map(page => transformNotionPage(page, true))
    );

    res.json({
      papers,
      count: papers.length,
      hasMore: response.has_more
    });
  } catch (error) {
    console.error('Failed to fetch papers:', error);
    
    if (error.code === 'unauthorized') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid Notion API key. Please check your NOTION_API_KEY in server/.env'
      });
    }
    
    if (error.code === 'object_not_found') {
      return res.status(404).json({
        error: 'Database not found',
        message: 'The specified database was not found. Please check your NOTION_DATABASE_ID and ensure the integration has access to the database.'
      });
    }

    res.status(500).json({ 
      error: 'Failed to fetch papers',
      message: error.message 
    });
  }
});

/**
 * GET /api/papers/:id
 * Fetch a single paper by ID
 */
router.get('/papers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const page = await getNotionClient().pages.retrieve({ page_id: id });
    const paper = await transformNotionPage(page, true);
    
    res.json(paper);
  } catch (error) {
    console.error(`Failed to fetch paper ${req.params.id}:`, error);
    
    if (error.code === 'object_not_found') {
      return res.status(404).json({
        error: 'Paper not found',
        message: `No paper found with ID: ${req.params.id}`
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch paper',
      message: error.message 
    });
  }
});

/**
 * PATCH /api/papers/:id
 * Update paper review stats in Notion
 */
router.patch('/papers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lastReviewed, masteryScore, reviewCount } = req.body;

    // Build properties to update
    const properties = {};
    
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
      properties
    });

    res.json({
      success: true,
      updatedAt: response.last_edited_time
    });
  } catch (error) {
    if (error.code === 'object_not_found') {
      console.warn(`Paper not found: ${req.params.id}`);
      return res.status(404).json({
        error: 'Paper not found',
        message: `No paper found with ID: ${req.params.id}`
      });
    }
    
    if (error.code === 'validation_error') {
      // Quiet log for missing properties - this is expected if user hasn't set up Notion columns
      console.log(`Notion sync skipped: missing properties in database (this is OK - stats saved locally)`);
      return res.status(400).json({
        error: 'Validation error',
        message: error.message,
        hint: 'Optional: Add "Last Reviewed" (date), "Mastery Score" (number), and "Review Count" (number) to your Notion database to sync stats'
      });
    }
    
    console.error(`Failed to update paper ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to update paper',
      message: error.message
    });
  }
});

/**
 * GET /api/papers/:id/abstract
 * Fetch abstract from arXiv if the paper has an arXiv URL
 */
router.get('/papers/:id/abstract', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the paper from Notion to get its URL
    const page = await getNotionClient().pages.retrieve({ page_id: id });
    
    // Auto-detect URL property
    const urlProp = findPropertyByType(page.properties, 'url', ['URL', 'userDefined:URL', 'Link', 'Paper URL', 'Source']);
    const url = urlProp?.property.url || '';

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
        message: 'The paper URL is not an arXiv link. Abstract fetching is only supported for arXiv papers.',
        url
      });
    }

    // Extract arXiv ID and fetch metadata
    const arxivId = extractArxivId(url);
    const metadata = await fetchArxivMetadata(arxivId);

    if (!metadata) {
      return res.status(404).json({
        error: 'Abstract not found',
        message: `Could not fetch abstract from arXiv for ID: ${arxivId}`,
        arxivId
      });
    }

    res.json({
      paperId: id,
      arxivId,
      url,
      abstract: metadata.abstract,
      arxivTitle: metadata.title,
      arxivAuthors: metadata.authors,
      arxivPublished: metadata.published
    });
  } catch (error) {
    console.error(`Failed to fetch abstract for paper ${req.params.id}:`, error);

    if (error.code === 'object_not_found') {
      return res.status(404).json({
        error: 'Paper not found',
        message: `No paper found with ID: ${req.params.id}`
      });
    }

    res.status(500).json({
      error: 'Failed to fetch abstract',
      message: error.message
    });
  }
});

/**
 * POST /api/abstract
 * Fetch abstract directly from a URL (doesn't require Notion paper ID)
 */
router.post('/abstract', async (req, res) => {
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
        message: 'The provided URL is not an arXiv link',
        url
      });
    }

    const arxivId = extractArxivId(url);
    const metadata = await fetchArxivMetadata(arxivId);

    if (!metadata) {
      return res.status(404).json({
        error: 'Abstract not found',
        message: `Could not fetch abstract from arXiv for ID: ${arxivId}`,
        arxivId
      });
    }

    res.json({
      arxivId,
      url,
      abstract: metadata.abstract,
      title: metadata.title,
      authors: metadata.authors,
      published: metadata.published
    });
  } catch (error) {
    console.error('Failed to fetch abstract:', error);
    res.status(500).json({
      error: 'Failed to fetch abstract',
      message: error.message
    });
  }
});

export default router;

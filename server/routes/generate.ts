import express, { Request, Response, Router } from 'express';
import type {
  Paper,
  Flashcard,
  GenerateRequest,
  GenerateResponse,
  ErrorResponse,
} from '../../shared/types/index.js';

const router: Router = express.Router();

/**
 * Claude API response type
 */
interface ClaudeAPIResponse {
  content?: Array<{ text?: string }>;
  error?: { message?: string };
}

/**
 * POST /api/generate
 * Generate quiz flashcards using Claude AI
 */
router.post('/generate', async (
  req: Request<object, GenerateResponse | ErrorResponse, GenerateRequest>,
  res: Response<GenerateResponse | ErrorResponse>
) => {
  try {
    const { paper, otherPapers = [], numCards = 5, abstract = null } = req.body;

    if (!paper?.title) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Please provide paper with title'
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'API key not configured',
        message: 'ANTHROPIC_API_KEY is not set in server environment'
      });
    }

    // Build the prompt
    const prompt = buildGeneratePrompt(paper, otherPapers, numCards, abstract);

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json() as ClaudeAPIResponse;

    if (!response.ok) {
      console.error('Claude API error:', data);
      return res.status(500).json({
        error: 'AI generation failed',
        message: data.error?.message || 'Failed to generate flashcards'
      });
    }

    // Parse the response
    const responseText = data.content?.map(c => c.text || '').join('') || '';
    const flashcards = parseFlashcardsResponse(responseText);

    res.json({ flashcards });
  } catch (error) {
    const err = error as Error;
    console.error('Generation error:', err);
    res.status(500).json({
      error: 'Generation failed',
      message: err.message
    });
  }
});

/**
 * Build the flashcard generation prompt
 */
function buildGeneratePrompt(
  paper: Paper,
  otherPapers: Paper[],
  numCards: number,
  abstract: string | null
): string {
  const otherPapersContext = otherPapers
    .filter(p => p.id !== paper.id)
    .slice(0, 5)
    .map(p => `- "${p.title}" (${p.tags?.slice(0, 2).join(', ') || 'General'}): ${p.content?.slice(0, 300) || 'No notes'}...`)
    .join('\n');

  const abstractSection = abstract
    ? `\nABSTRACT (from arXiv):\n${abstract}\n`
    : '';

  const numOpenEnded = numCards - 1;

  return `Generate ${numCards} quiz questions for a PhD researcher reviewing this paper.

QUESTION MIX REQUIRED:
- 1 MULTIPLE CHOICE question (quick recall check)
- ${numOpenEnded} OPEN-ENDED questions (deeper understanding)

CURRENT PAPER:
Title: ${paper.title}
Authors: ${paper.authors || 'Unknown'}
Tags: ${paper.tags?.join(', ') || 'None'}
${abstractSection}
Notes:
${paper.content || 'No notes available'}

${otherPapersContext ? `OTHER PAPERS IN DATABASE (for comparison questions):
${otherPapersContext}` : ''}

REQUIREMENTS:
1. Keep questions SHORT and CLEAR (1-2 sentences max)
2. Focus on KEY TAKEAWAYS - what makes this paper important/unique
3. For the MCQ: test basic factual recall, make wrong answers plausible
4. For open-ended questions, use these difficulty levels:
   - "understand": Explain core concepts in own words (e.g., "In 2-3 sentences, explain the main contribution")
   - "apply": Use knowledge in new context (e.g., "How would you apply this to [domain]?")
   - "analyze": Break down components (e.g., "What are the trade-offs of their approach?")
   - "evaluate": Judge/critique (e.g., "What's the main limitation?")

RETURN FORMAT - ONLY a valid JSON array:

For MCQ (exactly 1):
{
  "questionType": "mcq",
  "question": "Short, focused question",
  "options": ["A) First", "B) Second", "C) Third", "D) Fourth"],
  "correctIndex": 0,
  "explanation": "Why this is correct (1-2 sentences)",
  "concept": "main_contribution|technical|comparison|practical"
}

For Open-Ended (exactly ${numOpenEnded}):
{
  "questionType": "open-ended",
  "question": "Clear question requiring explanation/analysis",
  "expectedPoints": ["Key point 1 answer should cover", "Key point 2", "Key point 3"],
  "explanation": "Complete model answer (2-4 sentences)",
  "concept": "main_contribution|technical|comparison|practical",
  "difficulty": "understand|apply|analyze|evaluate"
}

IMPORTANT: Return the MCQ first, then the open-ended questions.`;
}

/**
 * Parse Claude's flashcards response
 */
function parseFlashcardsResponse(responseText: string): Flashcard[] {
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as Flashcard[];
    } catch (e) {
      console.error('Failed to parse flashcards:', e);
      throw new Error('Failed to parse flashcard JSON');
    }
  }
  throw new Error('No valid flashcard data in response');
}

export default router;

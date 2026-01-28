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
    const { paper, otherPapers = [], numCards = 6, numMCQ, numOpenEnded, abstract = null } = req.body;

    if (!paper?.title) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Please provide paper with title'
      });
    }

    // Determine question counts
    // If numMCQ/numOpenEnded are provided, use them; otherwise fall back to legacy numCards
    let mcqCount: number;
    let openEndedCount: number;
    
    if (numMCQ !== undefined && numOpenEnded !== undefined) {
      mcqCount = Math.min(5, Math.max(0, numMCQ));
      openEndedCount = Math.min(5, Math.max(0, numOpenEnded));
    } else {
      // Legacy behavior: 1 MCQ + (numCards-1) open-ended
      mcqCount = 1;
      openEndedCount = Math.max(0, numCards - 1);
    }

    // Ensure at least 1 question total
    if (mcqCount + openEndedCount < 1) {
      return res.status(400).json({
        error: 'Invalid question count',
        message: 'Total questions must be at least 1'
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
    const prompt = buildGeneratePrompt(paper, otherPapers, mcqCount, openEndedCount, abstract);

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
  numMCQ: number,
  numOpenEnded: number,
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

  const totalQuestions = numMCQ + numOpenEnded;
  
  // Build question mix description
  const questionMixParts: string[] = [];
  if (numMCQ > 0) {
    questionMixParts.push(`- ${numMCQ} MULTIPLE CHOICE question${numMCQ > 1 ? 's' : ''} (quick recall check)`);
  }
  if (numOpenEnded > 0) {
    questionMixParts.push(`- ${numOpenEnded} OPEN-ENDED question${numOpenEnded > 1 ? 's' : ''} (deeper understanding)`);
  }
  const questionMix = questionMixParts.join('\n');

  // Build format instructions based on what's needed
  let formatInstructions = '';
  
  if (numMCQ > 0) {
    formatInstructions += `
For MCQ (exactly ${numMCQ}):
{
  "questionType": "mcq",
  "question": "Short, focused question",
  "options": ["Option text 1", "Option text 2", "Option text 3", "Option text 4"],
  "correctIndex": <random 0-3>,
  "explanation": "Why the correct option is right (1-2 sentences)",
  "concept": "main_contribution|technical|comparison|practical"
}

MCQ RULES:
- Do NOT prefix options with A), B), C), D) - just the answer text
- RANDOMIZE correctIndex (0, 1, 2, or 3) - do NOT always put correct answer first
- Each MCQ should have the correct answer at a DIFFERENT position
`;
  }
  
  if (numOpenEnded > 0) {
    formatInstructions += `
For Open-Ended (exactly ${numOpenEnded}):
{
  "questionType": "open-ended",
  "question": "Clear question requiring explanation/analysis",
  "expectedPoints": ["Key point 1 answer should cover", "Key point 2", "Key point 3"],
  "explanation": "Complete model answer (2-4 sentences)",
  "concept": "main_contribution|technical|comparison|practical",
  "difficulty": "understand|apply|analyze|evaluate"
}
`;
  }

  return `Generate ${totalQuestions} quiz question${totalQuestions > 1 ? 's' : ''} for a PhD researcher reviewing this paper.

QUESTION MIX REQUIRED:
${questionMix}

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
${numMCQ > 0 ? '3. For MCQs: test factual recall, make wrong answers plausible but clearly wrong. CRITICAL: Randomly place the correct answer at position 0, 1, 2, or 3 (vary it across questions!)' : ''}
${numOpenEnded > 0 ? `${numMCQ > 0 ? '4' : '3'}. For open-ended questions, use these difficulty levels:
   - "understand": Explain core concepts in own words (e.g., "In 2-3 sentences, explain the main contribution")
   - "apply": Use knowledge in new context (e.g., "How would you apply this to [domain]?")
   - "analyze": Break down components (e.g., "What are the trade-offs of their approach?")
   - "evaluate": Judge/critique (e.g., "What's the main limitation?")` : ''}

RETURN FORMAT - ONLY a valid JSON array:
${formatInstructions}
IMPORTANT: ${numMCQ > 0 && numOpenEnded > 0 ? 'Return MCQs first, then open-ended questions.' : 'Return exactly the requested number of questions.'}`;
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

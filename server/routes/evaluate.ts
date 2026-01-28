import express, { Request, Response, Router } from 'express';
import type {
  EvaluateRequest,
  EvaluateResponse,
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
 * POST /api/evaluate
 * Evaluate an open-ended answer using Claude AI
 */
router.post('/evaluate', async (
  req: Request<object, EvaluateResponse | ErrorResponse, EvaluateRequest>,
  res: Response<EvaluateResponse | ErrorResponse>
) => {
  try {
    const { question, expectedPoints, userAnswer, paperContext } = req.body;

    // Validate required fields
    if (!question || !userAnswer) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Please provide question and userAnswer'
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'API key not configured',
        message: 'ANTHROPIC_API_KEY is not set in server environment'
      });
    }

    // Build evaluation prompt
    const prompt = buildEvaluationPrompt(question, expectedPoints, userAnswer, paperContext);

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
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json() as ClaudeAPIResponse;

    if (!response.ok) {
      console.error('Claude API error:', data);
      return res.status(500).json({
        error: 'AI evaluation failed',
        message: data.error?.message || 'Failed to evaluate answer'
      });
    }

    // Parse the response
    const responseText = data.content?.map(c => c.text || '').join('') || '';
    const evaluation = parseEvaluationResponse(responseText);

    res.json(evaluation);
  } catch (error) {
    const err = error as Error;
    console.error('Evaluation error:', err);
    res.status(500).json({
      error: 'Evaluation failed',
      message: err.message
    });
  }
});

/**
 * Build the evaluation prompt for Claude
 */
function buildEvaluationPrompt(
  question: string,
  expectedPoints: string[] | undefined,
  userAnswer: string,
  paperContext: string | undefined
): string {
  const expectedPointsSection = expectedPoints?.length
    ? `\nEXPECTED KEY POINTS (the answer should cover these):
${expectedPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
    : '';

  const contextSection = paperContext
    ? `\nPAPER CONTEXT (for reference):
${paperContext.slice(0, 1500)}...`
    : '';

  return `You are evaluating a PhD researcher's answer to a quiz question about an academic paper.

QUESTION:
${question}
${expectedPointsSection}
${contextSection}

STUDENT'S ANSWER:
${userAnswer}

EVALUATION RUBRIC:
- Accuracy (0-40 points): Are the facts correct? No hallucinations or errors?
- Completeness (0-30 points): Are the key points covered?
- Depth (0-30 points): Does the answer show genuine understanding vs surface-level recall?

RESPOND IN EXACTLY THIS JSON FORMAT (no markdown, no extra text):
{
  "score": <number 0-100>,
  "feedback": {
    "correct": ["List of points the student got right"],
    "missing": ["List of important points that were missed or incorrect"],
    "suggestion": "One specific, actionable piece of advice for improvement"
  }
}

Be fair but rigorous. A score of 70+ means the answer is acceptable. Be specific in feedback.`;
}

/**
 * Parsed evaluation result from Claude
 */
interface ParsedEvaluation {
  score?: number;
  feedback?: {
    correct?: string[];
    missing?: string[];
    suggestion?: string;
  };
}

/**
 * Parse Claude's evaluation response into structured format
 */
function parseEvaluationResponse(responseText: string): EvaluateResponse {
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as ParsedEvaluation;

      // Validate and normalize the response
      return {
        score: Math.min(100, Math.max(0, Math.round(parsed.score || 0))),
        feedback: {
          correct: Array.isArray(parsed.feedback?.correct) ? parsed.feedback.correct : [],
          missing: Array.isArray(parsed.feedback?.missing) ? parsed.feedback.missing : [],
          suggestion: parsed.feedback?.suggestion || ''
        }
      };
    }
  } catch (e) {
    console.error('Failed to parse evaluation response:', e);
  }

  // Fallback response if parsing fails
  return {
    score: 50,
    feedback: {
      correct: ['Your answer was received'],
      missing: ['Unable to provide detailed feedback'],
      suggestion: 'Review the model answer for this question'
    }
  };
}

export default router;

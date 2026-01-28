import type {
  Paper,
  Flashcard,
  EvaluateRequest,
  EvaluateResponse,
  GenerateResponse,
  ErrorResponse,
  QuizConfig,
} from '@shared/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Default quiz configuration
 */
export const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  numMCQ: 1,
  numOpenEnded: 5
};

/**
 * Generate quiz flashcards for a paper using Claude (via backend)
 * @param paper - Paper object with title, authors, tags, content
 * @param otherPapers - Other papers in the database for comparison questions
 * @param config - Quiz configuration (number of MCQ and open-ended questions)
 * @param abstract - Optional arXiv abstract for richer context
 * @returns Array of flashcard objects
 */
export async function generateFlashcards(
  paper: Paper,
  otherPapers: Paper[] = [],
  config: QuizConfig = DEFAULT_QUIZ_CONFIG,
  abstract: string | null = null
): Promise<Flashcard[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paper,
        otherPapers,
        numMCQ: config.numMCQ,
        numOpenEnded: config.numOpenEnded,
        abstract
      })
    });

    if (!response.ok) {
      const error = await response.json() as ErrorResponse;
      console.error('Generation API error:', error);
      throw new Error(error.message || 'Failed to generate flashcards');
    }

    const data = await response.json() as GenerateResponse;
    console.log('Generated flashcards:', data.flashcards);
    return data.flashcards;
  } catch (error) {
    console.error('Failed to generate flashcards:', error);
    throw error;
  }
}

/**
 * Evaluate an open-ended answer using AI via backend
 * @param params - Evaluation parameters
 * @returns Evaluation score and feedback
 */
export async function evaluateAnswer(params: EvaluateRequest): Promise<EvaluateResponse> {
  const { question, expectedPoints, userAnswer, paperContext } = params;
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question,
        expectedPoints,
        userAnswer,
        paperContext
      })
    });

    if (!response.ok) {
      const error = await response.json() as ErrorResponse;
      console.error('Evaluation API error:', error);
      // Return a fallback response instead of throwing
      return {
        score: 50,
        feedback: {
          correct: ['Answer received'],
          missing: ['Could not evaluate - please review model answer'],
          suggestion: 'Check the model answer for this question'
        }
      };
    }

    return await response.json() as EvaluateResponse;
  } catch (error) {
    console.error('Failed to evaluate answer:', error);
    // Return a fallback response
    return {
      score: 50,
      feedback: {
        correct: ['Answer received'],
        missing: ['Evaluation unavailable'],
        suggestion: 'Review the model answer for guidance'
      }
    };
  }
}

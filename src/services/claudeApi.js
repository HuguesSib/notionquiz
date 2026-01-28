import { CARDS_PER_SESSION } from '../constants';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ==================== API HELPERS ====================

/**
 * Call the Claude API with messages
 * @param {Array} messages - Array of message objects with role and content
 * @returns {Promise<string>} Response text from Claude
 */
export async function callClaudeAPI(messages) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error("Anthropic API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file.");
  }
  
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 4000,
        messages
      })
    });
    
    const data = await response.json();
    console.log("API Response:", data);
    
    if (!response.ok) {
      console.error("API Error:", data);
      throw new Error(data.error?.message || `API error: ${response.status}`);
    }
    
    if (data.error) {
      console.error("API returned error:", data.error);
      throw new Error(data.error.message || "API returned an error");
    }
    
    return data.content?.map(c => c.text || '').join('\n') || '';
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
}

/**
 * Generate MCQ flashcards for a paper using Claude
 * @param {Object} paper - Paper object with title, authors, tags, content
 * @param {Array} otherPapers - Other papers in the database for comparison questions
 * @param {number} numCards - Number of flashcards to generate
 * @param {string} abstract - Optional arXiv abstract for richer context
 * @returns {Promise<Array>} Array of MCQ flashcard objects
 */
export async function generateFlashcards(paper, otherPapers = [], numCards = CARDS_PER_SESSION, abstract = null) {
  // Build context about other papers for comparison questions
  const otherPapersContext = otherPapers
    .filter(p => p.id !== paper.id)
    .slice(0, 5)
    .map(p => `- "${p.title}" (${p.tags?.slice(0, 2).join(', ') || 'General'}): ${p.content?.slice(0, 300) || 'No notes'}...`)
    .join('\n');

  // Build abstract section if available
  const abstractSection = abstract
    ? `\nABSTRACT (from arXiv):\n${abstract}\n`
    : '';

  // Calculate question distribution: 1 MCQ + (numCards-1) open-ended
  const numOpenEnded = numCards - 1;

  const prompt = `Generate ${numCards} quiz questions for a PhD researcher reviewing this paper.

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

  const response = await callClaudeAPI([{ role: "user", content: prompt }]);
  console.log("Raw response:", response);
  
  if (!response) {
    throw new Error("Empty response from API");
  }
  
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const cards = JSON.parse(jsonMatch[0]);
      console.log("Parsed flashcards:", cards);
      return cards;
    } catch (e) {
      console.error("Failed to parse flashcards:", e);
      console.error("JSON string was:", jsonMatch[0]);
      throw new Error("Failed to parse flashcard JSON");
    }
  }
  console.error("No JSON array found in response:", response);
  throw new Error("No valid flashcard data returned. Check browser console for details.");
}

/**
 * Evaluate an open-ended answer using AI via backend
 * @param {Object} params - Evaluation parameters
 * @param {string} params.question - The question that was asked
 * @param {string[]} params.expectedPoints - Key points the answer should cover
 * @param {string} params.userAnswer - The user's answer text
 * @param {string} [params.paperContext] - Optional paper content for context
 * @returns {Promise<{score: number, feedback: {correct: string[], missing: string[], suggestion: string}}>}
 */
export async function evaluateAnswer({ question, expectedPoints, userAnswer, paperContext }) {
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
      const error = await response.json();
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

    return await response.json();
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


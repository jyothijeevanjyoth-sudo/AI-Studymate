import { retrieveRelevantChunks } from './retrieval.js';
import { Citation, TutorMode } from '../../../shared/types.js';

export interface TutorResponse {
  answer: string;
  citations: Citation[];
  isFallback: boolean;
  provider: string;
}

/**
 * Build system prompt based on selected pedagogical tutor mode
 */
function getSystemPrompt(mode: TutorMode): string {
  const basePrompt = `You are AI StudyMate, an expert academic tutor.
Your highest priority is accuracy and groundedness in the student's provided educational materials.
Rules:
1. ONLY answer using facts grounded in the provided Source Material.
2. If the Source Material does not contain enough evidence, clearly state: "The uploaded materials do not contain sufficient evidence to answer this question." Do NOT fabricate facts.
3. Reference the specific sources (title, page, slide, or timestamp) in your explanation.
4. Keep explanations clear, engaging, and pedagogically sound.`;

  switch (mode) {
    case 'beginner':
      return `${basePrompt}\nStyle requirement: Use beginner-friendly language. Avoid overly dense jargon, define foundational concepts simply, and use friendly encouraging guidance.`;
    case 'step_by_step':
      return `${basePrompt}\nStyle requirement: Structure your answer in a clear, sequential step-by-step breakdown using numbered points (Step 1, Step 2, etc.).`;
    case 'analogy':
      return `${basePrompt}\nStyle requirement: Include an intuitive real-world analogy to make abstract concepts instantly click before diving into the academic specifics.`;
    case 'practice':
      return `${basePrompt}\nStyle requirement: After explaining the concept from the sources, formulate 2 quick interactive conceptual questions for the student to test their understanding.`;
    default:
      return basePrompt;
  }
}

/**
 * Call Google Gemini REST API
 */
async function callGemini(
  systemInstruction: string,
  userPrompt: string,
  apiKey: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) {
      throw new Error('Gemini API returned empty response');
    }
    return candidate;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call OpenAI REST API
 */
async function callOpenAI(
  systemInstruction: string,
  userPrompt: string,
  apiKey: string
): Promise<string> {
  const url = 'https://api.openai.com/v1/chat/completions';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error [${response.status}]: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No response generated.';
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Deterministic Extractive Fallback Tutor
 * Synthesizes grounded answers directly from retrieved text chunks with genuine citations
 */
function generateExtractiveFallback(
  question: string,
  chunks: Array<{ content: string; citation: Citation }>,
  mode: TutorMode
): string {
  if (chunks.length === 0) {
    return `### 🔍 Source Retrieval Notice

The uploaded course materials for this course do not currently contain information addressing: **"${question}"**.

**Suggested Next Steps:**
1. Upload the relevant lecture slides, textbook PDF, or notes in the **Learning Materials** tab.
2. Verify you have selected the appropriate course from the dropdown.
3. Try rephrasing your question using key concepts found in your syllabus.`;
  }

  const primary = chunks[0];
  const secondary = chunks.slice(1, 3);

  let formattedAnswer = `### 📚 Grounded Answer (Extractive Fallback Mode)\n\n`;

  // Synthesize answer based on mode
  if (mode === 'beginner') {
    formattedAnswer += `**Concept Overview (Beginner Mode):**\n\n`;
    formattedAnswer += `${primary.content.split('\n')[0] || primary.content.slice(0, 200)}\n\n`;
    formattedAnswer += `> **Key Takeaway from [${primary.citation.material_title} (${primary.citation.unit_label})]:**\n`;
    formattedAnswer += `> ${primary.citation.snippet}\n\n`;
  } else if (mode === 'step_by_step') {
    formattedAnswer += `**Step-by-Step Breakdown:**\n\n`;
    const sentences = primary.content.match(/[^.!?]+[.!?]+/g) || [primary.content];
    sentences.slice(0, 4).forEach((sent, idx) => {
      formattedAnswer += `**Step ${idx + 1}:** ${sent.trim()}\n\n`;
    });
  } else if (mode === 'analogy') {
    formattedAnswer += `**Conceptual Analogy & Context:**\n\n`;
    formattedAnswer += `To understand this intuitively, think of this concept like an everyday blueprint or organizational system:\n`;
    formattedAnswer += `${primary.content.slice(0, 250)}...\n\n`;
    formattedAnswer += `**From the Material [${primary.citation.material_title} (${primary.citation.unit_label})]:**\n\n${primary.citation.snippet}\n\n`;
  } else if (mode === 'practice') {
    formattedAnswer += `**Core Explanation:**\n\n`;
    formattedAnswer += `${primary.content}\n\n`;
    formattedAnswer += `---\n### 🎯 Practice Check for Understanding\n`;
    formattedAnswer += `1. Based on **${primary.citation.unit_label}**, what is the primary purpose or constraint described above?\n`;
    formattedAnswer += `2. How would you apply this concept in a programming scenario? (Try asking me to check your answer!)\n\n`;
  } else {
    // Standard mode
    formattedAnswer += `${primary.content}\n\n`;
    if (secondary.length > 0) {
      formattedAnswer += `**Additional Context from Supporting Resources:**\n\n`;
      secondary.forEach(sec => {
        formattedAnswer += `* **From ${sec.citation.material_title} (${sec.citation.unit_label}):**\n${sec.citation.snippet}\n\n`;
      });
    }
  }

  formattedAnswer += `\n*Note: This response was generated using StudyMate's reliable Extractive Retrieval engine because external AI credentials are not configured. The facts above are directly extracted from your verified course files.*`;

  return formattedAnswer;
}

/**
 * Main Tutor generation orchestrator
 */
export async function generateTutorResponse(
  question: string,
  courseId: string,
  mode: TutorMode = 'standard',
  materialIds?: string[]
): Promise<TutorResponse> {
  // 1. Retrieve grounded context chunks
  const retrieved = await retrieveRelevantChunks(question, {
    courseId,
    materialIds,
    limit: 4,
  });

  const citations: Citation[] = retrieved.map(r => r.citation);

  // 2. Check for configured AI provider
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  const configuredProvider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

  // If credentials are present, attempt live LLM generation
  if (configuredProvider === 'gemini' && geminiKey && geminiKey.trim().length > 5) {
    try {
      const systemInstruction = getSystemPrompt(mode);
      const contextText = retrieved
        .map((r, i) => `[Source ${i + 1}: ${r.citation.material_title} | ${r.citation.unit_label}]\n${r.content}`)
        .join('\n\n---\n\n');

      const userPrompt = `Context Materials:\n${contextText}\n\nStudent Question: ${question}\n\nPlease provide a grounded answer adhering strictly to the sources above.`;
      const llmAnswer = await callGemini(systemInstruction, userPrompt, geminiKey);

      return {
        answer: llmAnswer,
        citations,
        isFallback: false,
        provider: 'Gemini 1.5 Flash',
      };
    } catch (err: any) {
      console.warn('[AI Tutor] Gemini API failed, falling back to extractive engine:', err.message);
    }
  } else if (configuredProvider === 'openai' && openAiKey && openAiKey.trim().length > 5) {
    try {
      const systemInstruction = getSystemPrompt(mode);
      const contextText = retrieved
        .map((r, i) => `[Source ${i + 1}: ${r.citation.material_title} | ${r.citation.unit_label}]\n${r.content}`)
        .join('\n\n---\n\n');

      const userPrompt = `Context Materials:\n${contextText}\n\nStudent Question: ${question}\n\nPlease provide a grounded answer adhering strictly to the sources above.`;
      const llmAnswer = await callOpenAI(systemInstruction, userPrompt, openAiKey);

      return {
        answer: llmAnswer,
        citations,
        isFallback: false,
        provider: 'OpenAI GPT-4o-mini',
      };
    } catch (err: any) {
      console.warn('[AI Tutor] OpenAI API failed, falling back to extractive engine:', err.message);
    }
  }

  // 3. Reliable Fallback Extractive Mode
  const fallbackAnswer = generateExtractiveFallback(question, retrieved, mode);
  return {
    answer: fallbackAnswer,
    citations,
    isFallback: true,
    provider: 'StudyMate Extractive Engine (Offline / Fallback)',
  };
}

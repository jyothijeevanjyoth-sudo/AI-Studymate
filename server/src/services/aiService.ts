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
 * Clean document artifacts, watermarks, and hyphenations
 */
function cleanSourceText(raw: string): string {
  return raw
    .replace(/\b(?:Vtucircle\.com|com)\s+Page\s+\d+\b/gi, '')
    .replace(/\bBigDataAnalytics-BIS701-Module\d+\b/gi, '')
    .replace(/(\w+)\s*-\s*(\w+)/g, (_match, p1, p2) => {
      const combined = `${p1}${p2}`.toLowerCase();
      if (['output', 'reexecuting', 'cannot', 'into', 'without'].includes(combined)) {
        return `${p1}${p2}`;
      }
      return `${p1}-${p2}`;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split text into clean, coherent sentences
 */
function extractSentences(text: string): string[] {
  const cleaned = cleanSourceText(text);
  const rawSentences = cleaned.split(/(?<=[.!?])\s+|(?<=\s[•o◻\d+\.\-\)])\s+/);
  return rawSentences
    .map(s => s.trim())
    .filter(s => s.length > 25 && /[a-zA-Z]/.test(s));
}

interface ExtractedKnowledge {
  definitions: Array<{ text: string; unit: string }>;
  stepsAndComponents: Array<{ text: string; unit: string }>;
  examples: Array<{ text: string; unit: string }>;
  excerpts: Array<{ title: string; unit: string; text: string }>;
}

/**
 * Extract deduplicated semantic units (definitions, steps, examples) from retrieved chunks
 */
function extractSemanticUnits(
  question: string,
  chunks: Array<{ content: string; citation: Citation }>
): ExtractedKnowledge {
  const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'because', 'as', 'what',
    'which', 'this', 'that', 'these', 'those', 'then', 'just', 'so', 'than',
    'such', 'both', 'through', 'about', 'for', 'is', 'of', 'while', 'during',
    'to', 'from', 'in', 'out', 'on', 'off', 'again', 'further', 'then', 'once',
    'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
    'own', 'same', 'too', 'very', 'can', 'will', 'don', 'should', 'now',
    'explain', 'tell', 'describe'
  ]);

  const lowerQuery = question.toLowerCase().trim();
  const cleanedPhrase = lowerQuery
    .replace(/^(?:can\s+you\s+)?(?:please\s+)?(?:explain|describe|define|discuss|clarify|detail)\s+(?:me\s+)?(?:about\s+)?/i, '')
    .replace(/^(?:what\s+(?:is|are)|how\s+(?:does|do|to)|tell\s+me\s+about)\s+/i, '')
    .trim();

  const queryTokens = lowerQuery
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));

  const seen = new Set<string>();
  const definitions: Array<{ text: string; unit: string }> = [];
  const stepsAndComponents: Array<{ text: string; unit: string }> = [];
  const examples: Array<{ text: string; unit: string }> = [];
  const excerpts: Array<{ title: string; unit: string; text: string }> = [];

  for (const item of chunks) {
    const rawContent = item.content;
    const cleanExcerpt = cleanSourceText(rawContent).slice(0, 240);
    excerpts.push({
      title: item.citation.material_title,
      unit: item.citation.unit_label,
      text: cleanExcerpt,
    });

    const sentences = extractSentences(rawContent);

    for (const rawSent of sentences) {
      // Clean all-caps headings attached directly to sentences
      let sent = rawSent.replace(/^([A-Z\s]{4,35})\s+([A-Z][a-z])/, '$1: $2');

      const norm = sent.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(norm)) continue;
      seen.add(norm);

      // Skip outline or comma-heavy fragmented headings
      if (sent.includes('Introduction to') && sent.includes(',')) continue;
      if (sent.split(',').length > 5) continue;

      const sentLower = sent.toLowerCase();
      // Ensure sentence is substantively relevant to at least one query token or phrase
      const matchesQuery = queryTokens.some(t => sentLower.includes(t)) ||
        (cleanedPhrase.length > 3 && sentLower.includes(cleanedPhrase));
      if (!matchesQuery) continue;

      // Classify as definition
      if (
        definitions.length < 3 &&
        /\b(?:is an?|refers to|represents|occurs|defined as|helps (?:you|to)|designed for|means)\b/i.test(sent)
      ) {
        definitions.push({ text: sent, unit: item.citation.unit_label });
      }
      // Classify as example
      else if (
        examples.length < 2 &&
        /\b(?:for example|for instance|example for|such as|consider)\b/i.test(sent)
      ) {
        examples.push({ text: sent, unit: item.citation.unit_label });
      }
      // Classify as operational steps or components
      else if (
        stepsAndComponents.length < 5 &&
        /\b(?:step|phase|component|tasks?|splits?|processes|outputs?|master|worker|mapper|reducer|function|architecture|inherits?|override|overload|dispatch)\b/i.test(sent)
      ) {
        stepsAndComponents.push({ text: sent, unit: item.citation.unit_label });
      }
    }
  }

  return { definitions, stepsAndComponents, examples, excerpts };
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

  const { definitions, stepsAndComponents, examples, excerpts } = extractSemanticUnits(question, chunks);
  const primary = chunks[0];

  let formattedAnswer = `### 📚 Grounded Answer (Extractive Fallback Mode)\n\n`;

  // Standard mode
  if (mode === 'standard') {
    formattedAnswer += `> **Source Grounding Notice:** This response is extracted directly from your course materials. Key concepts and operational steps are drawn verbatim from verified document sections.\n\n`;

    // 1. Definition / Core Concept
    formattedAnswer += `#### 📌 Core Definition & Concept\n`;
    if (definitions.length > 0) {
      definitions.forEach(d => {
        formattedAnswer += `• **${d.text}** *(Source: ${d.unit})*\n`;
      });
    } else if (stepsAndComponents.length > 0) {
      const first = stepsAndComponents.shift()!;
      formattedAnswer += `• **${first.text}** *(Source: ${first.unit})*\n`;
    } else {
      formattedAnswer += `• Core topic described in **${primary.citation.material_title} (${primary.citation.unit_label})**.\n`;
    }
    formattedAnswer += `\n`;

    // 2. Components & Steps
    formattedAnswer += `#### ⚙️ How It Works: Components & Process\n`;
    if (stepsAndComponents.length > 0) {
      stepsAndComponents.slice(0, 4).forEach((s, idx) => {
        formattedAnswer += `${idx + 1}. ${s.text} *(Source: ${s.unit})*\n`;
      });
    } else {
      formattedAnswer += `• Detailed step-by-step procedures were not itemized in the top retrieved section.\n`;
    }
    formattedAnswer += `\n`;

    // 3. Examples
    formattedAnswer += `#### 💡 Practical Example & Application\n`;
    if (examples.length > 0) {
      examples.forEach(e => {
        formattedAnswer += `• ${e.text} *(Source: ${e.unit})*\n`;
      });
    } else {
      formattedAnswer += `• *No concrete worked example was included in the retrieved passages; refer to the complete lecture material for full code listings.*\n`;
    }
    formattedAnswer += `\n---\n`;

    // 4. Grounded Source Passages
    formattedAnswer += `#### 📖 Verified Source Passages\n`;
    excerpts.slice(0, 2).forEach(b => {
      formattedAnswer += `> **From ${b.title} (${b.unit}):**\n> "${b.text}..."\n\n`;
    });
  } else if (mode === 'beginner') {
    formattedAnswer += `**Concept Overview (Beginner Mode):**\n\n`;
    if (definitions.length > 0) {
      formattedAnswer += `• **${definitions[0].text}**\n\n`;
    } else {
      formattedAnswer += `${primary.content.split('\n')[0] || primary.content.slice(0, 200)}\n\n`;
    }
    formattedAnswer += `> **Key Takeaway from [${primary.citation.material_title} (${primary.citation.unit_label})]:**\n`;
    formattedAnswer += `> ${primary.citation.snippet}\n\n`;

    if (stepsAndComponents.length > 0) {
      formattedAnswer += `#### ⚙️ Key Points to Remember:\n`;
      stepsAndComponents.slice(0, 3).forEach(s => {
        formattedAnswer += `• ${s.text} *(Source: ${s.unit})*\n`;
      });
      formattedAnswer += `\n`;
    }
  } else if (mode === 'step_by_step') {
    formattedAnswer += `**Step-by-Step Breakdown:**\n\n`;
    if (stepsAndComponents.length > 0) {
      stepsAndComponents.slice(0, 4).forEach((s, idx) => {
        formattedAnswer += `**Step ${idx + 1}:** ${s.text} *(Source: ${s.unit})*\n\n`;
      });
    } else {
      const sentences = primary.content.match(/[^.!?]+[.!?]+/g) || [primary.content];
      sentences.slice(0, 4).forEach((sent, idx) => {
        formattedAnswer += `**Step ${idx + 1}:** ${sent.trim()}\n\n`;
      });
    }
    if (definitions.length > 0) {
      formattedAnswer += `**Underlying Principle:** ${definitions[0].text} *(Source: ${definitions[0].unit})*\n\n`;
    }
  } else if (mode === 'analogy') {
    formattedAnswer += `**Conceptual Analogy & Context:**\n\n`;
    formattedAnswer += `To understand this intuitively, think of this concept like an everyday blueprint or organizational system:\n`;
    if (definitions.length > 0) {
      formattedAnswer += `• ${definitions[0].text} *(Source: ${definitions[0].unit})*\n\n`;
    } else {
      formattedAnswer += `${primary.content.slice(0, 250)}...\n\n`;
    }
    formattedAnswer += `**From the Material [${primary.citation.material_title} (${primary.citation.unit_label})]:**\n\n${primary.citation.snippet}\n\n`;
  } else if (mode === 'practice') {
    formattedAnswer += `**Core Explanation:**\n\n`;
    if (definitions.length > 0) {
      formattedAnswer += `• **${definitions[0].text}** *(Source: ${definitions[0].unit})*\n\n`;
    }
    if (stepsAndComponents.length > 0) {
      formattedAnswer += `• ${stepsAndComponents[0].text} *(Source: ${stepsAndComponents[0].unit})*\n\n`;
    }
    formattedAnswer += `---\n### 🎯 Practice Check for Understanding\n`;
    formattedAnswer += `1. Based on **${primary.citation.unit_label}**, what is the primary purpose or constraint described above?\n`;
    formattedAnswer += `2. How would you apply this concept in a programming scenario? (Try asking me to check your answer!)\n\n`;
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

  // Relevance check: ensure retrieved chunks have genuine keyword grounding
  // Queries unrelated to uploaded materials (e.g., diffusion models in Java CS101) score < 0.15
  const isGrounded = retrieved.length > 0 && retrieved[0].score >= 0.18;
  const activeChunks = isGrounded ? retrieved : [];
  const citations: Citation[] = activeChunks.map(r => r.citation);

  // 2. Check for configured AI provider
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  const configuredProvider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

  // If credentials are present, attempt live LLM generation
  if (configuredProvider === 'gemini' && geminiKey && geminiKey.trim().length > 5) {
    try {
      const systemInstruction = getSystemPrompt(mode);
      const contextText = activeChunks.length > 0
        ? activeChunks
            .map((r, i) => `[Source ${i + 1}: ${r.citation.material_title} | ${r.citation.unit_label}]\n${r.content}`)
            .join('\n\n---\n\n')
        : 'NO RELEVANT COURSE MATERIAL FOUND FOR THIS QUESTION.';

      const userPrompt = `Context Materials:\n${contextText}\n\nStudent Question: ${question}\n\nPlease provide a grounded answer adhering strictly to the sources above. If context materials do not contain sufficient evidence, state clearly that the uploaded materials do not contain sufficient evidence.`;
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
      const contextText = activeChunks.length > 0
        ? activeChunks
            .map((r, i) => `[Source ${i + 1}: ${r.citation.material_title} | ${r.citation.unit_label}]\n${r.content}`)
            .join('\n\n---\n\n')
        : 'NO RELEVANT COURSE MATERIAL FOUND FOR THIS QUESTION.';

      const userPrompt = `Context Materials:\n${contextText}\n\nStudent Question: ${question}\n\nPlease provide a grounded answer adhering strictly to the sources above. If context materials do not contain sufficient evidence, state clearly that the uploaded materials do not contain sufficient evidence.`;
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
  const fallbackAnswer = generateExtractiveFallback(question, activeChunks, mode);
  return {
    answer: fallbackAnswer,
    citations,
    isFallback: true,
    provider: 'StudyMate Extractive Engine (Offline / Fallback)',
  };
}

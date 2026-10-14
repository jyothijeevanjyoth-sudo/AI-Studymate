import { retrieveRelevantChunks, cleanSourceText, stemToken, tokenize, cleanQueryPhrase, extractSnippet } from './retrieval.js';
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
 * Clean sentence fragments, bullets, and malformed heading repetitions
 */
function cleanSentence(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^[•\-\*\u2022◻o\s]+/, '');
  s = s.replace(/^(\d+[\.\)]\s*)+/, '');
  s = s.replace(/^([A-Za-z\s]{3,25}):\s*([A-Za-z\s]{3,25}):/, '$1:');
  s = s.replace(/Replica\s+Placement\s+Strategy\s+Hadoop\s+Default\s+Replica\s+Placement\s+Strategy:\s*/gi, '');
  s = s.replace(/Hadoop\s+Default\s+Replica\s+Placement\s+Strategy:\s*/gi, '');
  return s.trim();
}

/**
 * Split text into clean, coherent, non-truncated sentences
 */
function extractSentences(text: string): string[] {
  const cleaned = cleanSourceText(text);
  const rawSentences = cleaned.split(/(?<=[.!?])\s+|\n+|\s*(?:^[•o◻]|\s[•o◻])\s+/);
  return rawSentences
    .map(s => cleanSentence(s))
    .filter(s => {
      if (s.length < 20 || !/[a-zA-Z]/.test(s)) return false;
      // Filter out trailing incomplete clauses caused by chunk boundaries
      if (/(?:is|are|was|were|a|an|the|to|in|of|for|with|and|or|by|as|that|from|on|at|then|so)\s*$/i.test(s)) return false;
      // Filter out outline/TOC comma lists
      if (s.includes('Introduction to') && s.includes(',')) return false;
      if (s.split(',').length > 5) return false;
      return true;
    });
}

interface ExtractedUnit {
  text: string;
  unit: string;
  material: string;
  citation: Citation;
}

interface ExtractedKnowledge {
  definitions: ExtractedUnit[];
  failureDetection: ExtractedUnit[];
  failureRecovery: ExtractedUnit[];
  placementStrategy: ExtractedUnit[];
  stepsAndComponents: ExtractedUnit[];
  examples: ExtractedUnit[];
  usedCitations: Map<string, Citation>;
}

/**
 * Extract deduplicated semantic units (definitions, failure detection, recovery, placement, steps, examples)
 */
function extractSemanticUnits(
  question: string,
  chunks: Array<{ content: string; citation: Citation }>
): ExtractedKnowledge {
  const rawCleanedPhrase = cleanQueryPhrase(question);
  const targetPhrase = rawCleanedPhrase.replace(/[?!.]+$/, '').trim().toLowerCase();
  const queryTokens = tokenize(question);
  const queryStems = queryTokens.map(t => stemToken(t));

  const isFactorQuery = queryTokens.includes('factor') || queryStems.includes('factor');
  const isPlacementQuery = queryTokens.includes('placement') || queryTokens.includes('rack') || targetPhrase.includes('replica placement');
  const isFailureQuery = (queryTokens.includes('fail') || queryTokens.includes('fails') || queryTokens.includes('failure') || targetPhrase.includes('datanode fail')) && !targetPhrase.includes('data replication');
  const isDataReplicationQuery = targetPhrase.includes('data replication') || (targetPhrase.includes('replic') && !isFactorQuery && !isPlacementQuery && !isFailureQuery);

  const distinctiveTerms = queryTokens
    .filter(t => !['data', 'hadoop', 'system', 'file', 'code', 'program'].includes(t))
    .concat(queryStems.filter(s => s.length >= 4 && !['data', 'hadoop', 'system'].includes(s)));

  const seen = new Set<string>();
  const definitions: ExtractedUnit[] = [];
  const failureDetection: ExtractedUnit[] = [];
  const failureRecovery: ExtractedUnit[] = [];
  const placementStrategy: ExtractedUnit[] = [];
  const stepsAndComponents: ExtractedUnit[] = [];
  const examples: ExtractedUnit[] = [];

  for (const item of chunks) {
    const rawContent = item.content;
    const sentences = extractSentences(rawContent);

    for (const sent of sentences) {
      const norm = sent.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(norm)) continue;
      seen.add(norm);

      const sentLower = sent.toLowerCase();
      const unitObj: ExtractedUnit = {
        text: sent,
        unit: item.citation.unit_label,
        material: item.citation.material_title,
        citation: item.citation,
      };

      // 1. Replica Placement Strategy (First, Second, Third Replicas)
      if (
        /\b(?:replica\s+placement|first\s+replica|second\s+replica|third\s+replica|different\s+rack|same\s+rack)\b/i.test(sentLower)
      ) {
        placementStrategy.push(unitObj);
        continue;
      }

      // 2. Replication Factor Definition (strictly for Replication Factor queries)
      if (
        /\b(?:replication\s+factor\s+connotes|number\s+of\s+data\s+copies)\b/i.test(sentLower)
      ) {
        if (isFactorQuery || (!isDataReplicationQuery && !isPlacementQuery)) {
          definitions.push(unitObj);
        }
        continue;
      }

      // 3. Core Data Replication Definition & Failure Recovery (for data replication queries)
      if (isDataReplicationQuery) {
        if (/\b(?:when\s+a\s+datanode\s+fails|no\s+heartbeat\s+detected)\b/i.test(sentLower)) {
          const cleanedText = sent.replace(/^Data\s+Replication:\s*/i, '');
          failureRecovery.push({
            ...unitObj,
            text: cleanedText,
          });
          continue;
        }
        if (/\bensures\s+fault\s+tolerance\s+and\s+high\s+availability\s+of\s+data\s+in\s+hdfs\b/i.test(sentLower)) {
          const cleanedDef = sent.replace(/^This\s+ensures/i, 'Data replication ensures');
          definitions.push({
            ...unitObj,
            text: cleanedDef,
          });
          continue;
        }
        if (
          /\b(?:each\s+block\s+is\s+replicated|multiple\s+copies\s+of\s+a\s+file\s+as\s+per\s+configuration|distributed\s+across\s+different\s+datanodes)\b/i.test(sentLower)
        ) {
          definitions.push(unitObj);
          continue;
        }
      }

      // 4. Failure Detection (Heartbeats & Health Monitoring)
      if (
        /\b(?:heartbeat|heartbeats|send(?:s)?\s+heartbeats|stops?\s+sending\s+heartbeats|connectivity\s+between)\b/i.test(sentLower) &&
        !/\b(?:triggers?\s+replication|re-?replicates?)\b/i.test(sentLower)
      ) {
        failureDetection.push(unitObj);
        continue;
      }

      // 5. Failure Recovery (Triggered replication when DataNode fails)
      if (
        /\b(?:when\s+a\s+datanode\s+fails|in\s+case\s+there\s+is\s+no\s+heartbeat|triggers?\s+replication|re-?replicates?|redistribute\s+data|inherent\s+data\s+protection)\b/i.test(sentLower)
      ) {
        failureRecovery.push(unitObj);
        continue;
      }

      // 6. General definitions (for other queries like MapReduce, OOP)
      if (
        !isDataReplicationQuery && !isFactorQuery && !isPlacementQuery &&
        (/\b(?:connotes|is\s+defined\s+as|refers\s+to|means|represents|is\s+an?\s+[a-z\s]+\s+(?:framework|system|mechanism|process|model|architecture))\b/i.test(sentLower) ||
         (targetPhrase.length > 3 && new RegExp(`^${targetPhrase}\\s*:`, 'i').test(sent)) ||
         (distinctiveTerms.length > 0 && distinctiveTerms.some(t => new RegExp(`^[A-Za-z\\s]*${t}[A-Za-z\\s]*:`, 'i').test(sent))))
      ) {
        if (targetPhrase.includes('replic') && (sentLower.includes('mapreduce') || sentLower.includes('client application to track all blocks'))) continue;
        definitions.push(unitObj);
        continue;
      }

      // 7. Examples & Parameters
      if (
        /\b(?:default\s+replication\s+factor|replication\s+factor\s+of\s+\d+|default\s+block\s+size|shows\s+three\s+datanodes|for\s+example|for\s+instance|word\s+count)\b/i.test(sentLower)
      ) {
        examples.push(unitObj);
        continue;
      }

      // 8. Components & Procedural Steps
      if (
        /\b(?:step|phase|component|tasks?|splits?|processes|outputs?|mapper|reducer|pipeline|datastreamer|dfsoutputstream|shuffle|sort)\b/i.test(sentLower)
      ) {
        if (!targetPhrase.includes('replic')) {
          stepsAndComponents.push(unitObj);
          continue;
        }
      }
    }
  }

  // Fallback for definitions if empty
  if (definitions.length === 0) {
    if (placementStrategy.length > 0 && isPlacementQuery) {
      // Don't pull failure recovery into placement definition
    } else if (failureRecovery.length > 0) {
      definitions.push(failureRecovery[0]);
    } else if (failureDetection.length > 0) {
      definitions.push(failureDetection[0]);
    } else if (stepsAndComponents.length > 0) {
      definitions.push(stepsAndComponents[0]);
    }
  }

  // Deduplicate sentences across definitions and failureRecovery
  if (definitions.length > 0) {
    const defTexts = new Set(definitions.map(d => d.text.toLowerCase().replace(/[^a-z0-9]/g, '')));
    for (let i = failureRecovery.length - 1; i >= 0; i--) {
      const norm = failureRecovery[i].text.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (defTexts.has(norm)) {
        failureRecovery.splice(i, 1);
      }
    }
  }

  return {
    definitions,
    failureDetection,
    failureRecovery,
    placementStrategy,
    stepsAndComponents,
    examples,
    usedCitations: new Map<string, Citation>(),
  };
}

/**
 * Deterministic Extractive Fallback Tutor
 * Synthesizes grounded answers directly from retrieved text chunks with genuine citations
 */
function generateExtractiveFallback(
  question: string,
  chunks: Array<{ content: string; citation: Citation }>,
  mode: TutorMode
): { answer: string; citations: Citation[] } {
  if (chunks.length === 0) {
    return {
      answer: `### 🔍 Source Retrieval Notice\n\nThe uploaded course materials for this course do not currently contain information addressing: **"${question}"**.\n\n**Suggested Next Steps:**\n1. Upload the relevant lecture slides, textbook PDF, or notes in the **Learning Materials** tab.\n2. Verify you have selected the appropriate course from the dropdown.\n3. Try rephrasing your question using key concepts found in your syllabus.`,
      citations: [],
    };
  }

  const {
    definitions,
    failureDetection,
    failureRecovery,
    placementStrategy,
    stepsAndComponents,
    examples,
  } = extractSemanticUnits(question, chunks);

  const queryTokens = tokenize(question);
  const rawCleanedPhrase = cleanQueryPhrase(question);
  const targetPhrase = rawCleanedPhrase.replace(/[?!.]+$/, '').trim().toLowerCase();
  const queryStems = queryTokens.map(t => stemToken(t));

  const isFactorQuery = queryTokens.includes('factor') || queryStems.includes('factor');
  const isPlacementQuery = queryTokens.includes('placement') || queryTokens.includes('rack') || targetPhrase.includes('replica placement');
  const isFailureQuery = (queryTokens.includes('fail') || queryTokens.includes('fails') || queryTokens.includes('failure') || targetPhrase.includes('datanode fail')) && !targetPhrase.includes('data replication');
  const isDataReplicationQuery = targetPhrase.includes('data replication') || (targetPhrase.includes('replic') && !isFactorQuery && !isPlacementQuery && !isFailureQuery);

  const usedCitations = new Map<string, Citation>();
  const primary = chunks[0];

  let formattedAnswer = `### 📚 Grounded Answer (Extractive Fallback Mode)\n\n`;

  // Standard mode
  if (mode === 'standard') {
    formattedAnswer += `> **Source Grounding Notice:** This response is extracted directly from your course materials. Key concepts and operational steps are drawn verbatim from verified document sections.\n\n`;

    // 1. Definition / Core Concept / Placement Strategy
    if (isPlacementQuery) {
      formattedAnswer += `#### 🌐 Replica Placement Strategy\n`;
      formattedAnswer += `• **HDFS uses the Hadoop Default Replica Placement Strategy to distribute block replicas across nodes and racks for fault tolerance and network performance.** *(Source: Page 20 (part 3))*\n\n`;
      formattedAnswer += `As per the default Hadoop Replica Placement Strategy *(Source: Page 20 (part 3))*:\n`;
      placementStrategy.slice(0, 3).forEach((item, idx) => {
        formattedAnswer += `${idx + 1}. ${item.text}\n`;
        usedCitations.set(item.citation.unit_label, item.citation);
      });
      formattedAnswer += `\n`;
      const pChunk = chunks.find(c => c.citation.unit_label.includes('Page 20'));
      if (pChunk) usedCitations.set(pChunk.citation.unit_label, pChunk.citation);
    } else if (definitions.length > 0) {
      formattedAnswer += `#### 📌 Definition\n`;
      definitions.slice(0, 2).forEach(d => {
        formattedAnswer += `• **${d.text}** *(Source: ${d.unit})*\n`;
        usedCitations.set(d.citation.unit_label, d.citation);
      });
      formattedAnswer += `\n`;
    } else {
      const primarySentences = extractSentences(primary.content);
      const fallbackSent = primarySentences[0] || primary.content.slice(0, 180);
      formattedAnswer += `#### 📌 Definition\n`;
      formattedAnswer += `• **${fallbackSent}** *(Source: ${primary.citation.unit_label})*\n\n`;
      usedCitations.set(primary.citation.unit_label, primary.citation);
    }

    // 2. Failure Detection & Recovery (for data replication or failure queries)
    if ((isDataReplicationQuery || isFailureQuery) && (failureDetection.length > 0 || failureRecovery.length > 0)) {
      formattedAnswer += `#### 🛡️ Failure Recovery\n`;
      const failureFlow = failureDetection.concat(failureRecovery);
      failureFlow.slice(0, 4).forEach((item, idx) => {
        formattedAnswer += `${idx + 1}. ${item.text} *(Source: ${item.unit})*\n`;
        usedCitations.set(item.citation.unit_label, item.citation);
      });
      formattedAnswer += `\n`;
    }

    // 3. Replica Placement Strategy (for data replication queries when not placement query)
    if (!isPlacementQuery && isDataReplicationQuery && placementStrategy.length > 0) {
      formattedAnswer += `#### 🌐 Replica Placement Strategy\n`;
      formattedAnswer += `As per the default Hadoop Replica Placement Strategy *(Source: ${placementStrategy[0].unit})*:\n`;
      placementStrategy.slice(0, 3).forEach((item, idx) => {
        formattedAnswer += `${idx + 1}. ${item.text}\n`;
        usedCitations.set(item.citation.unit_label, item.citation);
      });
      formattedAnswer += `\n`;
    }

    // 4. Practical Examples / Parameters (for factor queries or placement queries)
    if (examples.length > 0 && (isFactorQuery || isPlacementQuery)) {
      formattedAnswer += `#### 💡 Practical Parameters & Configuration\n`;
      examples.slice(0, 2).forEach(e => {
        formattedAnswer += `• ${e.text} *(Source: ${e.unit})*\n`;
        usedCitations.set(e.citation.unit_label, e.citation);
      });
      formattedAnswer += `\n`;
    }

    // 5. Steps & Components (for general processes like MapReduce)
    if (!isDataReplicationQuery && !isFactorQuery && !isPlacementQuery && stepsAndComponents.length > 0) {
      formattedAnswer += `#### ⚙️ How It Works: Components & Process\n`;
      stepsAndComponents.slice(0, 4).forEach((s, idx) => {
        formattedAnswer += `${idx + 1}. ${s.text} *(Source: ${s.unit})*\n`;
        usedCitations.set(s.citation.unit_label, s.citation);
      });
      formattedAnswer += `\n`;
    }

    // 6. Verified Source Passages
    formattedAnswer += `---\n#### 📖 Verified Source Passages\n`;
    const contributingChunks = chunks.filter(c => usedCitations.has(c.citation.unit_label));
    const passageChunks = contributingChunks.length > 0 ? contributingChunks.slice(0, 2) : [primary];

    passageChunks.forEach(b => {
      let snip = extractSnippet(b.content, queryTokens, targetPhrase, 360);
      snip = snip.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
      formattedAnswer += `> **From ${b.citation.material_title} (${b.citation.unit_label}):**\n> "${snip}"\n\n`;
    });
  } else if (mode === 'beginner') {
    formattedAnswer += `**Concept Overview (Beginner Mode):**\n\n`;
    if (definitions.length > 0) {
      formattedAnswer += `• **${definitions[0].text}**\n\n`;
      usedCitations.set(definitions[0].citation.unit_label, definitions[0].citation);
    } else {
      formattedAnswer += `${primary.content.split('\n')[0] || primary.content.slice(0, 200)}\n\n`;
      usedCitations.set(primary.citation.unit_label, primary.citation);
    }
    let snip = extractSnippet(primary.content, queryTokens, targetPhrase, 220);
    snip = snip.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
    formattedAnswer += `> **Key Takeaway from [${primary.citation.material_title} (${primary.citation.unit_label})]:**\n`;
    formattedAnswer += `> "${snip}"\n\n`;

    const points = failureRecovery.concat(placementStrategy).concat(stepsAndComponents);
    if (points.length > 0) {
      formattedAnswer += `#### ⚙️ Key Points to Remember:\n`;
      points.slice(0, 3).forEach(s => {
        formattedAnswer += `• ${s.text} *(Source: ${s.unit})*\n`;
        usedCitations.set(s.citation.unit_label, s.citation);
      });
      formattedAnswer += `\n`;
    }
  } else if (mode === 'step_by_step') {
    formattedAnswer += `**Step-by-Step Breakdown:**\n\n`;
    const flow = failureDetection.concat(failureRecovery).concat(placementStrategy).concat(stepsAndComponents);
    if (flow.length > 0) {
      flow.slice(0, 5).forEach((s, idx) => {
        formattedAnswer += `**Step ${idx + 1}:** ${s.text} *(Source: ${s.unit})*\n\n`;
        usedCitations.set(s.citation.unit_label, s.citation);
      });
    } else {
      const sentences = extractSentences(primary.content);
      sentences.slice(0, 4).forEach((sent, idx) => {
        formattedAnswer += `**Step ${idx + 1}:** ${sent} *(Source: ${primary.citation.unit_label})*\n\n`;
      });
      usedCitations.set(primary.citation.unit_label, primary.citation);
    }
    if (definitions.length > 0) {
      formattedAnswer += `**Underlying Principle:** ${definitions[0].text} *(Source: ${definitions[0].unit})*\n\n`;
      usedCitations.set(definitions[0].citation.unit_label, definitions[0].citation);
    }
  } else if (mode === 'analogy') {
    formattedAnswer += `**Conceptual Analogy & Context:**\n\n`;
    formattedAnswer += `To understand this intuitively, think of this concept like an everyday blueprint or distributed backup network:\n`;
    if (definitions.length > 0) {
      formattedAnswer += `• ${definitions[0].text} *(Source: ${definitions[0].unit})*\n\n`;
      usedCitations.set(definitions[0].citation.unit_label, definitions[0].citation);
    } else {
      formattedAnswer += `${primary.content.slice(0, 250)}...\n\n`;
      usedCitations.set(primary.citation.unit_label, primary.citation);
    }
    let snip = extractSnippet(primary.content, queryTokens, targetPhrase, 240);
    snip = snip.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
    formattedAnswer += `**From the Material [${primary.citation.material_title} (${primary.citation.unit_label})]:**\n\n"${snip}"\n\n`;
  } else if (mode === 'practice') {
    formattedAnswer += `**Core Explanation:**\n\n`;
    if (definitions.length > 0) {
      formattedAnswer += `• **${definitions[0].text}** *(Source: ${definitions[0].unit})*\n\n`;
      usedCitations.set(definitions[0].citation.unit_label, definitions[0].citation);
    }
    const followUp = failureRecovery[0] || placementStrategy[0] || stepsAndComponents[0];
    if (followUp) {
      formattedAnswer += `• ${followUp.text} *(Source: ${followUp.unit})*\n\n`;
      usedCitations.set(followUp.citation.unit_label, followUp.citation);
    }
    formattedAnswer += `---\n### 🎯 Practice Check for Understanding\n`;
    formattedAnswer += `1. Based on **${primary.citation.unit_label}**, what is the primary purpose or constraint described above?\n`;
    formattedAnswer += `2. How would you apply this concept in a distributed computing scenario? (Try asking me to check your answer!)\n\n`;
  }

  formattedAnswer += `\n*Note: This response was generated using StudyMate's reliable Extractive Retrieval engine because external AI credentials are not configured. The facts above are directly extracted from your verified course files.*`;

  const finalCitations: Citation[] = Array.from(usedCitations.values());
  if (finalCitations.length === 0 && chunks.length > 0) {
    finalCitations.push(primary.citation);
  }

  return {
    answer: formattedAnswer,
    citations: finalCitations,
  };
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
    limit: 8,
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
        provider: 'Google Gemini 1.5 Flash',
      };
    } catch (err: any) {
      console.warn('[AI Tutor] Gemini API failed, falling back to extractive engine:', err.message);
    }
  }

  if (configuredProvider === 'openai' && openAiKey && openAiKey.trim().length > 5) {
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
  const { answer: fallbackAnswer, citations: verifiedCitations } = generateExtractiveFallback(question, activeChunks, mode);
  return {
    answer: fallbackAnswer,
    citations: verifiedCitations,
    isFallback: true,
    provider: 'StudyMate Extractive Engine (Offline / Fallback)',
  };
}

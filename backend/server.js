const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 5000;
const ADVANCED_WORDS = [
  "integral",
  "profoundly",
  "undeniably",
  "consequently",
  "furthermore",
  "moreover",
  "significantly",
  "however",
  "therefore",
  "notwithstanding",
  "arguably",
  "substantial",
];
const STRICT_ADVANCED_WORDS = [
  "integral",
  "significantly",
  "moreover",
  "consequently",
  "furthermore",
  "substantial",
  "notwithstanding",
  "arguably",
];
const CONNECTOR_WORDS = [
  "however",
  "therefore",
  "moreover",
  "on the other hand",
  "in addition",
  "for instance",
  "for example",
  "consequently",
];

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Build a corrected text by replacing each detected mistake with first suggestion.
function buildCorrectedText(originalText, mistakes) {
  // Apply from end to start so offsets stay correct after replacements.
  const sorted = [...mistakes].sort((a, b) => b.offset - a.offset);
  let corrected = originalText;

  for (const item of sorted) {
    const replacement = item.suggestions[0];
    if (!replacement) {
      continue;
    }

    corrected =
      corrected.slice(0, item.offset) +
      replacement +
      corrected.slice(item.offset + item.length);
  }

  return corrected;
}

// Count words in a simple beginner-friendly way.
function getWordCount(text) {
  const clean = text.trim();
  return clean ? clean.split(/\s+/).length : 0;
}

// Count sentences by checking common ending punctuation.
function getSentenceCount(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) {
    return text.trim() ? 1 : 0;
  }
  return sentences.length;
}

// Count long sentences (more than 15 words) to estimate complexity.
function getLongSentences(text) {
  const sentences = text.match(/[^.!?]+[.!?]?/g) || [];
  let longSentences = 0;

  for (const sentence of sentences) {
    const words = getWordCount(sentence);
    if (words > 15) {
      longSentences += 1;
    }
  }

  return longSentences;
}

// Count paragraphs using blank lines as separators.
function paragraphCount(text) {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

// Count advanced words from the fixed IELTS-like list.
function countAdvancedWords(text) {
  const lower = text.toLowerCase();
  let total = 0;

  for (const word of ADVANCED_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    const matches = lower.match(regex);
    total += matches ? matches.length : 0;
  }

  return total;
}

// Strict advanced vocabulary count used for high-band eligibility.
function countStrictAdvancedWords(text) {
  const lower = text.toLowerCase();
  let total = 0;

  for (const word of STRICT_ADVANCED_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    const matches = lower.match(regex);
    total += matches ? matches.length : 0;
  }

  return total;
}

// Count linking words/phrases to estimate coherence.
function countConnectors(text) {
  const lower = text.toLowerCase();
  let total = 0;
  for (const connector of CONNECTOR_WORDS) {
    const escaped = connector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    const matches = lower.match(regex);
    total += matches ? matches.length : 0;
  }
  return total;
}

// Count repeated words (total repeated occurrences) for lexical quality.
function countRepeatedWords(text) {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const skipWords = new Set([
    "the",
    "and",
    "that",
    "this",
    "with",
    "from",
    "have",
    "there",
    "their",
    "were",
    "which",
    "would",
    "about",
    "could",
    "should",
  ]);

  const freq = new Map();
  for (const word of words) {
    if (skipWords.has(word)) {
      continue;
    }
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  let repeatedWords = 0;
  for (const count of freq.values()) {
    if (count > 1) {
      repeatedWords += count - 1;
    }
  }

  return repeatedWords;
}

function getSentenceList(text) {
  return (text.match(/[^.!?]+[.!?]?/g) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function hasRepeatedSimpleSentences(text) {
  const sentences = getSentenceList(text);
  const freq = new Map();

  for (const sentence of sentences) {
    const words = getWordCount(sentence);
    if (words > 8) {
      continue;
    }
    const normalized = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    if (!normalized) {
      continue;
    }
    freq.set(normalized, (freq.get(normalized) || 0) + 1);
  }

  for (const count of freq.values()) {
    if (count >= 2) {
      return true;
    }
  }
  return false;
}

function hasBasicExample(text) {
  const basicPatterns = [
    /for example,\s*students?\s+(like|love|want|need)\b/i,
    /for example,\s*people\s+(like|love|want|need)\b/i,
    /for instance,\s*students?\s+(like|love|want|need)\b/i,
  ];
  return basicPatterns.some((pattern) => pattern.test(text));
}

function hasWeakIdeaDevelopment(text, connectors, words) {
  const explanationMarkers = /(because|since|as a result|this means|which shows|for example|for instance)/i;
  const hasExplanation = explanationMarkers.test(text);
  return !hasExplanation || (connectors < 2 && words < 220);
}

// Find repeated words to estimate vocabulary range.
function findRepeatedWords(text) {
  const words = text
    .toLowerCase()
    .match(/\b[a-z]{3,}\b/g);

  if (!words) {
    return { repeatedWords: [], repeatedCount: 0, repetitionRatio: 0 };
  }

  const skipWords = new Set([
    "the",
    "and",
    "that",
    "this",
    "with",
    "from",
    "have",
    "there",
    "their",
    "were",
    "which",
    "would",
    "about",
    "could",
    "should",
  ]);

  const freq = new Map();
  for (const word of words) {
    if (skipWords.has(word)) {
      continue;
    }
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  const repeatedWords = [];
  let repeatedCount = 0;
  for (const [word, count] of freq.entries()) {
    if (count >= 3) {
      repeatedWords.push({ word, count });
      repeatedCount += count;
    }
  }

  repeatedWords.sort((a, b) => b.count - a.count);
  const repetitionRatio = words.length ? repeatedCount / words.length : 0;

  return { repeatedWords, repeatedCount, repetitionRatio };
}

function buildIeltsFeedback(text, mistakeCount) {
  const words = getWordCount(text);
  const paragraphs = paragraphCount(text);
  const connectors = countConnectors(text);
  const repeated = findRepeatedWords(text);

  let task = "Task is adequately addressed but could be expanded.";
  if (words < 150) {
    task = "Task is underdeveloped. Minimum word count not achieved.";
  } else if (paragraphs < 2) {
    task = "Ideas are not clearly organized.";
  }

  const coherence =
    connectors < 3
      ? "Limited use of linking words."
      : "Good use of basic linking words.";

  const lexical =
    repeated.repetitionRatio >= 0.14 || repeated.repeatedWords.length >= 4
      ? "Vocabulary is repetitive."
      : "Vocabulary is simple but acceptable.";

  let grammar = "Good control of grammar.";
  if (mistakeCount > 10) {
    grammar = "Frequent grammatical errors.";
  } else if (mistakeCount >= 5) {
    grammar = "Some noticeable grammar mistakes.";
  }

  return {
    feedback: { task, coherence, lexical, grammar },
    metrics: {
      words,
      sentences: getSentenceCount(text),
      paragraphs,
      connectors,
      repeatedWords: repeated.repeatedWords.slice(0, 5),
    },
  };
}

// Multi-factor intelligent band score closer to IELTS logic.
function calculateIntelligentBand(text, mistakeCount) {
  const words = getWordCount(text);
  const sentences = getSentenceCount(text);
  const longSentences = getLongSentences(text);
  const advancedWords = countAdvancedWords(text);
  const strictAdvancedWords = countStrictAdvancedWords(text);
  const connectors = countConnectors(text);
  const repeatedWords = countRepeatedWords(text);
  const avgWordsPerSentence = sentences > 0 ? words / sentences : 0;
  const repeatedSimpleSentences = hasRepeatedSimpleSentences(text);
  const basicExample = hasBasicExample(text);
  const weakIdeaDevelopment = hasWeakIdeaDevelopment(text, connectors, words);

  let band = 5;
  let maxBand = 9;

  // Step 1: Grammar decides base score and maximum possible ceiling.
  if (mistakeCount < 5) {
    band = 7;
    maxBand = 9;
  } else if (mistakeCount < 10) {
    band = 6;
    maxBand = 7;
  } else if (mistakeCount < 15) {
    band = 5.5;
    maxBand = 6;
  } else {
    band = 5;
    maxBand = 5.5;
  }

  // Keep task response penalty strict before adding any bonuses.
  if (words < 150) {
    band -= 1;
  }

  // Very short average sentence length suggests basic writing control.
  if (avgWordsPerSentence < 8) {
    band -= 0.5;
  }

  // Step 3: Apply limited bonuses (max +1 total).
  let bonus = 0;
  if (advancedWords > 5) {
    bonus += 0.5;
  }
  if (connectors > 3) {
    bonus += 0.5;
  }
  if (longSentences > 3) {
    bonus += 0.5;
  }
  bonus = Math.min(1, bonus);
  band += bonus;

  // Repetition still lowers lexical quality.
  if (repeatedWords > 10) {
    band -= 0.5;
  }

  // Step 4: Apply grammar cap.
  const rawBandBeforeCap = band;
  band = Math.min(band, maxBand);

  const grammarCapApplied = rawBandBeforeCap > maxBand;

  let grammarScore = 5.5;
  if (mistakeCount > 18) {
    grammarScore = 4.5;
  } else if (mistakeCount > 12) {
    grammarScore = 5;
  } else if (mistakeCount < 5) {
    grammarScore = 7.5;
  } else if (mistakeCount < 10) {
    grammarScore = 6.5;
  } else if (mistakeCount < 15) {
    grammarScore = 5.5;
  }

  let vocabularyScore = 5;
  if (advancedWords > 5) {
    vocabularyScore += 1;
  } else if (advancedWords > 2) {
    vocabularyScore += 0.5;
  }
  if (repeatedWords > 10) {
    vocabularyScore -= 1;
  }
  if (avgWordsPerSentence < 8) {
    vocabularyScore -= 0.5;
  }
  vocabularyScore = Math.min(9, Math.max(4, vocabularyScore));

  let coherenceScore = connectors < 2 ? 5 : connectors > 3 ? 6.5 : 6;
  if (repeatedSimpleSentences) {
    coherenceScore -= 1;
  }
  if (avgWordsPerSentence < 8) {
    coherenceScore = 5;
  }
  coherenceScore = Math.min(9, Math.max(4, coherenceScore));

  let taskScore = words < 150 ? 4.5 : words > 250 ? 6.5 : 6;
  if (basicExample) {
    taskScore -= 0.5;
  }
  if (repeatedSimpleSentences) {
    taskScore = 5;
  }
  if (weakIdeaDevelopment) {
    taskScore = Math.min(taskScore, 5.5);
  }
  if (avgWordsPerSentence < 8) {
    taskScore = Math.min(taskScore, 5);
  }
  taskScore = Math.min(9, Math.max(4, taskScore));

  // Final low-quality guardrail for realistic Band 4-5 outcomes.
  let lowQualityCapApplied = false;
  if (grammarScore <= 5 && vocabularyScore <= 5) {
    band = Math.min(band, 5);
    lowQualityCapApplied = true;
  }
  if (avgWordsPerSentence < 8 && (connectors < 2 || repeatedSimpleSentences)) {
    band = Math.min(band, 5);
    lowQualityCapApplied = true;
  }

  // Strict vocabulary ceiling for higher bands.
  let vocabCapApplied = false;
  if (strictAdvancedWords < 3) {
    const strictVocabMax = mistakeCount > 5 ? 6.5 : 7;
    const beforeVocabCap = band;
    band = Math.min(band, strictVocabMax);
    vocabCapApplied = beforeVocabCap > band;
  }

  // Final clamp and rounding after all caps.
  band = Math.min(9, Math.max(4, band));
  band = Math.round(band * 2) / 2;

  let explanation =
    "The response shows developing control across the IELTS criteria, though further precision and support would strengthen the overall performance.";
  if (band >= 8) {
    explanation =
      "This is a strong response with clear control of language and organization. To push higher, refine precision and maintain consistency across longer ideas.";
  } else if (band >= 7) {
    explanation =
      "This is a generally effective response. Ideas are communicated clearly, with a good command of language, but there are still areas where development and accuracy can be improved.";
  } else if (band >= 6) {
    explanation =
      "The response communicates the main message, but lapses in control and development are noticeable. Clearer support and more consistent accuracy would improve the score.";
  } else if (band >= 5) {
    explanation =
      "The writing addresses the topic in a basic way, but limitations in accuracy, cohesion, and lexical flexibility reduce overall impact.";
  } else {
    explanation =
      "The response is understandable in parts, but frequent language and organization issues make communication difficult. Focus on clarity, sentence control, and fuller task development.";
  }

  if (grammarCapApplied) {
    explanation +=
      " Score limited due to grammar mistakes despite good vocabulary.";
  }
  if (lowQualityCapApplied) {
    explanation +=
      " Essay contains basic grammar and limited idea development, which lowers the band score.";
  }
  if (vocabCapApplied) {
    explanation += " Limited use of advanced vocabulary restricts higher band score.";
  }
  const warningMessage = lowQualityCapApplied
    ? "Essay contains basic grammar and limited idea development, which lowers the band score."
    : vocabCapApplied
      ? "Limited use of advanced vocabulary restricts higher band score."
      : "";

  const breakdown = {
    grammar:
      mistakeCount < 5
        ? "There is a good range of sentence forms, and most grammar is accurate. Minor slips are present but do not usually block meaning."
        : mistakeCount < 10
          ? "Grammar is generally understandable, but there are recurring errors in tense, agreement, or structure that reduce precision."
          : mistakeCount > 18
            ? "Grammar errors are frequent and serious, which often interrupts clarity."
            : "Frequent grammatical errors make parts of the response unclear, and greater control of sentence structure is needed.",
    vocabulary:
      advancedWords > 5
        ? "Vocabulary shows some flexibility with less common items, and word choice is often effective for discussing ideas."
        : repeatedWords > 10
          ? "Meaning is usually clear, but vocabulary is repetitive in places. A wider range of synonyms would improve lexical resource."
          : avgWordsPerSentence < 8
            ? "Word choice is very simple throughout, and lexical range is limited."
            : "Vocabulary is adequate for the task, though range is somewhat limited and could be extended for more precise expression.",
    coherence:
      connectors > 3 && !repeatedSimpleSentences && avgWordsPerSentence >= 8
        ? "Ideas are logically organized and linking devices are used to guide the reader through the argument."
        : "The overall message is understandable, but cohesion is uneven. Clearer paragraphing, fuller links, and less repetitive sentence patterns would improve flow.",
    task:
      words < 150
        ? "The response is under-length, so key points are not developed enough to fully address the task requirements."
        : weakIdeaDevelopment
          ? "Ideas are present, but explanation is limited and points need fuller support to meet task demands."
        : "The task is addressed with a clear position, though some points could be developed with more specific explanation or examples.",
  };

  const smartMessages = [];
  if (advancedWords > 5) {
    smartMessages.push("Good use of advanced vocabulary.");
  }
  if (connectors <= 3) {
    smartMessages.push("Try adding more linking words.");
  }
  if (repeatedWords > 10) {
    smartMessages.push("Avoid repeating the same words frequently.");
  }
  if (lowQualityCapApplied) {
    smartMessages.push(
      "Essay contains basic grammar and limited idea development, which lowers the band score."
    );
  }
  if (vocabCapApplied) {
    smartMessages.push("Limited use of advanced vocabulary restricts higher band score.");
  }

  return {
    band,
    explanation,
    breakdown,
    categoryScores: {
      grammar: Math.round(grammarScore * 2) / 2,
      vocabulary: Math.round(vocabularyScore * 2) / 2,
      coherence: Math.round(coherenceScore * 2) / 2,
      task: Math.round(taskScore * 2) / 2,
    },
    metrics: {
      words,
      sentences,
      longSentences,
      avgWordsPerSentence: Number(avgWordsPerSentence.toFixed(1)),
      advancedWords,
      strictAdvancedWords,
      connectors,
      repeatedWords,
    },
    smartMessages,
    grammarCapApplied,
    lowQualityCapApplied,
    vocabCapApplied,
    warningMessage,
    maxBand,
  };
}

function generateDynamicTips(mistakeCount, metrics) {
  const tips = [
    "Improve sentence structure",
    "Use better vocabulary",
    "Avoid repeated words",
  ];

  if (metrics.words < 150) {
    tips.push("Write at least 150-250 words.");
  }
  if (metrics.connectors < 3) {
    tips.push("Use linking words like however, therefore.");
  }
  if (mistakeCount > 10) {
    tips.push("Revise grammar rules.");
  } else if (mistakeCount >= 5) {
    tips.push("Proofread your verb tense and sentence agreement.");
  }

  // Remove duplicates in case rules overlap.
  return [...new Set(tips)];
}

app.post("/check", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Please provide essay text." });
    }

    const response = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        text,
        language: "en-US",
      }),
    });

    if (!response.ok) {
      return res
        .status(502)
        .json({ error: "LanguageTool request failed. Please try again." });
    }

    const data = await response.json();
    const matches = Array.isArray(data.matches) ? data.matches : [];

    const mistakes = matches.map((match) => {
      const offset = match.offset || 0;
      const length = match.length || 0;
      const incorrect = text.slice(offset, offset + length);
      const suggestions = (match.replacements || [])
        .map((r) => r.value)
        .filter(Boolean)
        .slice(0, 5);

      return {
        message: match.message || "Possible grammar issue",
        incorrect,
        suggestions,
        offset,
        length,
      };
    });

    const correctedText = buildCorrectedText(text, mistakes);
    const analysis = buildIeltsFeedback(text, mistakes.length);
    const scoreResult = calculateIntelligentBand(text, mistakes.length);
    const tips = generateDynamicTips(mistakes.length, analysis.metrics);
    const smartTips = [...tips, ...scoreResult.smartMessages];

    return res.json({
      mistakes: mistakes.map((m) => ({
        message: m.message,
        incorrect: m.incorrect,
        suggestions: m.suggestions,
      })),
      correctedText,
      band: scoreResult.band,
      explanation: scoreResult.explanation,
      scoreNote: scoreResult.grammarCapApplied
        ? "Score limited due to grammar mistakes despite good vocabulary."
        : scoreResult.lowQualityCapApplied
          ? scoreResult.warningMessage
          : scoreResult.vocabCapApplied
            ? "Limited use of advanced vocabulary restricts higher band score."
          : "Score reflects combined performance across grammar, task, coherence, and vocabulary.",
      warning: scoreResult.warningMessage,
      breakdown: scoreResult.breakdown,
      categoryScores: scoreResult.categoryScores,
      feedback: analysis.feedback,
      metrics: {
        words: scoreResult.metrics.words,
        sentences: scoreResult.metrics.sentences,
        paragraphs: analysis.metrics.paragraphs,
        longSentences: scoreResult.metrics.longSentences,
        avgWordsPerSentence: scoreResult.metrics.avgWordsPerSentence,
        advancedWords: scoreResult.metrics.advancedWords,
        strictAdvancedWords: scoreResult.metrics.strictAdvancedWords,
        connectors: scoreResult.metrics.connectors,
        repeatedWords: scoreResult.metrics.repeatedWords,
      },
      tips: [...new Set(smartTips)],
      // Keep offsets available for frontend highlighting.
      highlights: mistakes.map((m) => ({
        offset: m.offset,
        length: m.length,
      })),
    });
  } catch (error) {
    console.error("Error in /check:", error);
    return res.status(500).json({ error: "Server error while checking essay." });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

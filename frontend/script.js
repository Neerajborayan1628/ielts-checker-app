const essayInput = document.getElementById("essayInput");
const checkBtn = document.getElementById("checkBtn");
const clearBtn = document.getElementById("clearBtn");
const loading = document.getElementById("loading");
const results = document.getElementById("results");
const mistakeList = document.getElementById("mistakeList");
const tipsList = document.getElementById("tipsList");
const highlightedText = document.getElementById("highlightedText");
const correctedText = document.getElementById("correctedText");
const bandScore = document.getElementById("bandScore");
const bandExplanation = document.getElementById("bandExplanation");
const wordCount = document.getElementById("wordCount");
const charCount = document.getElementById("charCount");
const themeToggle = document.getElementById("themeToggle");
const feedbackTask = document.getElementById("feedbackTask");
const feedbackCoherence = document.getElementById("feedbackCoherence");
const feedbackLexical = document.getElementById("feedbackLexical");
const feedbackGrammar = document.getElementById("feedbackGrammar");
const metricWords = document.getElementById("metricWords");
const metricSentences = document.getElementById("metricSentences");
const metricParagraphs = document.getElementById("metricParagraphs");
const metricConnectors = document.getElementById("metricConnectors");
const metricRepeatedWords = document.getElementById("metricRepeatedWords");
const breakdownGrammar = document.getElementById("breakdownGrammar");
const breakdownVocabulary = document.getElementById("breakdownVocabulary");
const breakdownCoherence = document.getElementById("breakdownCoherence");
const breakdownTask = document.getElementById("breakdownTask");
const scoreGrammar = document.getElementById("scoreGrammar");
const scoreVocabulary = document.getElementById("scoreVocabulary");
const scoreCoherence = document.getElementById("scoreCoherence");
const scoreTask = document.getElementById("scoreTask");
const barGrammar = document.getElementById("barGrammar");
const barVocabulary = document.getElementById("barVocabulary");
const barCoherence = document.getElementById("barCoherence");
const barTask = document.getElementById("barTask");
const vocabCapBadge = document.getElementById("vocabCapBadge");
const grammarCapBadge = document.getElementById("grammarCapBadge");
const qualityCapBadge = document.getElementById("qualityCapBadge");

// Same-origin API so frontend and backend run from one server.
const API_BASE = "";
const THEME_KEY = "ielts_checker_theme";

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === "dark" || savedTheme === "light") {
    applyTheme(savedTheme);
    return;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function updateCounts() {
  const text = essayInput.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  wordCount.textContent = words;
  charCount.textContent = text.length;
}

function renderHighlightedText(text, highlights) {
  if (!Array.isArray(highlights) || highlights.length === 0) {
    highlightedText.textContent = text;
    return;
  }

  const sorted = [...highlights].sort((a, b) => a.offset - b.offset);
  let html = "";
  let cursor = 0;

  for (const h of sorted) {
    const start = Math.max(0, h.offset);
    const end = Math.min(text.length, start + (h.length || 0));

    if (start < cursor) {
      // Skip overlaps to keep rendering stable for beginners.
      continue;
    }

    html += escapeHtml(text.slice(cursor, start));
    html += `<span class="incorrect">${escapeHtml(text.slice(start, end))}</span>`;
    cursor = end;
  }

  html += escapeHtml(text.slice(cursor));
  highlightedText.innerHTML = html;
}

function renderMistakes(mistakes) {
  mistakeList.innerHTML = "";

  if (!mistakes.length) {
    mistakeList.innerHTML = "<li>No grammar mistakes found. Great work!</li>";
    return;
  }

  mistakes.forEach((m) => {
    const item = document.createElement("li");
    const suggestionText =
      m.suggestions && m.suggestions.length
        ? m.suggestions.join(", ")
        : "No direct suggestion";
    item.innerHTML = `<strong>${escapeHtml(m.incorrect || "(unknown)")}</strong>: ${escapeHtml(
      m.message
    )}<br/><em>Suggestions:</em> ${escapeHtml(suggestionText)}`;
    mistakeList.appendChild(item);
  });
}

function renderTips(tips) {
  tipsList.innerHTML = "";
  tips.forEach((tip) => {
    const li = document.createElement("li");
    li.textContent = tip;
    tipsList.appendChild(li);
  });
}

function renderFeedback(feedback) {
  feedbackTask.textContent = feedback.task || "-";
  feedbackCoherence.textContent = feedback.coherence || "-";
  feedbackLexical.textContent = feedback.lexical || "-";
  feedbackGrammar.textContent = feedback.grammar || "-";
}

function renderMetrics(metrics) {
  metricWords.textContent = String(metrics.words || 0);
  metricSentences.textContent = String(metrics.sentences || 0);
  metricParagraphs.textContent = String(metrics.paragraphs || 0);
  metricConnectors.textContent = String(metrics.connectors || 0);
  metricRepeatedWords.textContent = String(metrics.repeatedWords || 0);
}

function updateProgressBar(el, score) {
  const safeScore = Math.max(0, Math.min(9, Number(score) || 0));
  const percent = (safeScore / 9) * 100;
  el.style.width = `${percent}%`;
}

function renderBreakdown(breakdown, categoryScores) {
  breakdownGrammar.textContent = breakdown.grammar || "-";
  breakdownVocabulary.textContent = breakdown.vocabulary || "-";
  breakdownCoherence.textContent = breakdown.coherence || "-";
  breakdownTask.textContent = breakdown.task || "-";

  const grammar = Number(categoryScores.grammar || 0);
  const vocabulary = Number(categoryScores.vocabulary || 0);
  const coherence = Number(categoryScores.coherence || 0);
  const task = Number(categoryScores.task || 0);

  scoreGrammar.textContent = grammar.toFixed(1);
  scoreVocabulary.textContent = vocabulary.toFixed(1);
  scoreCoherence.textContent = coherence.toFixed(1);
  scoreTask.textContent = task.toFixed(1);

  updateProgressBar(barGrammar, grammar);
  updateProgressBar(barVocabulary, vocabulary);
  updateProgressBar(barCoherence, coherence);
  updateProgressBar(barTask, task);
}

function renderVocabCapBadge(warning) {
  const isVocabCap =
    typeof warning === "string" &&
    warning.toLowerCase().includes("limited use of advanced vocabulary");

  vocabCapBadge.classList.toggle("hidden", !isVocabCap);
}

function renderScoreCaps(scoreNote, warning) {
  const note = typeof scoreNote === "string" ? scoreNote.toLowerCase() : "";
  const warn = typeof warning === "string" ? warning.toLowerCase() : "";

  const isGrammarCap = note.includes("score limited due to grammar mistakes");
  const isQualityCap = warn.includes("basic grammar and limited idea development");

  grammarCapBadge.classList.toggle("hidden", !isGrammarCap);
  qualityCapBadge.classList.toggle("hidden", !isQualityCap);
}

function showResultsWithAnimation() {
  results.classList.remove("hidden");
  results.classList.remove("show");
  // Trigger reflow so animation can replay each check.
  void results.offsetWidth;
  results.classList.add("show");
}

checkBtn.addEventListener("click", async () => {
  const text = essayInput.value.trim();

  if (!text) {
    alert("Please enter your essay first.");
    return;
  }

  loading.classList.remove("hidden");
  results.classList.add("hidden");
  checkBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    const rawBody = await response.text();
    let data = {};
    if (rawBody) {
      try {
        data = JSON.parse(rawBody);
      } catch (parseError) {
        throw new Error(
          "Server returned an invalid response. Please make sure backend is running at http://localhost:5000."
        );
      }
    }

    if (!response.ok) {
      throw new Error(data.error || "Failed to check essay.");
    }

    renderMistakes(data.mistakes || []);
    renderHighlightedText(text, data.highlights || []);
    correctedText.value = data.correctedText || text;
    bandScore.textContent = data.band || "-";
    bandExplanation.textContent = data.explanation || "";
    renderVocabCapBadge(data.warning || "");
    renderScoreCaps(data.scoreNote || "", data.warning || "");
    renderBreakdown(data.breakdown || {}, data.categoryScores || {});
    renderFeedback(data.feedback || {});
    renderMetrics(data.metrics || {});
    renderTips(data.tips || []);
    showResultsWithAnimation();
  } catch (error) {
    alert(error.message || "Something went wrong.");
  } finally {
    loading.classList.add("hidden");
    checkBtn.disabled = false;
  }
});

clearBtn.addEventListener("click", () => {
  essayInput.value = "";
  correctedText.value = "";
  highlightedText.textContent = "";
  mistakeList.innerHTML = "";
  tipsList.innerHTML = "";
  bandScore.textContent = "-";
  bandExplanation.textContent = "";
  renderVocabCapBadge("");
  renderScoreCaps("", "");
  renderBreakdown({}, {});
  renderFeedback({});
  renderMetrics({});
  results.classList.add("hidden");
  updateCounts();
});

themeToggle.addEventListener("click", () => {
  const current = document.body.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const nextTheme = current === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem(THEME_KEY, nextTheme);
});

essayInput.addEventListener("input", updateCounts);
initTheme();
updateCounts();

(function () {
  "use strict";

  const HISTORY_KEY = "quizmaster_history";
  const OPTION_KEYS = ["A", "B", "C", "D", "E"];

  function normalizeSelection(selection) {
    return Array.from(new Set((selection || []).map(String))).sort();
  }

  function getCorrectOptionIds(question) {
    return question.options
      .filter((option) => option.correct)
      .map((option) => String(option.id))
      .sort();
  }

  function sameSet(left, right) {
    const a = normalizeSelection(left);
    const b = normalizeSelection(right);
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  function isQuestionCorrect(question, selectedIds) {
    return sameSet(getCorrectOptionIds(question), selectedIds);
  }

  function computeScore(questions, answers) {
    const correctCount = questions.reduce((count, question) => {
      return count + (isQuestionCorrect(question, answers[question.id] || []) ? 1 : 0);
    }, 0);
    const total = questions.length;
    const percent = total === 0 ? 0 : Math.round((correctCount / total) * 100);
    return { correctCount, total, percent };
  }

  function markerForOption(option, selected) {
    if (option.correct) {
      return "correct";
    }
    return selected ? "selected-wrong" : "neutral";
  }

  function buildAttemptReview(questions, answers) {
    return questions.map((question) => {
      const selectedIds = normalizeSelection(answers[question.id] || []);
      const correct = isQuestionCorrect(question, selectedIds);
      return {
        id: question.id,
        topic: question.topic,
        question: question.question,
        explanation: question.explanation,
        source: question.source,
        correct,
        selectedIds,
        correctIds: getCorrectOptionIds(question),
        options: question.options.map((option) => {
          const selected = selectedIds.includes(String(option.id));
          return {
            id: option.id,
            text: option.text,
            correct: Boolean(option.correct),
            selected,
            marker: markerForOption(option, selected),
          };
        }),
      };
    });
  }

  function sampleQuestions(pool, count, rng) {
    if (!Array.isArray(pool)) {
      throw new Error("Question pool must be an array.");
    }
    if (count > pool.length) {
      throw new Error("Not enough questions available for the selected quiz length.");
    }
    const random = rng || Math.random;
    const shuffled = pool.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      const current = shuffled[index];
      shuffled[index] = shuffled[swapIndex];
      shuffled[swapIndex] = current;
    }
    return shuffled.slice(0, count);
  }

  function readHistory(storage) {
    try {
      const raw = storage.getItem(HISTORY_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeHistory(storage, history) {
    storage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  const api = {
    HISTORY_KEY,
    sampleQuestions,
    normalizeSelection,
    isQuestionCorrect,
    buildAttemptReview,
    computeScore,
    validateQuestions,
    buildLoadErrorMessage,
    readHistory,
    writeHistory,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const state = {
    questions: [],
    loadError: "",
    selectedLength: null,
    quiz: null,
    correctExpanded: false,
    courses: [],
    selectedCourseId: null,
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindEvents();
    renderHome();
    loadCourses();
  }

  function cacheElements() {
    [
      "home-screen",
      "quiz-screen",
      "results-screen",
      "history-screen",
      "question-bank-status",
      "home-error",
      "start-quiz",
      "view-history",
      "quiz-back-home",
      "progress-bar",
      "quiz-progress-label",
      "question-topic",
      "question-text",
      "options-list",
      "previous-question",
      "next-question",
      "score-title",
      "wrong-results",
      "toggle-correct",
      "correct-results",
      "retake-quiz",
      "results-home",
      "history-home",
      "history-list",
      "clear-history",
      "course-grid",
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });
    els.lengthButtons = Array.from(document.querySelectorAll(".length-button"));
  }

  function bindEvents() {
    els.lengthButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedLength = Number(button.dataset.length);
        renderHome();
      });
    });

    els["start-quiz"].addEventListener("click", startQuiz);
    els["view-history"].addEventListener("click", showHistory);
    els["quiz-back-home"].addEventListener("click", () => showScreen("home"));
    els["previous-question"].addEventListener("click", previousQuestion);
    els["next-question"].addEventListener("click", nextQuestion);
    els["retake-quiz"].addEventListener("click", startQuiz);
    els["results-home"].addEventListener("click", () => showScreen("home"));
    els["history-home"].addEventListener("click", () => showScreen("home"));
    els["clear-history"].addEventListener("click", clearHistory);
    els["toggle-correct"].addEventListener("click", toggleCorrectResults);

    document.addEventListener("keydown", handleKeyboard);
  }

  async function loadCourses() {
    try {
      const response = await fetch("courses.json");
      if (!response.ok) {
        throw new Error(`courses.json returned ${response.status}`);
      }
      state.courses = await response.json();
      state.loadError = "";
    } catch (error) {
      state.courses = [];
      state.loadError = buildLoadErrorMessage("courses.json", window.location.protocol);
    }
    renderHome();
  }

  async function loadCourseQuestions(courseId) {
    const course = state.courses.find((c) => c.id === courseId);
    if (!course) {
      return;
    }
    try {
      const response = await fetch(course.file);
      if (!response.ok) {
        throw new Error(`${course.file} returned ${response.status}`);
      }
      const questions = await response.json();
      validateQuestions(questions);
      state.questions = questions;
      state.selectedCourseId = courseId;
      state.selectedLength = null;
      state.loadError = "";
    } catch (error) {
      state.questions = [];
      state.loadError = buildLoadErrorMessage(
        course.file,
        window.location.protocol,
        "Nu s-au putut încărca întrebările pentru cursul ales.",
      );
    }
    renderHome();
  }

  function buildLoadErrorMessage(resource, protocol, baseMessage) {
    const message = baseMessage || `Nu s-a putut încărca ${resource}.`;
    if (protocol === "file:") {
      return `${message} Deschide aplicația printr-un server local, de exemplu http://localhost:8000, nu direct din fișier.`;
    }
    return message;
  }

  function validateQuestions(questions) {
    if (!Array.isArray(questions)) {
      throw new Error("questions.json must contain an array.");
    }
    questions.forEach((question) => {
      if (!Array.isArray(question.options) || question.options.length !== 5) {
        throw new Error("Each question must contain exactly five options.");
      }
      const correctCount = question.options.filter((option) => option.correct).length;
      if (correctCount < 1 || correctCount > 4) {
        throw new Error("Each question must contain one to four correct answers.");
      }
    });
  }

  function showScreen(name) {
    ["home", "quiz", "results", "history"].forEach((screen) => {
      els[`${screen}-screen`].classList.toggle("hidden", screen !== name);
    });
    if (name === "home") {
      renderHome();
    }
  }

  function renderHome() {
    els["course-grid"].replaceChildren(
      ...state.courses.map((course) => {
        const btn = document.createElement("button");
        btn.className = "length-button" + (state.selectedCourseId === course.id ? " selected" : "");
        btn.type = "button";
        btn.textContent = course.name;
        btn.setAttribute("aria-pressed", String(state.selectedCourseId === course.id));
        btn.addEventListener("click", () => loadCourseQuestions(course.id));
        return btn;
      }),
    );

    if (state.loadError) {
      els["question-bank-status"].textContent = state.loadError;
    } else if (!state.selectedCourseId) {
      els["question-bank-status"].textContent = "Selectează un curs";
    } else {
      els["question-bank-status"].textContent = `${state.questions.length} întrebări disponibile`;
    }

    els.lengthButtons.forEach((button) => {
      const length = Number(button.dataset.length);
      button.classList.toggle("selected", state.selectedLength === length);
      button.setAttribute("aria-pressed", String(state.selectedLength === length));
    });

    const length = state.selectedLength;
    let error = "";
    if (state.loadError) {
      error = state.loadError;
    } else if (state.selectedCourseId && length && state.questions.length < length) {
      error = `Cursul selectat are ${state.questions.length} întrebări, dar au fost selectate ${length}.`;
    }

    els["home-error"].textContent = error;
    els["start-quiz"].disabled = Boolean(error) || !state.selectedCourseId || !length || state.questions.length === 0;
  }

  function startQuiz() {
    const length = state.selectedLength;
    if (!length || state.questions.length < length) {
      renderHome();
      return;
    }

    const quizQuestions = sampleQuestions(state.questions, length);
    state.quiz = {
      questions: quizQuestions,
      answers: Object.fromEntries(quizQuestions.map((question) => [question.id, []])),
      currentIndex: 0,
      result: null,
      saved: false,
    };
    state.correctExpanded = false;
    showScreen("quiz");
    renderQuiz();
  }

  function renderQuiz() {
    if (!state.quiz) {
      showScreen("home");
      return;
    }

    const { questions, currentIndex } = state.quiz;
    const question = questions[currentIndex];
    const progress = ((currentIndex + 1) / questions.length) * 100;

    els["progress-bar"].style.width = `${progress}%`;
    els["quiz-progress-label"].textContent = `Question ${currentIndex + 1} / ${questions.length}`;
    els["question-topic"].textContent = question.topic;
    els["question-text"].textContent = question.question;
    els["previous-question"].disabled = currentIndex === 0;
    els["next-question"].textContent = currentIndex === questions.length - 1 ? "Finish Quiz" : "Next";

    const selectedIds = state.quiz.answers[question.id] || [];
    els["options-list"].replaceChildren(
      ...question.options.map((option, index) => createOptionControl(question, option, index, selectedIds)),
    );
  }

  function createOptionControl(question, option, index, selectedIds) {
    const label = document.createElement("label");
    label.className = "option-card";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = option.id;
    checkbox.checked = selectedIds.includes(String(option.id));
    checkbox.setAttribute("aria-label", `${option.id}. ${option.text}`);
    checkbox.addEventListener("change", () => {
      updateAnswer(question.id, option.id, checkbox.checked);
    });

    const text = document.createElement("span");
    const key = OPTION_KEYS[index] || option.id;
    text.innerHTML = `<span class="option-id">${escapeHtml(key)}.</span>${escapeHtml(option.text)}`;

    label.append(checkbox, text);
    return label;
  }

  function updateAnswer(questionId, optionId, checked) {
    const existing = state.quiz.answers[questionId] || [];
    const next = checked
      ? normalizeSelection(existing.concat(optionId))
      : existing.filter((id) => String(id) !== String(optionId));
    state.quiz.answers[questionId] = next;
  }

  function previousQuestion() {
    if (!state.quiz || state.quiz.currentIndex === 0) {
      return;
    }
    state.quiz.currentIndex -= 1;
    renderQuiz();
  }

  function nextQuestion() {
    if (!state.quiz) {
      return;
    }
    if (state.quiz.currentIndex < state.quiz.questions.length - 1) {
      state.quiz.currentIndex += 1;
      renderQuiz();
      return;
    }
    finishQuiz();
  }

  function finishQuiz() {
    const unanswered = state.quiz.questions.filter((question) => {
      return (state.quiz.answers[question.id] || []).length === 0;
    });

    if (unanswered.length > 0) {
      const ok = window.confirm(`${unanswered.length} question${unanswered.length === 1 ? " is" : "s are"} unanswered. Finish quiz?`);
      if (!ok) {
        return;
      }
    }

    const score = computeScore(state.quiz.questions, state.quiz.answers);
    const review = buildAttemptReview(state.quiz.questions, state.quiz.answers);
    state.quiz.result = { score, review, finishedAt: new Date().toISOString() };
    saveCurrentResult();
    renderResults();
    showScreen("results");
  }

  function saveCurrentResult() {
    if (!state.quiz || !state.quiz.result || state.quiz.saved) {
      return;
    }

    const wrongReview = state.quiz.result.review.filter((item) => !item.correct);
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      finishedAt: state.quiz.result.finishedAt,
      length: state.quiz.questions.length,
      score: state.quiz.result.score.correctCount,
      total: state.quiz.result.score.total,
      percent: state.quiz.result.score.percent,
      wrongReview,
    };

    const history = readHistory(window.localStorage);
    history.unshift(entry);
    writeHistory(window.localStorage, history);
    state.quiz.saved = true;
  }

  function renderResults() {
    const result = state.quiz.result;
    els["score-title"].textContent = `${result.score.correctCount} / ${result.score.total} correct (${result.score.percent}%)`;

    const wrong = result.review.filter((item) => !item.correct);
    const correct = result.review.filter((item) => item.correct);

    els["wrong-results"].replaceChildren(
      wrong.length > 0
        ? createReviewList(wrong)
        : createEmptyState("No wrong answers in this attempt."),
    );

    els["correct-results"].replaceChildren(
      correct.length > 0
        ? createReviewList(correct)
        : createEmptyState("No correctly answered questions in this attempt."),
    );
    els["correct-results"].classList.toggle("hidden", !state.correctExpanded);
    els["toggle-correct"].textContent = state.correctExpanded ? "Hide correct answers" : "Show correct answers";
  }

  function toggleCorrectResults() {
    state.correctExpanded = !state.correctExpanded;
    renderResults();
  }

  function createReviewList(items) {
    const list = document.createElement("div");
    list.className = "review-list";
    items.forEach((item) => list.append(createReviewItem(item)));
    return list;
  }

  function createReviewItem(item) {
    const article = document.createElement("article");
    article.className = `review-item ${item.correct ? "correct" : "wrong"}`;

    const question = document.createElement("p");
    question.className = "review-question";
    question.textContent = item.question;
    article.append(question);

    item.options.forEach((option) => {
      const row = document.createElement("div");
      row.className = "review-option";

      const marker = document.createElement("span");
      marker.className = `marker-${option.marker}`;
      marker.textContent = markerText(option.marker);

      const optionText = document.createElement("span");
      optionText.textContent = `${option.id}. ${option.text}`;

      row.append(marker, optionText);
      article.append(row);
    });

    const explanation = document.createElement("p");
    explanation.className = "explanation";
    explanation.textContent = item.explanation || "No explanation provided.";

    const source = document.createElement("p");
    source.className = "source";
    source.textContent = `Source: ${item.source || "Not provided"}`;

    article.append(explanation, source);
    return article;
  }

  function markerText(marker) {
    if (marker === "correct") {
      return "✅";
    }
    if (marker === "selected-wrong") {
      return "❌";
    }
    return "⚪";
  }

  function showHistory() {
    renderHistory();
    showScreen("history");
  }

  function renderHistory() {
    const history = readHistory(window.localStorage);
    els["clear-history"].disabled = history.length === 0;
    els["history-list"].replaceChildren(
      history.length > 0
        ? createHistoryEntries(history)
        : createEmptyState("No quiz attempts saved yet."),
    );
  }

  function createHistoryEntries(history) {
    const fragment = document.createDocumentFragment();
    history.forEach((entry) => fragment.append(createHistoryEntry(entry)));
    return fragment;
  }

  function createHistoryEntry(entry) {
    const details = document.createElement("details");
    details.className = "history-entry";

    const summary = document.createElement("summary");
    const date = document.createElement("span");
    date.textContent = formatDateTime(entry.finishedAt);
    const score = document.createElement("span");
    score.className = "history-score";
    score.textContent = `${entry.score}/${entry.total} (${entry.percent}%)`;
    const length = document.createElement("span");
    length.className = "muted";
    length.textContent = `${entry.length} questions`;
    summary.append(date, score, length);

    const breakdown = document.createElement("div");
    breakdown.className = "history-breakdown";
    breakdown.append(
      entry.wrongReview && entry.wrongReview.length > 0
        ? createReviewList(entry.wrongReview)
        : createEmptyState("No wrong answers in this attempt."),
    );

    details.append(summary, breakdown);
    return details;
  }

  function clearHistory() {
    if (!window.confirm("Clear all quiz history?")) {
      return;
    }
    writeHistory(window.localStorage, []);
    renderHistory();
  }

  function handleKeyboard(event) {
    const activeTag = document.activeElement ? document.activeElement.tagName : "";
    if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") {
      return;
    }

    if (!els["quiz-screen"].classList.contains("hidden")) {
      const key = event.key.toUpperCase();
      const optionIndex = ["1", "2", "3", "4", "5"].includes(event.key)
        ? Number(event.key) - 1
        : OPTION_KEYS.indexOf(key);

      if (optionIndex >= 0 && optionIndex < OPTION_KEYS.length) {
        event.preventDefault();
        toggleOptionByIndex(optionIndex);
      } else if (event.key === "Enter") {
        event.preventDefault();
        nextQuestion();
      } else if (event.key === "Escape") {
        event.preventDefault();
        previousQuestion();
      }
    }
  }

  function toggleOptionByIndex(index) {
    const question = state.quiz.questions[state.quiz.currentIndex];
    const option = question.options[index];
    if (!option) {
      return;
    }
    const selected = state.quiz.answers[question.id] || [];
    updateAnswer(question.id, option.id, !selected.includes(String(option.id)));
    renderQuiz();
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Unknown date";
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function createEmptyState(message) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = message;
    return empty;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();

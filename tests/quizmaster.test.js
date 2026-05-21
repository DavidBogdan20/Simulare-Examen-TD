const assert = require("node:assert/strict");
const {
  sampleQuestions,
  normalizeSelection,
  isQuestionCorrect,
  buildAttemptReview,
  computeScore,
  validateQuestions,
} = require("../app.js");

const questions = [
  {
    id: 1,
    topic: "HTML",
    difficulty: "recall",
    question: "Pick semantic elements.",
    options: [
      { id: "A", text: "header", correct: true },
      { id: "B", text: "blink", correct: false },
      { id: "C", text: "main", correct: true },
      { id: "D", text: "font", correct: false },
    ],
    explanation: "header and main are semantic HTML elements.",
    source: "HTML spec",
  },
  {
    id: 2,
    topic: "CSS",
    difficulty: "recall",
    question: "Which are CSS units?",
    options: [
      { id: "A", text: "px", correct: true },
      { id: "B", text: "rem", correct: true },
      { id: "C", text: "href", correct: false },
      { id: "D", text: "src", correct: false },
    ],
    explanation: "px and rem are CSS units.",
    source: "CSS Values",
  },
  {
    id: 3,
    topic: "JavaScript",
    difficulty: "recall",
    question: "Which are primitives?",
    options: [
      { id: "A", text: "string", correct: true },
      { id: "B", text: "number", correct: true },
      { id: "C", text: "array", correct: false },
      { id: "D", text: "map", correct: false },
    ],
    explanation: "string and number are primitive values.",
    source: "MDN",
  },
];

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

test("sampleQuestions returns requested count without mutating or duplicating questions", () => {
  const sampled = sampleQuestions(questions, 2, () => 0.5);

  assert.equal(sampled.length, 2);
  assert.equal(new Set(sampled.map((question) => question.id)).size, 2);
  assert.deepEqual(questions.map((question) => question.id), [1, 2, 3]);
});

test("sampleQuestions rejects requests larger than the pool", () => {
  assert.throws(() => sampleQuestions(questions, 4), /Not enough questions/);
});

test("isQuestionCorrect requires exactly the set of correct options", () => {
  assert.equal(isQuestionCorrect(questions[0], ["A", "C"]), true);
  assert.equal(isQuestionCorrect(questions[0], ["A"]), false);
  assert.equal(isQuestionCorrect(questions[0], ["A", "B", "C"]), false);
  assert.equal(isQuestionCorrect(questions[0], []), false);
});

test("normalizeSelection sorts and removes duplicate option ids", () => {
  assert.deepEqual(normalizeSelection(["D", "A", "D", "C"]), ["A", "C", "D"]);
});

test("computeScore counts only exact answers", () => {
  const answers = {
    1: ["A", "C"],
    2: ["A"],
    3: ["A", "B", "C"],
  };

  const score = computeScore(questions, answers);

  assert.equal(score.correctCount, 1);
  assert.equal(score.total, 3);
  assert.equal(score.percent, 33);
});

test("buildAttemptReview marks correct, selected wrong, and unselected wrong options", () => {
  const review = buildAttemptReview([questions[0]], { 1: ["A", "B"] });

  assert.equal(review[0].correct, false);
  assert.deepEqual(
    review[0].options.map((option) => option.marker),
    ["correct", "selected-wrong", "correct", "neutral"],
  );
});

test("validateQuestions accepts questions with five options and one to four correct answers", () => {
  const fiveOptionQuestions = [
    {
      id: 10,
      topic: "HTML",
      difficulty: "recall",
      question: "Pick semantic elements.",
      options: [
        { id: "A", text: "header", correct: true },
        { id: "B", text: "blink", correct: false },
        { id: "C", text: "main", correct: true },
        { id: "D", text: "font", correct: false },
        { id: "E", text: "center", correct: false },
      ],
    },
    {
      id: 11,
      topic: "CSS",
      difficulty: "recall",
      question: "Which are CSS units?",
      options: [
        { id: "A", text: "px", correct: true },
        { id: "B", text: "rem", correct: true },
        { id: "C", text: "em", correct: true },
        { id: "D", text: "vh", correct: true },
        { id: "E", text: "href", correct: false },
      ],
    },
  ];

  assert.doesNotThrow(() => validateQuestions(fiveOptionQuestions));
});

test("validateQuestions rejects question banks without exactly five options", () => {
  assert.throws(() => validateQuestions(questions), /exactly five options/);
});

test("validateQuestions rejects questions without one to four correct answers", () => {
  const noCorrect = [
    {
      id: 12,
      topic: "CSS",
      question: "Invalid question.",
      options: [
        { id: "A", text: "one", correct: false },
        { id: "B", text: "two", correct: false },
        { id: "C", text: "three", correct: false },
        { id: "D", text: "four", correct: false },
        { id: "E", text: "five", correct: false },
      ],
    },
  ];
  const allCorrect = [
    {
      id: 13,
      topic: "CSS",
      question: "Invalid question.",
      options: [
        { id: "A", text: "one", correct: true },
        { id: "B", text: "two", correct: true },
        { id: "C", text: "three", correct: true },
        { id: "D", text: "four", correct: true },
        { id: "E", text: "five", correct: true },
      ],
    },
  ];

  assert.throws(() => validateQuestions(noCorrect), /one to four correct answers/);
  assert.throws(() => validateQuestions(allCorrect), /one to four correct answers/);
});

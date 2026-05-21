# QuizMaster

QuizMaster is a single-page vanilla HTML/CSS/JavaScript app for practicing Moodle-style multiple-choice quizzes from a local `questions.json` file.

## Run Locally

Place `questions.json` next to `index.html`, then start a local static server from this directory:

```bash
python -m http.server 8000
```

Open `http://localhost:8000` in your browser.

Opening `index.html` directly with `file://` will fail in most browsers because `fetch('questions.json')` is blocked by file URL CORS restrictions.

## Data File

`questions.json` must be at the project root, beside `index.html`, and contain an array of question objects with this shape:

```json
{
  "id": 1,
  "topic": "HTML",
  "difficulty": "recall",
  "question": "string",
  "options": [
    { "id": "A", "text": "string", "correct": true },
    { "id": "B", "text": "string", "correct": false },
    { "id": "C", "text": "string", "correct": false },
    { "id": "D", "text": "string", "correct": false },
    { "id": "E", "text": "string", "correct": false }
  ],
  "explanation": "string",
  "source": "string"
}
```

Each question must have exactly five options. Questions can have one to four correct options. Quiz history is stored in `localStorage` under `quizmaster_history`.

## Test Pure Logic

```bash
node tests/quizmaster.test.js
```

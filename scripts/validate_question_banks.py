import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COURSES_PATH = ROOT / "courses.json"
VALID_DIFFICULTIES = {"medium", "hard"}
VALID_OPTION_IDS = ["A", "B", "C", "D", "E"]


def fail(message):
    raise SystemExit(message)


def load_json(path):
    try:
      return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
      fail(f"{path}: invalid JSON: {exc}")


def validate_question_bank(course):
    path = ROOT / course["file"]
    questions = load_json(path)
    if not isinstance(questions, list):
        fail(f"{path}: root must be a JSON array")
    ids = [question.get("id") for question in questions if isinstance(question, dict)]
    duplicate_ids = [item for item, count in Counter(ids).items() if count > 1]
    if duplicate_ids:
        fail(f"{path}: duplicate ids {duplicate_ids}")
    correct_counts = Counter()
    for index, question in enumerate(questions, start=1):
        if not isinstance(question, dict):
            fail(f"{path}: question {index} is not an object")
        for key in ["id", "topic", "difficulty", "question", "options", "explanation", "source"]:
            if key not in question:
                fail(f"{path}: question {index} missing {key}")
        if question["difficulty"] not in VALID_DIFFICULTIES:
            fail(f"{path}: question {index} invalid difficulty {question['difficulty']!r}")
        options = question["options"]
        if not isinstance(options, list) or len(options) != 5:
            fail(f"{path}: question {index} must have exactly five options")
        if [option.get("id") for option in options] != VALID_OPTION_IDS:
            fail(f"{path}: question {index} option ids must be A-E")
        correct = sum(1 for option in options if option.get("correct") is True)
        if correct < 1 or correct > 4:
            fail(f"{path}: question {index} must have one to four correct options")
        correct_counts[correct] += 1
        for option in options:
            if not isinstance(option.get("text"), str) or not option["text"].strip():
                fail(f"{path}: question {index} has an empty option")
            if not isinstance(option.get("correct"), bool):
                fail(f"{path}: question {index} option {option.get('id')} correct must be boolean")
    missing_counts = [count for count in range(1, 5) if correct_counts[count] == 0]
    if missing_counts:
        fail(f"{path}: missing questions with these correct-answer counts: {missing_counts}")
    print(f"{course['id']}: {len(questions)} questions; correct-count distribution {dict(sorted(correct_counts.items()))}")


def main():
    courses = load_json(COURSES_PATH)
    if not isinstance(courses, list):
        fail("courses.json must be an array")
    course_ids = [course.get("id") for course in courses if isinstance(course, dict)]
    duplicate_courses = [item for item, count in Counter(course_ids).items() if count > 1]
    if duplicate_courses:
        fail(f"courses.json duplicate ids {duplicate_courses}")
    for course in courses:
        for key in ["id", "name", "file"]:
            if key not in course:
                fail(f"courses.json course missing {key}")
        validate_question_bank(course)


if __name__ == "__main__":
    main()

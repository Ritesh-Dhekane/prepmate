"""Question bank: loads the JSON files, checks them, and picks questions for an interview.

The browser only receives what it needs to show a question (text, audio, word timings).
Expected topics and keywords stay on the server, so answers can't be looked up in advance.
"""

import json
import random
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "questions"

ROLES = {
    "frontend": "Frontend Developer",
    "backend": "Backend Developer",
    "fullstack": "Full Stack Developer",
    "database": "Database Developer",
}
DIFFICULTIES = ["easy", "medium", "hard"]
TYPES = ["technical", "mixed"]
QUESTIONS_PER_INTERVIEW = 5
GENERAL_IN_MIXED = 2  # "Mixed" interviews swap in this many general (non-technical) questions

REQUIRED_FIELDS = {"id", "role", "topic", "difficulty", "question", "expected_topics", "keywords"}
PUBLIC_FIELDS = ["id", "role", "topic", "difficulty", "question", "audio", "wordTimings"]


class QuestionBankError(Exception):
    pass


def load_bank(data_dir: Path = DATA_DIR) -> dict[str, list[dict]]:
    """Load every question file and check it. Raises QuestionBankError on bad data."""
    bank: dict[str, list[dict]] = {}
    seen_ids: set[str] = set()
    for group in [*ROLES, "general"]:
        path = data_dir / f"{group}.json"
        try:
            questions = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise QuestionBankError(f"{path.name}: {error}") from error
        for question in questions:
            check_question(question, group, seen_ids)
        bank[group] = questions
    return bank


def check_question(question: dict, group: str, seen_ids: set[str]) -> None:
    qid = question.get("id", "?")
    missing = REQUIRED_FIELDS - question.keys()
    if missing:
        raise QuestionBankError(f"{qid}: missing {sorted(missing)}")
    if qid in seen_ids:
        raise QuestionBankError(f"{qid}: duplicate id")
    seen_ids.add(qid)
    if question["role"] != group:
        raise QuestionBankError(f"{qid}: role {question['role']!r} in {group}.json")
    if question["difficulty"] not in DIFFICULTIES:
        raise QuestionBankError(f"{qid}: unknown difficulty {question['difficulty']!r}")
    if len(question["keywords"]) != len(question["expected_topics"]):
        raise QuestionBankError(f"{qid}: needs one keyword list per expected topic")
    for words in question["keywords"]:
        if not words or any(word != word.lower() for word in words):
            raise QuestionBankError(f"{qid}: keywords must be non-empty and lower-case")


def pick_questions(
    bank: dict[str, list[dict]],
    role: str,
    difficulty: str,
    interview_type: str,
    rng: random.Random | None = None,
) -> list[dict]:
    """Five different questions: the chosen difficulty first, then the nearest ones."""
    rng = rng or random.Random()
    general = GENERAL_IN_MIXED if interview_type == "mixed" else 0
    chosen = _closest(bank[role], difficulty, QUESTIONS_PER_INTERVIEW - general, rng)
    chosen += _closest(bank["general"], difficulty, general, rng)
    return chosen


def _closest(pool: list[dict], difficulty: str, count: int, rng: random.Random) -> list[dict]:
    target = DIFFICULTIES.index(difficulty)
    shuffled = pool[:]
    rng.shuffle(shuffled)
    # Stable sort after shuffling: random order within each difficulty distance.
    shuffled.sort(key=lambda q: abs(DIFFICULTIES.index(q["difficulty"]) - target))
    return shuffled[:count]


def public_view(question: dict) -> dict:
    return {field: question[field] for field in PUBLIC_FIELDS if field in question}


def find_question(bank: dict[str, list[dict]], question_id: str) -> dict | None:
    for questions in bank.values():
        for question in questions:
            if question["id"] == question_id:
                return question
    return None

import random

import pytest

from services.questions import (
    DIFFICULTIES,
    QuestionBankError,
    ROLES,
    check_question,
    load_bank,
    pick_questions,
    public_view,
)


@pytest.fixture(scope="module")
def bank():
    return load_bank()


def test_every_role_has_ten_questions_and_general_exists(bank):
    for role in ROLES:
        assert len(bank[role]) == 10, role
    assert len(bank["general"]) >= 4


def test_each_role_can_fill_an_interview_at_every_difficulty(bank):
    for role in ROLES:
        counts = {d: sum(q["difficulty"] == d for q in bank[role]) for d in DIFFICULTIES}
        assert all(count >= 3 for count in counts.values()), (role, counts)


def test_questions_have_audio_and_timings_for_every_word(bank):
    for questions in bank.values():
        for q in questions:
            assert q.get("audio", "").startswith("/static/audio/"), q["id"]
            words = q["question"].split()
            timings = q.get("wordTimings", [])
            assert [t["word"] for t in timings] == words, q["id"]
            assert all(t["end"] >= t["start"] >= 0 for t in timings), q["id"]
            starts = [t["start"] for t in timings]
            assert starts == sorted(starts), q["id"]


def test_bad_questions_are_rejected():
    good = {
        "id": "X1",
        "role": "frontend",
        "topic": "t",
        "difficulty": "easy",
        "question": "q?",
        "expected_topics": ["a"],
        "keywords": [["a"]],
    }
    check_question(dict(good), "frontend", set())
    with pytest.raises(QuestionBankError, match="duplicate"):
        check_question(dict(good), "frontend", {"X1"})
    with pytest.raises(QuestionBankError, match="difficulty"):
        check_question({**good, "difficulty": "extreme"}, "frontend", set())
    with pytest.raises(QuestionBankError, match="keyword list"):
        check_question({**good, "keywords": []}, "frontend", set())
    with pytest.raises(QuestionBankError, match="lower-case"):
        check_question({**good, "keywords": [["DOM"]]}, "frontend", set())
    with pytest.raises(QuestionBankError, match="missing"):
        check_question({"id": "X2"}, "frontend", set())


def test_technical_interview_picks_five_different_role_questions(bank):
    for seed in range(20):
        picked = pick_questions(bank, "backend", "medium", "technical", random.Random(seed))
        assert len(picked) == 5
        assert len({q["id"] for q in picked}) == 5
        assert all(q["role"] == "backend" for q in picked)
        # All medium ones first, then the nearest difficulties.
        assert sum(q["difficulty"] == "medium" for q in picked) == 3


def test_mixed_interview_includes_two_general_questions(bank):
    picked = pick_questions(bank, "database", "hard", "mixed", random.Random(1))
    assert len(picked) == 5
    assert [q["role"] for q in picked].count("general") == 2


def test_public_view_hides_the_answers(bank):
    view = public_view(bank["frontend"][0])
    assert "expected_topics" not in view and "keywords" not in view
    assert view["question"] == bank["frontend"][0]["question"]

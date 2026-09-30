"""Basic, rule-based analysis used when the AI isn't available.

It checks each answer against the question's expected topics (via keywords), how developed the
answer is, and whether it gives an example. It's deliberately simple and says so in the UI:
it can't judge correctness the way the AI can.
"""

import re
from statistics import mean

EXAMPLE_MARKERS = ["for example", "for instance", "e.g", "such as", "like when", "imagine"]


def analyze_answer(question: dict, answer: str) -> dict:
    text = answer.lower()
    hits = [any(keyword in text for keyword in words) for words in question["keywords"]]
    coverage = sum(hits) / len(hits)
    words = len(answer.split())
    depth = 1.0 if words >= 40 else 0.7 if words >= 20 else 0.4 if words >= 8 else 0.1
    has_example = any(marker in text for marker in EXAMPLE_MARKERS)
    score = max(0, min(10, round(coverage * 7 + depth * 2 + (1 if has_example else 0))))

    covered = [topic for topic, hit in zip(question["expected_topics"], hits) if hit]
    missing = [topic for topic, hit in zip(question["expected_topics"], hits) if not hit]
    return {
        "question": question,
        "score": score,
        "coverage": coverage,
        "depth": depth,
        "communication": communication(answer),
        "covered": covered,
        "missing": missing,
        "has_example": has_example,
    }


def communication(answer: str) -> float:
    sentences = [s for s in re.split(r"[.!?]+", answer) if s.strip()]
    words = len(answer.split())
    if not sentences or words < 5:
        return 0.3
    per_sentence = words / len(sentences)
    readable = 6 <= per_sentence <= 30
    if len(sentences) >= 2 and readable:
        return 0.9
    return 0.7 if readable else 0.5


def feedback_text(result: dict) -> str:
    parts = []
    if result["covered"]:
        parts.append("You covered: " + "; ".join(result["covered"]) + ".")
    if result["missing"]:
        parts.append("To strengthen it, also explain: " + "; ".join(result["missing"]) + ".")
    if result["depth"] < 0.7:
        parts.append("Add a bit more detail — a sentence or two on how and why.")
    if not result["has_example"]:
        parts.append("A short concrete example would make it more convincing.")
    return " ".join(parts) or "Solid answer."


def basic_analysis(items: list[tuple[dict, str]]) -> dict:
    """items: (question, answer) pairs, in interview order."""
    results = [analyze_answer(question, answer) for question, answer in items]
    scores = [r["score"] for r in results]
    overall = round(mean(scores) * 10)

    metrics = {
        "technicalKnowledge": pct(mean(r["coverage"] for r in results)),
        "answerRelevance": pct(mean((0.6 if r["coverage"] > 0 else 0) + 0.4 * r["coverage"]
                                    for r in results)),
        "conceptClarity": pct(mean(0.5 * r["depth"] + 0.5 * r["coverage"] for r in results)),
        "communication": pct(mean(r["communication"] for r in results)),
    }

    strong = [r for r in results if r["score"] >= 7]
    weak = sorted(results, key=lambda r: r["score"])
    strengths = [f"Covered the key points on {r['question']['topic']}" for r in strong][:3]
    if any(r["has_example"] for r in results):
        strengths.append("Used concrete examples to support answers")
    if not strengths:
        strengths = ["Completed all five questions — practising is how answers improve"]

    improvements = []
    for r in weak:
        if r["missing"] and r["score"] < 8:
            improvements.append(f"{r['question']['topic']} — {r['missing'][0]}")
    if not improvements:
        improvements = ["Go one level deeper: explain trade-offs, not just definitions"]

    recommendations = []
    for r in weak:
        topic = r["question"]["topic"]
        if topic not in recommendations and r["score"] < 9:
            recommendations.append(topic)

    return {
        "overallScore": overall,
        "metrics": metrics,
        "summary": summary_text(overall, strong, weak),
        "strengths": strengths[:4],
        "improvements": improvements[:4],
        "recommendations": recommendations[:3],
        "questionFeedback": [
            {"questionId": r["question"]["id"], "score": r["score"], "feedback": feedback_text(r)}
            for r in results
        ],
    }


def summary_text(overall: int, strong: list[dict], weak: list[dict]) -> str:
    if overall >= 80:
        opening = "Strong session: your answers hit most of the points an interviewer listens for."
    elif overall >= 60:
        opening = "Good foundation: you covered the main ideas in most answers."
    elif overall >= 40:
        opening = "A fair start: several answers touched the right ideas but stayed brief."
    else:
        opening = "Early days: many answers missed the key points interviewers look for."
    focus = weak[0]["question"]["topic"] if weak else None
    tail = f" Focus next on {focus}, and back each answer with a short example." if focus else ""
    return opening + tail


def pct(value: float) -> int:
    return max(0, min(100, round(value * 100)))

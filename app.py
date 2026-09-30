"""PrepMate AI — Flask app.

Serves the single-page frontend and a small JSON API. Secrets (like the Gemini key) are read
from environment variables / .env and never sent to the browser.

Run locally:  python app.py  →  http://127.0.0.1:5000
"""

import logging
import os

from dotenv import load_dotenv
from flask import Flask, abort, jsonify, render_template, request

from services.ai_service import AIUnavailable, gemini_analyze
from services.basic_analysis import basic_analysis
from services.questions import (
    DIFFICULTIES,
    QUESTIONS_PER_INTERVIEW,
    ROLES,
    TYPES,
    find_question,
    load_bank,
    pick_questions,
    public_view,
)

load_dotenv()
log = logging.getLogger("prepmate")

# Requests bigger than this are refused before they reach our code (5 answers fit easily).
MAX_REQUEST_BYTES = 64 * 1024
MAX_ANSWER_CHARS = 2000


class BadRequest(Exception):
    pass


def create_app(analyzer=gemini_analyze) -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY") or os.urandom(32)
    app.config["MAX_CONTENT_LENGTH"] = MAX_REQUEST_BYTES
    app.json.sort_keys = False
    bank = load_bank()  # fails fast at startup if a question file is broken

    @app.get("/")
    def index():
        return render_template("index.html", roles=ROLES)

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", ai=bool(os.environ.get("AI_API_KEY", "").strip()))

    @app.get("/api/questions")
    def questions():
        role = request.args.get("role", "")
        difficulty = request.args.get("difficulty", "medium")
        interview_type = request.args.get("type", "technical")
        if role not in ROLES or difficulty not in DIFFICULTIES or interview_type not in TYPES:
            return jsonify(error="Please choose a role, difficulty and interview type."), 400
        picked = pick_questions(bank, role, difficulty, interview_type)
        return jsonify(
            role=role,
            roleName=ROLES[role],
            difficulty=difficulty,
            type=interview_type,
            questions=[public_view(q) for q in picked],
        )

    @app.post("/api/analyze")
    def analyze():
        if (request.content_length or 0) > MAX_REQUEST_BYTES:
            abort(413)
        try:
            role, difficulty, items = parse_analysis_request(request.get_json(silent=True), bank)
        except BadRequest as error:
            return jsonify(error=str(error)), 400

        try:
            result = analyzer(ROLES[role], difficulty, items)
            result["source"] = "ai"
        except AIUnavailable as error:
            log.warning("AI analysis unavailable (%s); using basic analysis", error)
            result = basic_analysis(items)
            result["source"] = "basic"
            result["notice"] = (
                "This is a basic analysis based on the key points each answer covered. "
                "Try again later for full AI feedback."
            )

        # The model answer outline is shown with each question's feedback, after the interview.
        topics = {question["id"]: question["expected_topics"] for question, _ in items}
        for feedback in result["questionFeedback"]:
            feedback["expectedTopics"] = topics[feedback["questionId"]]
        return jsonify(result)

    # API errors are always short JSON messages, never HTML pages or stack traces.
    @app.errorhandler(404)
    def not_found(error):
        if request.path.startswith("/api/"):
            return jsonify(error="Not found."), 404
        return render_template("index.html", roles=ROLES), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify(error="That method isn't supported here."), 405

    @app.errorhandler(413)
    def too_large(error):
        return jsonify(error="That request is too large."), 413

    @app.errorhandler(500)
    def server_error(error):
        return jsonify(error="Something went wrong on our side. Please try again."), 500

    return app


def parse_analysis_request(payload, bank) -> tuple[str, str, list[tuple[dict, str]]]:
    """Check the submitted interview; question text always comes from our own bank."""
    if not isinstance(payload, dict):
        raise BadRequest("Send the interview as JSON.")
    role = payload.get("role")
    difficulty = payload.get("difficulty")
    answers = payload.get("answers")
    if role not in ROLES or difficulty not in DIFFICULTIES:
        raise BadRequest("Unknown role or difficulty.")
    if not isinstance(answers, list) or len(answers) != QUESTIONS_PER_INTERVIEW:
        raise BadRequest(f"Expected {QUESTIONS_PER_INTERVIEW} answers.")

    items, seen = [], set()
    for entry in answers:
        if not isinstance(entry, dict):
            raise BadRequest("Each answer needs a questionId and an answer.")
        question_id, answer = entry.get("questionId"), entry.get("answer")
        if not isinstance(question_id, str) or not isinstance(answer, str):
            raise BadRequest("Each answer needs a questionId and an answer.")
        question = find_question(bank, question_id)
        if question is None or question["role"] not in (role, "general") or question_id in seen:
            raise BadRequest("Those answers don't match this interview.")
        answer = answer.strip()
        if not answer:
            raise BadRequest("Every question needs an answer.")
        if len(answer) > MAX_ANSWER_CHARS:
            raise BadRequest(f"Answers can be at most {MAX_ANSWER_CHARS} characters.")
        seen.add(question_id)
        items.append((question, answer))
    return role, difficulty, items


app = create_app()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1")

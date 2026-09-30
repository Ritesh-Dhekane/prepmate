"""PrepMate AI — Flask app.

Serves the single-page frontend and a small JSON API. Secrets (like the Gemini key) are read
from environment variables / .env and never sent to the browser.

Run locally:  python app.py  →  http://127.0.0.1:5000
"""

import os

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

load_dotenv()

# Requests bigger than this are refused before they reach our code (5 answers fit easily).
MAX_REQUEST_BYTES = 64 * 1024


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY") or os.urandom(32)
    app.config["MAX_CONTENT_LENGTH"] = MAX_REQUEST_BYTES
    app.json.sort_keys = False

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    # API errors are always short JSON messages, never HTML pages or stack traces.
    @app.errorhandler(404)
    def not_found(error):
        if request.path.startswith("/api/"):
            return jsonify(error="Not found."), 404
        return render_template("index.html"), 404

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


app = create_app()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1")

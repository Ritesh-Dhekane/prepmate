# PrepMate AI

**Prepare. Practice. Perform.** — AI-powered mock interviews for students and junior developers.

Pick a role (Frontend, Backend, Full Stack or Database), hear five interview questions with the
spoken word highlighted as it's read, type your answers, and get AI feedback: an overall score,
four skill dimensions, strengths, areas to improve, practice topics and notes on every answer.

> AI scores are practice feedback, not an employment evaluation.

## Run it locally

Requires Python 3.10+.

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # then add your Gemini API key
python app.py
```

Open http://127.0.0.1:5000.

### Configuration (`.env`)

| Variable | What |
|---|---|
| `AI_API_KEY` | Google Gemini API key — get one at https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | Gemini model used for the analysis |
| `FLASK_SECRET_KEY` | Any long random string |

The key stays on the server; the browser never sees it. Never commit `.env`.

Without an API key (or when Gemini is unreachable) the app still works: the results page says
AI analysis isn't available and shows a basic analysis based on the key points each answer covered.

## Questions and audio

Questions live in `data/questions/<role>.json` (10 per role, plus `general.json` for Mixed
interviews). Each question has its spoken audio in `static/audio/` and word timings used to
highlight the word being read. After adding or editing questions, regenerate them (needs internet):

```bash
pip install -r requirements-dev.txt
python scripts/generate_audio.py
```

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

## How it works

```
Browser (HTML / CSS / JavaScript)
  ├── questions from JSON, audio + word timings
  ├── your answers, kept in the browser during the interview
  └── POST /api/analyze ──▶ Flask ──▶ Google Gemini
```

No database and no account needed.

## License

[MIT](LICENSE) © 2026 Ritesh Dhekane

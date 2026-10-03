# PrepMate AI

**Prepare. Practice. Perform.** — AI-powered mock interviews for students and junior developers.

Pick a role (Frontend, Backend, Full Stack or Database), hear five interview questions with the
spoken word highlighted as it's read, type your answers, and get AI feedback: an overall score,
four skill dimensions, strengths, areas to improve, practice topics and notes on every answer.

> AI scores are practice feedback, not an employment evaluation.

## Run it locally

Requires Python 3.10+. From the repo root:

```bash
run          # Windows (or double-click run.cmd)
./run.sh     # macOS / Linux
```

The first run creates `.venv`, installs the requirements and makes `.env` from `.env.example`;
later runs start straight away (requirements are reinstalled only when `requirements.txt`
changes). The browser opens at http://127.0.0.1:5000. Set `PORT` to use another port, or
`NO_BROWSER=1` to skip opening the browser.

<details>
<summary>Manual setup</summary>

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate      # macOS / Linux
pip install -r requirements.txt
cp .env.example .env           # then add your Gemini API key
python app.py
```

</details>

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
interviews). Each question has its spoken audio in `public/static/audio/` and word timings used to
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

## Deploy (Vercel)

The repo is ready for Vercel's free Hobby plan: Vercel finds the Flask `app` in `app.py`,
serves `public/` (the CSS, JS, images and audio under `/static`) from its CDN, and
`vercel.json` lets the AI analysis run for up to 60 seconds.

1. vercel.com, then **Add New, Project**, and import this GitHub repo (framework preset: Flask).
2. Under **Environment Variables** add `AI_API_KEY` (optional), `GEMINI_MODEL` (optional) and
   `FLASK_SECRET_KEY` (any long random string), then **Deploy**.
3. Every push to `main` deploys again; other branches get preview URLs.

## License

[MIT](LICENSE) © 2026 Ritesh Dhekane

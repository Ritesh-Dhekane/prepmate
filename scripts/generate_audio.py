"""Generate the spoken audio and word timings for every question.

Run once after adding or editing questions (needs an internet connection):

    python scripts/generate_audio.py            # only questions without audio / out of date
    python scripts/generate_audio.py --force    # everything

Uses edge-tts (Microsoft's online neural voices). Writes public/static/audio/<role>/<ID>.mp3 and adds
"audio" and "wordTimings" to each question in data/questions/*.json. The app itself never
generates speech; it only plays these files.
"""

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "questions"
AUDIO_DIR = ROOT / "public" / "static" / "audio"
VOICE = "en-US-AndrewNeural"
RATE = "-6%"  # a touch slower than default: clearer for interview questions


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


async def synthesize(text: str, out_path: Path) -> list[dict]:
    """Write the MP3 and return the spoken words with start/end times in seconds."""
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    audio = bytearray()
    spoken = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            start = chunk["offset"] / 1e7
            spoken.append(
                {"word": chunk["text"], "start": start, "end": start + chunk["duration"] / 1e7}
            )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(bytes(audio))
    return spoken


def align(text: str, spoken: list[dict]) -> tuple[list[dict], bool]:
    """Map spoken words onto the question's own words (split on spaces, punctuation kept).

    Returns (timings, exact). When the voice splits or reads words differently from the text,
    falls back to spreading the words over the audio by length (exact=False).
    """
    tokens = text.split()
    timings = []
    i = 0
    for token in tokens:
        target = normalize(token)
        heard = ""
        start = end = None
        while i < len(spoken) and len(heard) < len(target):
            piece = normalize(spoken[i]["word"])
            if not target.startswith(heard + piece):
                break
            heard += piece
            start = spoken[i]["start"] if start is None else start
            end = spoken[i]["end"]
            i += 1
        if heard != target or start is None:
            return spread(tokens, spoken), False
        timings.append({"word": token, "start": round(start, 3), "end": round(end, 3)})
    return timings, True


def spread(tokens: list[str], spoken: list[dict]) -> list[dict]:
    begin = spoken[0]["start"] if spoken else 0.0
    finish = spoken[-1]["end"] if spoken else 0.3 * len(tokens)
    total = sum(len(t) + 2 for t in tokens)
    timings, cursor = [], begin
    for token in tokens:
        length = (finish - begin) * (len(token) + 2) / total
        timings.append({"word": token, "start": round(cursor, 3), "end": round(cursor + length, 3)})
        cursor += length
    return timings


def format_questions(questions: list[dict]) -> str:
    """JSON with one field per line; list items (keywords, timings) each on a single line."""
    blocks = []
    for question in questions:
        lines = []
        for key, value in question.items():
            if isinstance(value, list):
                items = ",\n      ".join(json.dumps(item, ensure_ascii=False) for item in value)
                lines.append(f'    "{key}": [\n      {items}\n    ]')
            else:
                lines.append(f'    "{key}": {json.dumps(value, ensure_ascii=False)}')
        blocks.append("  {\n" + ",\n".join(lines) + "\n  }")
    return "[\n" + ",\n".join(blocks) + "\n]\n"


def up_to_date(question: dict, role: str) -> bool:
    path = AUDIO_DIR / role / f"{question['id']}.mp3"
    words = [t["word"] for t in question.get("wordTimings", [])]
    return path.exists() and words == question["question"].split()


async def main(force: bool) -> int:
    approximate = []
    for path in sorted(DATA_DIR.glob("*.json")):
        role = path.stem
        questions = json.loads(path.read_text(encoding="utf-8"))
        changed = False
        for question in questions:
            if not force and up_to_date(question, role):
                continue
            out = AUDIO_DIR / role / f"{question['id']}.mp3"
            spoken = await synthesize(question["question"], out)
            timings, exact = align(question["question"], spoken)
            if not exact:
                approximate.append(question["id"])
            question["audio"] = f"/static/audio/{role}/{question['id']}.mp3"
            question["wordTimings"] = timings
            changed = True
            print(f"{question['id']}: {out.stat().st_size // 1024} KB, {len(timings)} words"
                  f"{'' if exact else ' (approximate timings)'}")
        if changed:
            path.write_text(format_questions(questions), encoding="utf-8")
    if approximate:
        print("Approximate timings for:", ", ".join(approximate))
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--force", action="store_true", help="regenerate every question")
    sys.exit(asyncio.run(main(parser.parse_args().force)))

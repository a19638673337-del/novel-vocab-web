"""Build same-origin pronunciation assets; no TTS service is called by the website.

Requires edge-tts and imageio-ffmpeg in the generation environment only.
"""
import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT.parent / ".novel-audio-work"
OUT = ROOT / "client" / "assets" / "audio"
WORDS = ["proposal", "signature", "executive", "subordinate", "preliminary"]
VOICES = {"en-GB": "en-GB-SoniaNeural", "en-US": "en-US-JennyNeural"}


async def generate(word, accent, voice):
    name = f"{word}-{accent.lower()}.mp3"
    raw = WORK / name
    boundaries = []
    # A clear noun context disambiguates the final syllable of subordinate.
    text = "She is my subordinate." if word == "subordinate" else word + "."
    request = edge_tts.Communicate(text, voice, rate="-10%", boundary="WordBoundary",
                                  connect_timeout=15, receive_timeout=30)
    with raw.open("wb") as f:
        async for chunk in request.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                boundaries.append(chunk)
    if raw.stat().st_size < 1000:
        raise ValueError(f"Empty audio: {name}")
    command = [imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-y", "-i", str(raw)]
    if word == "subordinate":
        target = next(b for b in boundaries if b["text"].lower().strip(".") == word)
        start = max(0, target["offset"] / 10_000_000 - .025)
        duration = target["duration"] / 10_000_000 + .15
        command += ["-ss", str(start), "-t", str(duration)]
    command += ["-af", "apad=pad_dur=0.15", "-ar", "24000", "-ac", "1",
                "-codec:a", "libmp3lame", "-b:a", "64k", str(OUT / name)]
    subprocess.run(command, check=True, capture_output=True)
    # Decode the final asset as a concrete file-integrity check.
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(OUT / name),
                    "-f", "null", "-"], check=True, capture_output=True)
    print(json.dumps({"word": word, "accent": accent, "file": name,
                      "bytes": (OUT / name).stat().st_size}, ensure_ascii=False), flush=True)
    return {"word": word, "accent": accent, "voice": voice, "text": text,
            "boundaries": boundaries, "file": name}


async def main():
    WORK.mkdir(exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    available = {v["ShortName"] for v in await edge_tts.list_voices()}
    assert set(VOICES.values()) <= available, "Selected voices are unavailable"
    records = []
    # Bounded sequential requests: ten very short assets, no retry storm.
    for accent, voice in VOICES.items():
        for word in WORDS:
            records.append(await asyncio.wait_for(generate(word, accent, voice), timeout=50))
    (WORK / "generation-record.json").write_text(json.dumps(records, indent=2), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())

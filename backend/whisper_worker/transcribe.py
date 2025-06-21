# transcribe.py
# Requires: pip install openai-whisper

import whisper
import sys

def transcribe(input_path, lang):
    model = whisper.load_model("base")
    result = model.transcribe(input_path, language=lang)
    with open("output.srt", "w", encoding="utf-8") as f:
        for i, seg in enumerate(result["segments"]):
            f.write(f"{i+1}\n")
            f.write(f"{seg['start']} --> {seg['end']}\n")
            f.write(f"{seg['text']}\n\n")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python transcribe.py <video_path> <language>")
    else:
        transcribe(sys.argv[1], sys.argv[2])

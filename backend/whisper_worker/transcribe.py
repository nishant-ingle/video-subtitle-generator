import whisper
import sys

def format_timestamp(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"

def transcribe(input_path, lang):
    model = whisper.load_model("base")
    result = model.transcribe(input_path, language=lang)
    with open("output.srt", "w", encoding="utf-8") as f:
        for i, seg in enumerate(result["segments"]):
            start = format_timestamp(seg['start'])
            end = format_timestamp(seg['end'])
            f.write(f"{i+1}\n")
            f.write(f"{start} --> {end}\n")
            f.write(f"{seg['text']}\n\n")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python transcribe.py <video_path> <language>")
    else:
        transcribe(sys.argv[1], sys.argv[2])

---
name: discovery-knowledge-transcribe
description: Transcribes audio and video files (MP3, WAV, MP4, etc.) to timestamped Markdown and JSON using speech-to-text. Produces transcripts and executive summaries.
license: Apache-2.0
compatibility: Audio and video files. Requires a speech-to-text backend (e.g., Whisper).
metadata:
  author: discovery-knowledge
  version: "1.0"
---

# discovery-knowledge-transcribe — Audio/Video to Markdown

**Invoke when**: Ingesting audio files (MP3, WAV, FLAC, OGG) or video recordings (MP4, WebM, MKV) that contain technical content, interviews, workshops, or presentations.

**Inputs**:
- Audio/video file path: `<path>` (e.g., `input/workshop.mp4`, `vault/interview.mp3`)
- Output directory: `.discovery/knowledge/` (auto-created)

**Outputs**:
- **Transcript Markdown**: `.discovery/knowledge/transcripts/{filename}.md` (timestamped)
- **Summary Markdown**: `.discovery/knowledge/transcripts/{filename}-summary.md` (executive summary)
- **Transcript JSON**: `.discovery/knowledge/transcripts/{filename}.json` (structured with timing)
- **Ingestion log**: `.discovery/knowledge/state.json` (appends entry)

**Supported Formats**:
- Audio: MP3, WAV, FLAC, OGG, M4A
- Video: MP4, WebM, MKV, MOV, AVI

**Prerequisites**:
- ✅ **Mandatory**: FFmpeg (system package: `apt install ffmpeg` or `brew install ffmpeg`)
- 🔹 **Preferred**: voicebrief CLI (npm: `npm install -g voicebrief` or from https://voicebrief.ai/cli)
- 🔄 **Fallback**: Whisper API (requires OPENAI_API_KEY environment variable)

**Steps**:

1. **Validate Prerequisites**
   - Check: FFmpeg installed (`ffmpeg -version`)
   - Check: voicebrief available in PATH (`which voicebrief` or `where voicebrief`)
   - Decision: Use voicebrief if available; else Whisper API

2. **Extract Audio (if needed)**
   - If input is video: `ffmpeg -i <file> -q:a 0 -map a <tmp-audio.mp3>`
   - If input is audio: Skip directly to transcription

3. **Transcribe with voicebrief (preferred)**
   - Command: `voicebrief transcribe <file> --format markdown --timestamps --output <output.md>`
   - Output: Markdown with timecodes `[HH:MM:SS]` per sentence

4. **Transcribe with Whisper API (fallback)**
   - Command: `curl -X POST https://api.openai.com/v1/audio/transcriptions -H "Authorization: Bearer $OPENAI_API_KEY" -F "file=@<file>" -F "model=whisper-1" -F "response_format=verbose_json" | jq .`
   - Parse JSON: Extract `text`, `segments` (timestamps), `language`
   - Render: Convert to Markdown with `[HH:MM:SS]` timecodes

5. **Generate Summary**
   - Use LLM on full transcript: "Summarize this technical transcript in 3-5 key points with timecodes"
   - Output: `{filename}-summary.md` with executive list

6. **Create JSON Log**
   - Extract: Language, duration, word count, segments count, speaker turns (if detected)
   - Append to `.discovery/knowledge/state.json`: 
     ```json
     {
       "type": "transcription",
       "source": "<filepath>",
       "filename": "<filename>",
       "language": "<detected>",
       "duration_seconds": <int>,
       "word_count": <int>,
       "created": "<ISO-8601>",
       "transcription_tool": "voicebrief|whisper",
       "transcript_path": ".discovery/knowledge/transcripts/{filename}.md",
       "summary_path": ".discovery/knowledge/transcripts/{filename}-summary.md",
       "json_path": ".discovery/knowledge/transcripts/{filename}.json"
     }
     ```

7. **Verify Outputs**
   - Check: All 3 files exist and are non-empty
   - Check: Markdown is valid (no unclosed blocks, proper headings)
   - Check: Timestamps are sequential and within bounds

**Error Handling**:

- **FFmpeg not found**: "FFmpeg is required. Install: `apt install ffmpeg` (Linux) or `brew install ffmpeg` (macOS)"
- **voicebrief CLI error**: Fall back to Whisper API; log fallback in state.json
- **Whisper API timeout** (>60s): Split audio into 10-minute chunks, transcribe separately, concatenate with overlap markers
- **OPENAI_API_KEY missing**: "Whisper fallback requires OPENAI_API_KEY environment variable"
- **Corrupt audio**: "File is not valid audio/video" — skip with warning logged to state.json
- **Empty transcript**: Log warning; create placeholder `{filename}-summary.md` noting "No speech detected"

**Quality Checks**:
- Detect language automatically; log if uncertain (confidence < 0.8)
- Warn if transcript < 50 words (likely corrupt or metadata)
- Warn if segment timings have gaps > 5 seconds (likely transcription skips)
- Cross-check: If voicebrief available, compare voicebrief + Whisper on random 2-min sample for consistency

**Integration with Navigation Agent**:
- Called by: `@discovery-knowledge transcribe <audio/video>`
- Input source: User specifies file path; skill validates existence
- Output consumption: `.discovery/knowledge/transcripts/` ingested into functional map via `synthesize-extract-functionality` or `discovery-runtime-extract-functionality`

**Example Invocation**:
```
@discovery-knowledge transcribe input/user-workshop.mp4
```

**Output Example**:
```markdown
# Workshop Recording Transcript

[00:00:00] Facilitator: "Welcome to the GenAI Vanguard architecture overview session..."
[00:01:23] Participant A: "Can you explain the data model strategy?"
[00:02:15] Facilitator: "Absolutely. The model is three-tiered: API contracts, domain entities, and..."
...

## Summary
- Three-tiered data model (entities, API, persistence)
- Migration from Telefónica 3.0 to Angular 19 required refactor of scope/binding
- Test coverage target: 85% for critical paths
```

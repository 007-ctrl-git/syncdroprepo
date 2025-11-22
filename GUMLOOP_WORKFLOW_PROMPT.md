# Gumloop Workflow: SyncDrop LRC Generator

## COPY THIS ENTIRE PROMPT INTO GUMLOOP

---

## Workflow Overview

**Name:** SyncDrop LRC Generator
**Type:** API Webhook Trigger
**Purpose:** Convert audio + lyrics into synced LRC/SRT files (and optional karaoke video)

---

## STEP 1: Configure Webhook Trigger

1. Create new flow in Gumloop
2. Add trigger: **API Webhook**
3. Configure to accept POST requests with JSON body
4. Expected input format:

```json
{
  "audioUrl": "string",
  "lyrics": "string",
  "email": "string",
  "tier": "standard or pro",
  "includeLrc": true,
  "includeSrt": true,
  "includeVideo": false
}
```

---

## STEP 2: Download Audio File

**Action:** HTTP Request / File Download

- **Method:** GET
- **URL:** `{{audioUrl}}` (use input variable)
- **Save as:** `input_audio.mp3`
- **Timeout:** 30 seconds

**Error handling:** If download fails, return error JSON

---

## STEP 3: Call Lyric Sync API

Choose ONE of these options:

### OPTION A: LrcLib API (FREE, RECOMMENDED)

**Action:** HTTP Request

```
Method: POST
URL: https://lrclib.net/api/sync
Headers:
  Content-Type: application/json
Body:
{
  "audio": "{{input_audio_base64}}",
  "lyrics": "{{lyrics}}",
  "format": "lrc"
}
```

Response will contain synced LRC content.

### OPTION B: QuickLRC API (Paid but more accurate)

**Action:** HTTP Request

```
Method: POST
URL: https://api.quicklrc.com/v1/sync
Headers:
  Authorization: Bearer YOUR_QUICKLRC_API_KEY
  Content-Type: multipart/form-data
Body:
{
  "audio": {{input_audio_file}},
  "lyrics": "{{lyrics}}",
  "output": ["lrc", "srt"]
}
```

### OPTION C: Python Script with Aeneas (Open Source)

**Action:** Run Python Script

```python
from aeneas.executetask import ExecuteTask
from aeneas.task import Task

# Create task config
config_string = "task_language=eng|is_text_type=plain|os_task_file_format=lrc"

# Create task
task = Task(config_string=config_string)
task.audio_file_path_absolute = "input_audio.mp3"
task.text_file_path_absolute = "lyrics.txt"
task.sync_map_file_path_absolute = "output.lrc"

# Execute sync
ExecuteTask(task).execute()

# Read output
with open("output.lrc", "r") as f:
    lrc_content = f.read()

print(lrc_content)
```

**Save the LRC output to variable:** `lrc_content`

---

## STEP 4: Convert LRC to SRT Format

**Action:** Run Python/JavaScript Script

**Python version:**
```python
import re

def lrc_to_srt(lrc_content):
    lines = lrc_content.strip().split('\n')
    srt_lines = []
    counter = 1

    for i, line in enumerate(lines):
        # Match LRC timestamp format [mm:ss.xx]
        match = re.match(r'\[(\d+):(\d+)\.(\d+)\](.*)', line)
        if match:
            min1, sec1, ms1, text = match.groups()

            # Get next timestamp for end time
            if i + 1 < len(lines):
                next_match = re.match(r'\[(\d+):(\d+)\.(\d+)\]', lines[i + 1])
                if next_match:
                    min2, sec2, ms2 = next_match.groups()
                else:
                    # Default 3 second duration if no next line
                    total_ms = (int(min1) * 60 + int(sec1)) * 1000 + int(ms1) * 10 + 3000
                    min2 = total_ms // 60000
                    sec2 = (total_ms % 60000) // 1000
                    ms2 = (total_ms % 1000) // 10
            else:
                # Last line - add 3 seconds
                total_ms = (int(min1) * 60 + int(sec1)) * 1000 + int(ms1) * 10 + 3000
                min2 = total_ms // 60000
                sec2 = (total_ms % 60000) // 1000
                ms2 = (total_ms % 1000) // 10

            # Format SRT timestamp
            start = f"00:{min1.zfill(2)}:{sec1.zfill(2)},{str(int(ms1) * 10).zfill(3)}"
            end = f"00:{str(min2).zfill(2)}:{str(sec2).zfill(2)},{str(int(ms2) * 10).zfill(3)}"

            srt_lines.append(f"{counter}")
            srt_lines.append(f"{start} --> {end}")
            srt_lines.append(text.strip())
            srt_lines.append("")

            counter += 1

    return '\n'.join(srt_lines)

srt_content = lrc_to_srt(lrc_content)
print(srt_content)
```

**Save the SRT output to variable:** `srt_content`

---

## STEP 5: Upload LRC File to Storage

**Action:** Upload to Supabase Storage (or S3/R2)

**Supabase version:**
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const fileName = `${Date.now()}-${Math.random().toString(36)}.lrc`;

const { data, error } = await supabase.storage
  .from('generated-files')
  .upload(fileName, lrc_content, {
    contentType: 'text/plain',
    upsert: false
  });

const { data: urlData } = supabase.storage
  .from('generated-files')
  .getPublicUrl(fileName);

const lrc_url = urlData.publicUrl;
```

**Save to variable:** `lrc_url`

---

## STEP 6: Upload SRT File to Storage

**Action:** Same as Step 5, but for SRT

```javascript
const fileName = `${Date.now()}-${Math.random().toString(36)}.srt`;

const { data, error } = await supabase.storage
  .from('generated-files')
  .upload(fileName, srt_content, {
    contentType: 'text/plain',
    upsert: false
  });

const { data: urlData } = supabase.storage
  .from('generated-files')
  .getPublicUrl(fileName);

const srt_url = urlData.publicUrl;
```

**Save to variable:** `srt_url`

---

## STEP 7: Generate Karaoke Video (CONDITIONAL - Pro Tier Only)

**Condition:** Run this step only if `{{includeVideo}}` is `true`

**Action:** Run FFmpeg Command

```bash
ffmpeg -loop 1 -i background.png \
  -i input_audio.mp3 \
  -vf "subtitles=output.srt:force_style='FontName=Arial Black,FontSize=56,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Alignment=2,MarginV=120'" \
  -c:v libx264 -tune stillimage -c:a aac -b:a 192k \
  -pix_fmt yuv420p -shortest \
  -s 1920x1080 \
  output_video.mp4
```

**Alternative: Use MoviePy Python Script**

```python
from moviepy.editor import *
from moviepy.video.tools.subtitles import SubtitlesClip
import pysrt

# Load audio
audio = AudioFileClip("input_audio.mp3")

# Create background
bg = ColorClip(size=(1920, 1080), color=(10, 10, 20), duration=audio.duration)

# Load and style subtitles
def subtitle_style(txt):
    return TextClip(
        txt,
        font='Arial-Bold',
        fontsize=56,
        color='white',
        stroke_color='black',
        stroke_width=2,
        method='caption',
        size=(1600, None)
    )

subs = SubtitlesClip("output.srt", subtitle_style)
subs = subs.set_position(('center', 'center'))

# Composite
final = CompositeVideoClip([bg, subs])
final = final.set_audio(audio)
final = final.set_duration(audio.duration)

# Export
final.write_videofile("output_video.mp4", fps=24, codec='libx264', audio_codec='aac')
```

**Then upload video:**

```javascript
const videoFileName = `${Date.now()}-${Math.random().toString(36)}.mp4`;

const { data, error } = await supabase.storage
  .from('generated-files')
  .upload(videoFileName, videoFileBuffer, {
    contentType: 'video/mp4',
    upsert: false
  });

const { data: urlData } = supabase.storage
  .from('generated-files')
  .getPublicUrl(videoFileName);

const video_url = urlData.publicUrl;
```

**Save to variable:** `video_url`

---

## STEP 8: Return Success Response

**Action:** Return JSON Response

**For Standard Tier:**
```json
{
  "status": "success",
  "outputs": {
    "lrc_url": "{{lrc_url}}",
    "srt_url": "{{srt_url}}"
  }
}
```

**For Pro Tier (with video):**
```json
{
  "status": "success",
  "outputs": {
    "lrc_url": "{{lrc_url}}",
    "srt_url": "{{srt_url}}",
    "video_url": "{{video_url}}"
  }
}
```

---

## ERROR HANDLING

Add error handling at each step. If any step fails:

```json
{
  "status": "error",
  "error": "Description of what went wrong"
}
```

Common errors:
- Audio download failed
- Lyric sync failed (audio too short, lyrics don't match)
- Storage upload failed
- Video generation failed (pro tier)

---

## TESTING YOUR WORKFLOW

Test with this sample data:

```json
{
  "audioUrl": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  "lyrics": "This is line one\nThis is line two\nThis is line three",
  "email": "test@example.com",
  "tier": "standard",
  "includeLrc": true,
  "includeSrt": true,
  "includeVideo": false
}
```

Expected result:
- LRC file with timestamps
- SRT file with same timestamps
- Both files publicly accessible via URLs

---

## STORAGE SETUP REQUIREMENT

Before running workflow, create a new Supabase Storage bucket:

**Bucket name:** `generated-files`
**Public:** Yes
**File size limit:** 500 MB

Or use the existing bucket configuration in your Supabase project.

---

## PERFORMANCE TARGETS

- Standard tier: Complete in under 45 seconds
- Pro tier: Complete in under 90 seconds

Optimize by:
- Using faster lyric sync APIs
- Parallel processing where possible
- Pre-warming any cold-start environments

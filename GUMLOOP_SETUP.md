# Gumloop Workflow Setup Guide

This document provides the complete specification for building your Gumloop workflow that powers the SyncDrop LRC generation service.

---

## Overview

Your Gumloop workflow will receive audio files and lyrics, process them using QuickLRC or similar lyric sync tools, and return download URLs for the generated files.

---

## Workflow Input Schema

Your Gumloop workflow should accept the following JSON inputs:

```json
{
  "audioUrl": "https://storage.supabase.co/...",
  "lyrics": "Verse 1\nLine one of the song\nLine two of the song\n\nChorus\nHook line here",
  "email": "customer@example.com",
  "tier": "standard",
  "includeLrc": true,
  "includeSrt": true,
  "includeVideo": false
}
```

### Input Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `audioUrl` | string | Public URL to the uploaded audio file (MP3 or WAV) |
| `lyrics` | string | Full lyrics text submitted by the user |
| `email` | string | Customer email (for reference/logging) |
| `tier` | string | Either "standard" or "pro" |
| `includeLrc` | boolean | Always true - generate .lrc file |
| `includeSrt` | boolean | Always true - generate .srt file |
| `includeVideo` | boolean | True only when tier="pro" - generate karaoke video |

---

## Workflow Processing Steps

### 1. Download Audio File

Download the audio file from `audioUrl` to your Gumloop workflow's temporary storage.

```
Action: HTTP Request
Method: GET
URL: {{audioUrl}}
Save to: audio_file.mp3
```

### 2. Call QuickLRC API (or Alternative)

Use QuickLRC, LyricAlign, or similar API to sync the lyrics to the audio.

**Option A: QuickLRC API**
```
POST https://quicklrc.com/api/sync
Authorization: Bearer YOUR_QUICKLRC_API_KEY
Content-Type: multipart/form-data

{
  "audio": <audio_file.mp3>,
  "lyrics": {{lyrics}},
  "format": ["lrc", "srt"]
}
```

**Option B: Manual Python/Node.js Script**
If using a custom script with tools like forced-aligner:
```python
import forced_aligner

result = forced_aligner.align(
    audio_path="audio_file.mp3",
    lyrics=lyrics_text,
    output_formats=["lrc", "srt"]
)
```

### 3. Generate LRC File

Parse the sync data and generate a properly formatted .lrc file:

```
[00:12.00] Verse 1
[00:15.50] Line one of the song
[00:18.30] Line two of the song
[00:23.10]
[00:24.00] Chorus
[00:25.80] Hook line here
```

**Save to storage:** Upload to Supabase Storage, AWS S3, or similar

### 4. Generate SRT File

Convert the same sync data to .srt format:

```
1
00:00:12,000 --> 00:00:15,500
Verse 1

2
00:00:15,500 --> 00:00:18,300
Line one of the song

3
00:00:18,300 --> 00:00:23,100
Line two of the song
```

**Save to storage:** Upload to Supabase Storage, AWS S3, or similar

### 5. Generate Karaoke Video (Pro Tier Only)

Only execute this step when `includeVideo === true`:

Use FFmpeg, MoviePy, or a karaoke video generator to create a 1080p video with:
- Background: Dark gradient or solid color
- Text: Large, centered, white lyrics
- Timing: Synced to LRC timestamps
- Highlight: Current line highlighted in blue/cyan

**Example FFmpeg command:**
```bash
ffmpeg -i audio_file.mp3 \
  -f lavfi -i color=c=black:s=1920x1080 \
  -vf "subtitles=song.srt:force_style='FontName=Arial,FontSize=48,PrimaryColour=&H00FFFFFF,Alignment=2'" \
  -c:v libx264 -c:a aac -shortest \
  output_video.mp4
```

**Save to storage:** Upload to Supabase Storage, AWS S3, or similar

### 6. Return Output URLs

Your workflow must return this exact JSON structure:

```json
{
  "status": "success",
  "outputs": {
    "lrc_url": "https://storage.example.com/files/abc123.lrc",
    "srt_url": "https://storage.example.com/files/abc123.srt",
    "video_url": "https://storage.example.com/files/abc123.mp4"
  }
}
```

**For standard tier (no video):**
```json
{
  "status": "success",
  "outputs": {
    "lrc_url": "https://storage.example.com/files/abc123.lrc",
    "srt_url": "https://storage.example.com/files/abc123.srt"
  }
}
```

**For errors:**
```json
{
  "status": "error",
  "error": "Failed to sync lyrics: Audio file too short"
}
```

---

## Workflow Configuration in Gumloop

### Step-by-Step Gumloop Setup

1. **Create New Flow**
   - Go to Gumloop Dashboard
   - Click "Create New Flow"
   - Name it "SyncDrop LRC Generator"

2. **Add Trigger: API Webhook**
   - Type: REST API
   - Method: POST
   - Copy the webhook URL (you'll use this as `GUMLOOP_WORKFLOW_URL`)

3. **Add Input Variables**
   - audioUrl (string)
   - lyrics (string)
   - email (string)
   - tier (string)
   - includeLrc (boolean)
   - includeSrt (boolean)
   - includeVideo (boolean)

4. **Add Processing Steps**
   - HTTP Request: Download audio from `audioUrl`
   - API Call: QuickLRC or custom sync tool
   - File Processing: Generate .lrc and .srt files
   - Conditional Step: If `includeVideo` is true, generate video
   - Storage Upload: Upload files to cloud storage
   - Return Response: Format output JSON

5. **Test the Flow**
   ```bash
   curl -X POST https://api.gumloop.com/api/v1/flows/YOUR_FLOW_ID/run \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "audioUrl": "https://example.com/test.mp3",
       "lyrics": "Test line one\nTest line two",
       "email": "test@example.com",
       "tier": "standard",
       "includeLrc": true,
       "includeSrt": true,
       "includeVideo": false
     }'
   ```

6. **Copy API Credentials**
   - Copy your Flow ID from the URL
   - Copy your API key from Settings
   - Update your `.env` file:
     ```
     GUMLOOP_WORKFLOW_URL=https://api.gumloop.com/api/v1/flows/YOUR_FLOW_ID/run
     GUMLOOP_API_KEY=gl_your_api_key_here
     ```

---

## Recommended Tools

### For Lyric Syncing
- **QuickLRC** (API available, easiest)
- **Forced Aligner** (open source Python library)
- **Aeneas** (Python forced alignment tool)
- **Gentle** (forced aligner with web API)

### For Video Generation
- **FFmpeg** (command-line video processing)
- **MoviePy** (Python library for video editing)
- **Remotion** (React-based video generation)

### For File Storage
- **Supabase Storage** (recommended, already integrated)
- **AWS S3** (industry standard)
- **Cloudflare R2** (S3-compatible, no egress fees)
- **DigitalOcean Spaces** (simple and affordable)

---

## Expected Processing Times

- Standard Tier (LRC + SRT): 15-45 seconds
- Pro Tier (LRC + SRT + Video): 45-90 seconds

Your Gumloop workflow should complete within these timeframes for optimal user experience.

---

## Error Handling

Your workflow should handle these error cases:

1. **Audio file download fails**
   - Return: `{"status": "error", "error": "Failed to download audio file"}`

2. **Lyrics sync fails**
   - Return: `{"status": "error", "error": "Failed to sync lyrics to audio"}`

3. **Video generation fails** (pro tier)
   - Return: `{"status": "error", "error": "Failed to generate karaoke video"}`

4. **Storage upload fails**
   - Return: `{"status": "error", "error": "Failed to upload generated files"}`

---

## Testing Your Integration

Once your Gumloop workflow is ready:

1. Test with sample audio and lyrics using Gumloop's built-in testing
2. Verify all output URLs are publicly accessible
3. Test both standard and pro tiers
4. Confirm error cases return proper error messages
5. Deploy and connect to SyncDrop using the webhook URL and API key

---

## Support

If you need help setting up your Gumloop workflow:
- Gumloop Documentation: https://docs.gumloop.com
- QuickLRC API Docs: https://quicklrc.com/docs
- FFmpeg Documentation: https://ffmpeg.org/documentation.html

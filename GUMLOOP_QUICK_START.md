# QUICK START: Simple Gumloop Test Workflow

Use this simplified version to get your SyncDrop app working end-to-end in under 30 minutes. You can enhance it later with real lyric sync tools.

---

## Phase 1: Mock Workflow (For Testing Payment Flow)

Create a Gumloop workflow that returns MOCK data. This lets you test your entire app (payment, database, email) before building the real processing.

### Workflow Steps:

**1. Trigger: API Webhook**
- Accept POST requests with JSON body

**2. Add Delay (Simulate Processing)**
- Wait 10 seconds

**3. Return Mock Response**
- Use "Return Response" action
- Response body:

```json
{
  "status": "success",
  "outputs": {
    "lrc_url": "https://example.com/mock-song.lrc",
    "srt_url": "https://example.com/mock-song.srt",
    "video_url": "https://example.com/mock-video.mp4"
  }
}
```

**4. Copy Your Webhook URL**
- Example: `https://api.gumloop.com/api/v1/flows/abc123/run`
- Add to your `.env` as `GUMLOOP_WORKFLOW_URL`

**5. Copy Your API Key**
- Go to Gumloop Settings → API Keys
- Add to your `.env` as `GUMLOOP_API_KEY`

**Test it works:**
```bash
curl -X POST https://api.gumloop.com/api/v1/flows/YOUR_FLOW_ID/run \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "audioUrl": "https://example.com/test.mp3",
    "lyrics": "Test lyrics",
    "email": "test@example.com",
    "tier": "standard"
  }'
```

Expected response:
```json
{
  "status": "success",
  "outputs": {
    "lrc_url": "https://example.com/mock-song.lrc",
    "srt_url": "https://example.com/mock-song.srt"
  }
}
```

---

## Phase 2: Real LRC Generation (Production-Ready)

Once Phase 1 works, upgrade to REAL lyric syncing:

### Option A: Use Aeneas (Free, Open Source)

**Install in Gumloop:**
```bash
pip install aeneas
```

**Workflow Logic:**

```python
# Step 1: Download audio
import requests
response = requests.get(audioUrl)
with open('input.mp3', 'wb') as f:
    f.write(response.content)

# Step 2: Save lyrics to file
with open('lyrics.txt', 'w') as f:
    f.write(lyrics)

# Step 3: Run Aeneas
from aeneas.executetask import ExecuteTask
from aeneas.task import Task

config = "task_language=eng|is_text_type=plain|os_task_file_format=lrc"
task = Task(config_string=config)
task.audio_file_path_absolute = "input.mp3"
task.text_file_path_absolute = "lyrics.txt"
task.sync_map_file_path_absolute = "output.lrc"

ExecuteTask(task).execute()

# Step 4: Read generated LRC
with open('output.lrc', 'r') as f:
    lrc_content = f.read()

# Step 5: Convert to SRT (use conversion function from GUMLOOP_WORKFLOW_PROMPT.md)

# Step 6: Upload both files to Supabase Storage
# Step 7: Return URLs
```

### Option B: Use LrcLib API (Free, No Setup)

**Simpler but less control:**

```python
import requests
import base64

# Download audio
audio_response = requests.get(audioUrl)
audio_base64 = base64.b64encode(audio_response.content).decode()

# Call LrcLib
response = requests.post('https://lrclib.net/api/sync', json={
    'audio': audio_base64,
    'lyrics': lyrics
})

lrc_content = response.json()['lrc']

# Convert to SRT and upload (same as Option A)
```

---

## Phase 3: Add Video Generation (Pro Tier)

### Simple Video with FFmpeg:

**Install FFmpeg in Gumloop environment**

**Generate solid color background + subtitles:**

```bash
# Create black background image
ffmpeg -f lavfi -i color=c=black:s=1920x1080:d=1 -frames:v 1 bg.png

# Generate video with subtitles
ffmpeg -loop 1 -i bg.png \
  -i input.mp3 \
  -vf "subtitles=output.srt:force_style='FontName=Arial,FontSize=48,PrimaryColour=&HFFFFFF,Alignment=2'" \
  -c:v libx264 -c:a copy -shortest -pix_fmt yuv420p \
  output.mp4
```

**Upload output.mp4 to storage and return URL**

---

## Recommended Development Order:

1. ✅ **Phase 1 (Mock)** - Test entire app flow with fake files
2. ✅ **Phase 2 (Real LRC/SRT)** - Get actual lyric syncing working
3. ✅ **Phase 3 (Video)** - Add pro tier karaoke video feature

---

## Need Help? Common Issues:

### Issue: "Gumloop workflow timeout"
- Increase timeout in Gumloop settings
- Optimize processing (use faster APIs)

### Issue: "LRC timestamps don't match audio"
- Check audio quality (clear vocals work best)
- Try different sync tools (Aeneas vs LrcLib)
- Pre-process audio (noise reduction)

### Issue: "Video generation takes too long"
- Reduce video resolution (1280x720 instead of 1920x1080)
- Use simpler subtitle styling
- Consider generating videos asynchronously

### Issue: "Files not accessible"
- Verify Supabase storage bucket is public
- Check CORS settings
- Confirm file URLs are correct format

---

## Testing Checklist:

- [ ] Mock workflow returns valid JSON
- [ ] SyncDrop receives Gumloop response
- [ ] Database updates with file URLs
- [ ] Email sends with download links
- [ ] Files are accessible via links
- [ ] Standard tier includes LRC + SRT
- [ ] Pro tier includes video
- [ ] Error handling works (failed sync, timeout)

---

## What You Need Right Now:

1. **Gumloop account** - Sign up at gumloop.com
2. **Create a new flow** - Use API webhook trigger
3. **Start with Phase 1 (mock)** - Get the full system working first
4. **Get your credentials:**
   - Workflow URL (from Gumloop dashboard)
   - API Key (from Gumloop settings)
5. **Add to `.env`:**
   ```
   GUMLOOP_WORKFLOW_URL=https://api.gumloop.com/api/v1/flows/YOUR_FLOW_ID/run
   GUMLOOP_API_KEY=gl_your_key_here
   ```

Once Phase 1 works end-to-end, upgrade to Phase 2 for real processing!

# SyncDrop - Project Summary

## Security Model

Your app prioritizes **payment security** over file security:

✅ **What's Protected:**
- Payment/card data - Never stored, handled entirely by Stripe
- Customer data - Minimal storage, auto-expires after 48 hours
- No user accounts or passwords to secure

✅ **What's Ephemeral:**
- Orders - Auto-deleted after 48 hours
- Files - Sent directly via email, customer controls them
- Audio uploads - Can be deleted after processing

## File Delivery Architecture

### LRC & SRT Files (Standard + Pro Tier)
- **Sent as email attachments** (small files, ~10KB)
- Customer downloads directly from their inbox
- No expiration worries
- Customer owns the files permanently

### Video Files (Pro Tier Only)
- **Sent as download link** (too large for email, typically 50-100MB)
- Link expires after 48 hours
- Stored in Supabase Storage temporarily

## Data Flow

```
1. User uploads audio + lyrics → Pays via Stripe
2. Audio stored in Supabase Storage → Public URL generated
3. Stripe webhook confirms payment → Triggers processing
4. Gumloop downloads audio from public URL
5. Gumloop generates:
   - LRC file content (text)
   - SRT file content (text)
   - Video file (uploads to storage, returns URL)
6. Backend sends email with:
   - LRC file as attachment
   - SRT file as attachment
   - Video download link (pro tier)
7. Order expires after 48 hours
```

## What Gumloop Must Return

Your Gumloop workflow MUST return this JSON structure:

```json
{
  "status": "success",
  "outputs": {
    "lrc_content": "[00:12.00]Line one\n[00:15.50]Line two",
    "srt_content": "1\n00:00:12,000 --> 00:00:15,500\nLine one\n\n2\n00:00:15,500 --> 00:00:18,000\nLine two",
    "lrc_url": "https://backup-link.com/song.lrc",
    "srt_url": "https://backup-link.com/song.srt",
    "video_url": "https://storage.supabase.co/.../video.mp4"
  }
}
```

**Required fields:**
- `lrc_content` - Full LRC file text
- `srt_content` - Full SRT file text
- `lrc_url` - Backup download link (shown in email)
- `srt_url` - Backup download link (shown in email)
- `video_url` - Only for pro tier

## Storage Buckets

### audio-uploads
- Stores user-uploaded MP3/WAV files
- Public access (so Gumloop can download)
- Can be cleaned up after processing

### generated-files
- Stores pro-tier video files only
- LRC/SRT don't need storage (sent as attachments)
- Files expire after 48 hours

## Environment Variables Needed

```bash
# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=https://dsljwszjpjysertyesvt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE=eyJ...  # Get from Supabase dashboard

# Stripe
STRIPE_SECRET_KEY=sk_test_...  # From Stripe dashboard
STRIPE_WEBHOOK_SECRET=whsec_...  # After setting up webhook

# Gumloop
GUMLOOP_WORKFLOW_URL=https://api.gumloop.com/api/v1/flows/YOUR_FLOW_ID/run
GUMLOOP_API_KEY=gl_...

# Resend (email)
RESEND_API_KEY=re_...  # From resend.com
```

## Next Steps

### 1. Set Up Gumloop (30 minutes)
- Follow `GUMLOOP_QUICK_START.md`
- Start with Phase 1 (mock data)
- Test full payment flow works
- Then upgrade to Phase 2 (real processing)

### 2. Set Up Stripe (15 minutes)
- Get secret key from dashboard
- Create webhook endpoint
- Add keys to `.env`

### 3. Set Up Resend (10 minutes)
- Sign up at resend.com
- Verify your domain
- Get API key
- Add to `.env`

### 4. Test End-to-End
- Submit form with test audio
- Pay with Stripe test card
- Confirm email arrives with attachments
- Download LRC/SRT files
- Verify video link works (pro tier)

## Testing Without Real Services

You can test the full flow using mock responses:

**Mock Gumloop Response:**
```json
{
  "status": "success",
  "outputs": {
    "lrc_content": "[00:00.00]Test line one\n[00:03.00]Test line two",
    "srt_content": "1\n00:00:00,000 --> 00:00:03,000\nTest line one",
    "lrc_url": "https://example.com/test.lrc",
    "srt_url": "https://example.com/test.srt"
  }
}
```

This lets you verify:
- Payment processing works
- Database updates correctly
- Email sends with attachments
- Frontend polling works

## Important Notes

1. **Email attachments work because LRC/SRT files are tiny** (~10KB)
2. **Videos are too large for email** (50-100MB), so they use download links
3. **No permanent storage needed** - files live in customer's email
4. **48-hour expiration** provides security through time limits
5. **Gumloop can access audio directly** from public Supabase Storage URL

## Files in This Project

### Core Application
- `app/page.tsx` - Main form UI
- `app/api/checkout/route.ts` - Creates Stripe session, uploads audio
- `app/api/stripe/route.ts` - Webhook handler, triggers processing
- `app/api/status/route.ts` - Status polling endpoint

### Helper Libraries
- `lib/gumloop.ts` - Calls Gumloop workflow
- `lib/email.ts` - Sends email with attachments via Resend

### Documentation
- `GUMLOOP_QUICK_START.md` - Start here for Gumloop setup
- `GUMLOOP_WORKFLOW_PROMPT.md` - Detailed workflow specs
- `GUMLOOP_SETUP.md` - Complete technical reference
- `PROJECT_SUMMARY.md` - This file

### Configuration
- `.env` - Your API keys (update with real values)
- `.env.example` - Template showing what's needed

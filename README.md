# SyncDrop

**Studio-grade lyric sync in 60 seconds**

A mobile-first web app that lets independent musicians upload a song and get AI-synced lyric files (.lrc & .srt) in under 60 seconds, with an optional 1080p karaoke video.

## Features

- Single-page, dark-themed indie studio design
- No authentication required
- Mobile-first responsive design
- Stripe Checkout integration (test mode)
- Supabase backend (Postgres + Storage)
- Real-time order status polling
- Email delivery with 48-hour expiring download links

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + Inter font
- **Database**: Supabase (Postgres + Storage)
- **Payments**: Stripe Checkout
- **Deployment**: Vercel-ready

## Pricing Tiers

- **Standard ($5)**: .lrc + .srt files
- **Pro ($12)**: .lrc + .srt files + 1080p karaoke video

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE=<secret-service-key>

# Stripe
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_... (you'll get this in step 3)

# APIs
QUICKLRC_API_KEY=ql_test_...
MY_KARAOKE_API_KEY=mkv_...
```

### 3. Set Up Stripe Webhook (Local Development)

**Install Stripe CLI:**

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows/Linux: https://stripe.com/docs/stripe-cli
```

**Login and forward webhooks:**

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe
```

Copy the webhook signing secret (starts with `whsec_`) and add it to `.env.local` as `STRIPE_WEBHOOK_SECRET`.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Test Payment Flow

Use Stripe test cards:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- Use any future expiry date, any CVC, and any ZIP code.

## Database Schema

The Supabase migration creates:

### `orders` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `email` | text | Customer email |
| `stripe_payment_intent_id` | text | Stripe reference (unique) |
| `audio_file_url` | text | Uploaded audio file URL |
| `lrc_url` | text | Generated .lrc file URL |
| `srt_url` | text | Generated .srt file URL |
| `video_url` | text | Karaoke video URL (Pro tier only) |
| `tier` | text | "standard" or "pro" |
| `status` | text | "pending", "processing", "done", or "failed" |
| `created_at` | timestamptz | Order timestamp |
| `expires_at` | timestamptz | Download expiration (48 hours) |

### Storage bucket
- `audio-uploads`: For temporary audio file storage

## API Routes

### `POST /api/checkout`
Creates a Stripe Checkout session.

**Body** (FormData):
- `audioFile`: Audio file (MP3/WAV, max 25MB)
- `lyrics`: Song lyrics (text)
- `email`: Customer email
- `tier`: "standard" or "pro"

**Response**:
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

### `POST /api/stripe`
Webhook endpoint for Stripe events. Handles `checkout.session.completed` events.

### `GET /api/status?email={email}`
Poll for order status.

**Response**:
```json
{
  "status": "done",
  "urls": {
    "lrc_url": "https://...",
    "srt_url": "https://...",
    "video_url": "https://..."
  }
}
```

## Integrating External APIs

The webhook handler (`/app/api/stripe/route.ts`) currently returns mock URLs. To integrate real APIs:

### QuickLRC API Integration

Replace the mock data in `processOrder()` function (line 79):

```typescript
// 1. Upload audio to Supabase Storage
const audioFile = /* get from form data */;
const fileName = `${orderId}.mp3`;

const { data: uploadData, error: uploadError } = await supabase.storage
  .from("audio-uploads")
  .upload(fileName, audioFile, {
    contentType: audioFile.type,
  });

if (uploadError) throw uploadError;

// 2. Get public URL
const { data: urlData } = supabase.storage
  .from("audio-uploads")
  .getPublicUrl(fileName);

const audioUrl = urlData.publicUrl;

// 3. Call QuickLRC API
const quickLrcResponse = await fetch("https://api.quicklrc.com/sync", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.QUICKLRC_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    audio_url: audioUrl,
    lyrics: lyrics,
    output_format: ["lrc", "srt"]
  }),
});

const { lrc_url, srt_url } = await quickLrcResponse.json();
```

### Karaoke Video API Integration

```typescript
let video_url = null;

if (tier === "pro") {
  const karaokeResponse = await fetch("https://api.karaoke.video/generate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.MY_KARAOKE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      lrc_url: lrc_url,
      resolution: "1080p"
    }),
  });

  const data = await karaokeResponse.json();
  video_url = data.video_url;
}

// Update order with real URLs
const { error: updateError } = await supabase
  .from("orders")
  .update({
    lrc_url,
    srt_url,
    video_url,
    audio_file_url: audioUrl,
    status: "done",
  })
  .eq("id", orderId);
```

## Production Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE`
   - `STRIPE_SECRET_KEY` (use live key: `sk_live_...`)
   - `STRIPE_WEBHOOK_SECRET` (production webhook secret)
   - `QUICKLRC_API_KEY`
   - `MY_KARAOKE_API_KEY`
4. Deploy

### Configure Stripe Webhook (Production)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Developers → Webhooks
2. Click "Add endpoint"
3. Enter URL: `https://yourdomain.com/api/stripe`
4. Select event: `checkout.session.completed`
5. Copy the signing secret and add to Vercel environment variables as `STRIPE_WEBHOOK_SECRET`

### Swap to Production Keys

Update environment variables in Vercel:
- Replace Stripe test keys (`sk_test_...`) with live keys (`sk_live_...`)
- Use production webhook secret from Stripe Dashboard
- Update to production API keys for QuickLRC and Karaoke APIs

## Project Structure

```
syncdrop/
├── app/
│   ├── api/
│   │   ├── checkout/
│   │   │   └── route.ts          # Stripe Checkout session
│   │   ├── stripe/
│   │   │   └── route.ts          # Webhook handler
│   │   └── status/
│   │       └── route.ts          # Order status polling
│   ├── globals.css               # Global styles + Inter font
│   ├── layout.tsx                # Root layout with metadata
│   └── page.tsx                  # Main page component
├── components/ui/                # shadcn/ui components
├── .env.example                  # Environment template
├── .env.local                    # Your local config (git-ignored)
├── README.md                     # This file
└── package.json
```

## Customization

### Change Pricing

Edit `app/api/checkout/route.ts` (line 13):

```typescript
const prices = {
  standard: 500,  // $5.00 in cents
  pro: 1200,      // $12.00 in cents
};
```

### Update Design Theme

Edit `app/page.tsx` and modify Tailwind classes. Current theme:
- Dark gradient: `from-gray-900 via-black to-gray-900`
- Blue accent: `blue-500`, `blue-600`, `blue-700`
- Cyan Pro tier: `cyan-400`, `cyan-500`

### Add Email Notifications

Install an email service (e.g., [Resend](https://resend.com)) and add to `processOrder()`:

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'SyncDrop <hello@syncdrop.com>',
  to: email,
  subject: 'Your SyncDrop files are ready!',
  html: `
    <h2>Your files are ready to download!</h2>
    <p><a href="${lrc_url}">Download .lrc file</a></p>
    <p><a href="${srt_url}">Download .srt file</a></p>
    ${video_url ? `<p><a href="${video_url}">Download karaoke video</a></p>` : ''}
    <p><small>Links expire in 48 hours</small></p>
  `,
});
```

## Security Notes

- Audio files stored in private Supabase storage
- Download links expire after 48 hours
- Webhook signature verification prevents unauthorized requests
- Row Level Security (RLS) enabled on orders table
- Service role key only used server-side
- No sensitive data exposed to client

## Troubleshooting

**Build fails with "Module not found: stripe"**
```bash
npm install stripe
```

**Webhook not receiving events**
- Ensure Stripe CLI is running: `stripe listen --forward-to localhost:3000/api/stripe`
- Check webhook secret matches in `.env.local`

**Database connection error**
- Verify Supabase credentials in `.env.local`
- Check that migration has been applied (orders table exists)

**Payment succeeds but order not created**
- Check webhook logs in Stripe Dashboard
- Verify `SUPABASE_SERVICE_ROLE` is set correctly

## License

MIT

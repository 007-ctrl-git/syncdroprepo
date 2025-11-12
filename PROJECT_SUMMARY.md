# PROJECT SUMMARY

**Generated:** 2025-11-12
**Project:** SyncDrop - Studio-grade lyric sync service
**Stack:** Next.js 13.5.1 + Supabase + Stripe

---

## A. File Tree

```
/tmp/cc-agent/59332950/project/
├── app/
│   ├── api/
│   │   ├── checkout/route.ts       # Stripe checkout session creation
│   │   ├── stripe/route.ts         # Stripe webhook handler
│   │   └── status/route.ts         # Order status polling endpoint
│   ├── page.tsx                    # Main upload form + results page
│   ├── layout.tsx                  # Root layout with metadata
│   └── globals.css                 # Global styles
├── components/ui/                  # 40+ shadcn/ui components
├── lib/utils.ts                    # Tailwind utility function
├── hooks/use-toast.ts              # Toast hook
├── supabase/
│   └── migrations/
│       └── 20251029141407_add_lyrics_column.sql
├── .env                            # Environment variables (git-ignored)
├── .env.example                    # Environment template
├── package.json                    # Next.js 13.5.1, React 18.2.0, Stripe 19.1.0
├── tsconfig.json                   # TypeScript config
└── README.md                       # Full documentation
```

---

## B. Framework & Entry Points

### Backend
- **Framework:** Next.js 13.5.1 (App Router) - API routes in `app/api/`
- **Entry Point:** `npm run dev` starts Next.js server on port 3000
- **Database:** Supabase (Postgres + Storage)
- **Payment:** Stripe Checkout + Webhooks

### Frontend
- **Framework:** Next.js with React 18.2.0 (Server + Client Components)
- **Styling:** Tailwind CSS + shadcn/ui components
- **Entry Point:** `app/page.tsx` (main upload form)
- **Client Component:** Uses `"use client"` for state management

### Runtime Requirements
- Node.js (version not pinned, likely 18+)
- TypeScript 5.2.2
- Next.js 13.5.1

---

## C. API Routes

### 1. POST `/api/checkout`
**File:** `app/api/checkout/route.ts`

**Purpose:** Creates Stripe checkout session and stores order in database

**Expects:**
- `FormData` with fields:
  - `audioFile`: File (MP3/WAV, max 25MB)
  - `lyrics`: string (plain text lyrics)
  - `email`: string (customer email)
  - `tier`: "standard" | "pro"

**Returns:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

**Flow:**
1. Uploads audio file to Supabase Storage bucket `audio-uploads`
2. Generates UUID for order (`orderId`)
3. Creates order record in `orders` table with status "pending"
4. Creates Stripe checkout session with metadata
5. Returns checkout URL

**Lines:** 16-115

---

### 2. POST `/api/stripe`
**File:** `app/api/stripe/route.ts`

**Purpose:** Stripe webhook handler (receives payment events)

**Expects:**
- Stripe webhook payload (JSON)
- Header: `stripe-signature` for verification

**Returns:**
```json
{
  "received": true
}
```

**Flow:**
1. Verifies webhook signature using `STRIPE_WEBHOOK_SECRET`
2. On `checkout.session.completed` event:
   - Updates order status to "processing"
   - Calls `processOrder()` function asynchronously
   - **CRITICAL:** Currently generates MOCK URLs (lines 88-90)

**Lines:** 16-115

---

### 3. GET `/api/status?email={email}`
**File:** `app/api/status/route.ts`

**Purpose:** Poll order status (frontend polls every 2s)

**Expects:**
- Query param: `email` (string)

**Returns:**
```json
{
  "status": "pending" | "processing" | "done" | "failed",
  "urls": {
    "lrc_url": "https://...",
    "srt_url": "https://...",
    "video_url": "https://..." // Only if tier === "pro"
  }
}
```

**Flow:**
1. Queries `orders` table for most recent order by email
2. Returns order status and download URLs

**Lines:** 11-55

---

### Missing Routes for MVP
None - all required endpoints exist. However:
- **BLOCKER:** No actual LRC/SRT/video generation logic (mock URLs only)
- No download endpoint (currently using external mock URLs)

---

## D. Upload & Alignment Pipeline

### Upload Handling
**File:** `app/api/checkout/route.ts` (lines 17-46)

**Code:**
```typescript
const formData = await request.formData();
const audioFile = formData.get("audioFile") as File;
const lyrics = formData.get("lyrics") as string;

// Upload to Supabase Storage
const { data: uploadData, error: uploadError } = await supabase.storage
  .from("audio-uploads")
  .upload(fileName, audioFile, {
    contentType: audioFile.type,
  });

// Get public URL
const { data: urlData } = supabase.storage
  .from("audio-uploads")
  .getPublicUrl(fileName);
```

**Storage:** Audio files stored in Supabase Storage bucket `audio-uploads`

---

### Lyrics-to-Audio Alignment
**File:** `app/api/stripe/route.ts` (lines 76-115)

**Status:** **PLACEHOLDER/STUB ONLY**

**Current Code (lines 86-90):**
```typescript
await new Promise((resolve) => setTimeout(resolve, 2000)); // Fake delay

const mockLrcUrl = `https://example.com/song-${orderId}.lrc`;
const mockSrtUrl = `https://example.com/song-${orderId}.srt`;
const mockVideoUrl = tier === "pro" ? `https://example.com/karaoke-${orderId}.mp4` : null;
```

**What's Missing:**
1. No actual audio analysis
2. No lyrics parsing/splitting
3. No timestamp generation
4. No LRC/SRT file creation
5. No karaoke video generation

**Data Available to processOrder():**
- `order.audio_file_url` - Public URL to uploaded audio
- `order.lyrics` - Plain text lyrics from user
- `tier` - "standard" or "pro"

**Lines:** 76-115

---

## E. Frontend Flow

### Upload Form
**File:** `app/page.tsx` (lines 208-362)

**Components:**
1. Audio file upload (lines 229-252) - `<input type="file" accept=".mp3,.wav">`
2. Lyrics textarea (lines 254-268)
3. Email + confirm email (lines 270-304)
4. Tier selection buttons (lines 306-342) - Standard ($5) or Pro ($12)
5. Submit button (lines 344-350)

**Validation (lines 43-68):**
- Audio file required, max 25MB
- Lyrics required (non-empty)
- Email format validation
- Email confirmation match

**Submission Flow (lines 115-144):**
```typescript
const formData = new FormData();
formData.append("audioFile", audioFile!);
formData.append("lyrics", lyrics);
formData.append("email", email);
formData.append("tier", tier);

const response = await fetch("/api/checkout", {
  method: "POST",
  body: formData,
});

const data = await response.json();
if (data.url) {
  window.location.href = data.url; // Redirect to Stripe Checkout
}
```

---

### Order Status Polling
**File:** `app/page.tsx` (lines 31-41, 82-113)

**Trigger:** On redirect back from Stripe with `?success=true&email=...`

**Polling Logic:**
- Polls `/api/status?email={email}` every 2 seconds
- Max 60 attempts (120 seconds total)
- Stops when status is "done" or "failed"

**Code (lines 82-113):**
```typescript
const poll = async () => {
  const response = await fetch(`/api/status?email=${encodeURIComponent(email)}`);
  const data = await response.json();

  if (data.status === "done") {
    setOrderStatus(data);
    setIsProcessing(false);
  } else if (data.status === "failed") {
    setOrderStatus(data);
    setIsProcessing(false);
  } else {
    attempts++;
    setTimeout(poll, 2000);
  }
};
```

---

### Results Display
**File:** `app/page.tsx` (lines 146-194)

**Displays:**
- Download links for .lrc file
- Download links for .srt file
- Download link for 1080p video (Pro tier only)
- Email confirmation + expiration notice (48 hours)

**Note:** Uses `<a href={url} download>` - requires actual file URLs

---

### Preview
**Status:** Not found

No audio player or LRC preview component exists in the codebase.

---

## F. Dev Commands

### Start Development Server
```bash
npm run dev
```
- Starts Next.js dev server on `http://localhost:3000`
- Hot reload enabled

### Build for Production
```bash
npm run build
```

### Run Production Server
```bash
npm run start
```

### Type Check
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
```

---

### Stripe Webhook (Local Dev)
```bash
stripe listen --forward-to localhost:3000/api/stripe
```
Copy the webhook signing secret (`whsec_...`) to `.env` as `STRIPE_WEBHOOK_SECRET`

---

### Environment Variables Required
**File:** `.env` (use `.env.example` as template)

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE=<secret-service-key>

STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...

QUICKLRC_API_KEY=ql_test_...      # Not used yet
MY_KARAOKE_API_KEY=mkv_...        # Not used yet
```

---

### Key Dependencies
```json
{
  "next": "13.5.1",
  "react": "18.2.0",
  "stripe": "^19.1.0",
  "@supabase/supabase-js": "^2.58.0",
  "tailwindcss": "3.3.3",
  "typescript": "5.2.2"
}
```

---

## G. Gaps & Quick Wins

### CRITICAL BLOCKER
1. **No actual file generation** - `processOrder()` returns mock URLs
   - **File:** `app/api/stripe/route.ts:86-90`
   - **Action:** Implement real LRC/SRT generation logic

### Required for MVP

2. **Implement LRC generation**
   - Parse lyrics into lines
   - Generate timestamps (requires audio analysis or API)
   - Format as LRC: `[mm:ss.xx]Line of lyrics`
   - Upload to Supabase Storage
   - Return public URL

3. **Implement SRT generation**
   - Same as LRC but format as SubRip:
     ```
     1
     00:00:12,000 --> 00:00:15,000
     Line of lyrics
     ```

4. **Implement video generation (Pro tier)**
   - Generate 1080p karaoke video with lyrics overlay
   - Options:
     - Use external API (my.karaoke.video, etc.)
     - Build FFmpeg pipeline (complex)

5. **Supabase Storage bucket setup**
   - Ensure `audio-uploads` bucket exists
   - Create `output-files` bucket for LRC/SRT/video
   - Configure public access or signed URLs

6. **Email delivery**
   - Currently no email sent with download links
   - Integrate email service (Resend, SendGrid, etc.)
   - Triggered in `processOrder()` after files generated

### Quick Wins (Optional)
7. Add audio preview player on upload form
8. Add LRC file preview/player on results page
9. Error handling for failed file generation
10. Admin dashboard to view orders

---

## H. Key Code Excerpts

### 1. Backend: File Upload + Checkout Session Creation
**File:** `app/api/checkout/route.ts:16-72`

```typescript
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const tier = formData.get("tier") as "standard" | "pro";
    const lyrics = formData.get("lyrics") as string;
    const audioFile = formData.get("audioFile") as File;

    if (!audioFile || !lyrics) {
      return NextResponse.json(
        { error: "Missing audio file or lyrics" },
        { status: 400 }
      );
    }

    const orderId = crypto.randomUUID();
    const fileName = `${orderId}-${audioFile.name}`;

    // Upload audio to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("audio-uploads")
      .upload(fileName, audioFile, {
        contentType: audioFile.type,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload audio file" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("audio-uploads")
      .getPublicUrl(fileName);

    const audioUrl = urlData.publicUrl;

    // Store order in database
    const { error: insertError } = await supabase
      .from("orders")
      .insert({
        id: orderId,
        email,
        tier,
        audio_file_url: audioUrl,
        lyrics,
        status: "pending",
      });

    if (insertError) {
      console.error("Database error:", insertError);
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 }
      );
    }

    // Create Stripe checkout session
    const prices = { standard: 500, pro: 1200 };
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [/* ... */],
      mode: "payment",
      success_url: `${request.headers.get("origin")}/?success=true&email=${encodeURIComponent(email)}`,
      cancel_url: `${request.headers.get("origin")}/?canceled=true`,
      customer_email: email,
      metadata: { email, tier, orderId },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

### 2. Backend: STUB Alignment Function
**File:** `app/api/stripe/route.ts:76-115`

```typescript
async function processOrder(orderId: string, tier: "standard" | "pro") {
  try {
    // Fetch order data
    const { data: order } = await supabase
      .from("orders")
      .select("audio_file_url, email, lyrics")
      .eq("id", orderId)
      .single();

    if (!order) throw new Error("Order not found");

    // ⚠️ STUB: Fake processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // ⚠️ STUB: Mock URLs instead of real file generation
    const mockLrcUrl = `https://example.com/song-${orderId}.lrc`;
    const mockSrtUrl = `https://example.com/song-${orderId}.srt`;
    const mockVideoUrl = tier === "pro" ? `https://example.com/karaoke-${orderId}.mp4` : null;

    // Update order with mock URLs
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        lrc_url: mockLrcUrl,
        srt_url: mockSrtUrl,
        video_url: mockVideoUrl,
        status: "done",
      })
      .eq("id", orderId);

    if (updateError) throw updateError;

    console.log(`Order ${orderId} processed successfully`);
    console.log(`Audio URL: ${order.audio_file_url}`);
    console.log(`Lyrics preview: ${order.lyrics?.substring(0, 100)}...`);
  } catch (error) {
    console.error("Error processing order:", error);

    await supabase
      .from("orders")
      .update({ status: "failed" })
      .eq("id", orderId);
  }
}
```

**What needs to replace the stub:**
1. Download audio from `order.audio_file_url`
2. Parse `order.lyrics` into lines/words
3. Generate timestamps using audio analysis or external API
4. Create .lrc file: `[00:12.34]Lyric line`
5. Create .srt file: `1\n00:00:12,340 --> 00:00:15,000\nLyric line`
6. If `tier === "pro"`: Generate karaoke video (FFmpeg or API)
7. Upload all files to Supabase Storage
8. Get public URLs and update order

---

### 3. Frontend: Upload Form Submission
**File:** `app/page.tsx:115-144`

```typescript
const handleSubmit = async () => {
  if (!validateForm()) return;

  setIsProcessing(true);

  try {
    const formData = new FormData();
    formData.append("audioFile", audioFile!);
    formData.append("lyrics", lyrics);
    formData.append("email", email);
    formData.append("tier", tier);

    const response = await fetch("/api/checkout", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url; // Redirect to Stripe
    } else {
      setErrors({ submit: "Failed to create checkout session" });
      setIsProcessing(false);
    }
  } catch (error) {
    setErrors({ submit: "An error occurred. Please try again." });
    setIsProcessing(false);
  }
};
```

---

### 4. Frontend: Order Status Polling
**File:** `app/page.tsx:82-113`

```typescript
const pollOrderStatus = async (email: string) => {
  const maxAttempts = 60;
  let attempts = 0;

  const poll = async () => {
    if (attempts >= maxAttempts) {
      setOrderStatus({ status: "failed" });
      return;
    }

    try {
      const response = await fetch(`/api/status?email=${encodeURIComponent(email)}`);
      const data = await response.json();

      if (data.status === "done") {
        setOrderStatus(data);
        setIsProcessing(false);
      } else if (data.status === "failed") {
        setOrderStatus(data);
        setIsProcessing(false);
      } else {
        attempts++;
        setTimeout(poll, 2000); // Poll every 2 seconds
      }
    } catch (error) {
      attempts++;
      setTimeout(poll, 2000);
    }
  };

  poll();
};
```

---

## Summary Checklist

- [x] File tree documented (depth 3)
- [x] Framework identified (Next.js 13.5.1 App Router)
- [x] All API routes documented with request/response schemas
- [x] Upload handling located (`app/api/checkout/route.ts`)
- [x] Alignment logic identified as STUB (`app/api/stripe/route.ts:76-115`)
- [x] Frontend flow documented (upload → payment → polling → results)
- [x] Dev commands listed with ports
- [x] Critical gaps identified (no real file generation)
- [x] Key code excerpts provided with line numbers

---

## Next Steps for Engineer

1. **Implement `processOrder()` function** (`app/api/stripe/route.ts:76-115`)
   - Replace mock URLs with real LRC/SRT/video generation
   - Decide: external API or build in-house?

2. **Create Supabase Storage bucket** for output files

3. **Test end-to-end flow:**
   - Upload → Stripe payment → File generation → Download

4. **Add email notifications** (optional but recommended)

---

**File location:** `/tmp/cc-agent/59332950/project/PROJECT_SUMMARY.md`

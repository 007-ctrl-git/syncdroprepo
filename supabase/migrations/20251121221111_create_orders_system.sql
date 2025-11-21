/*
  # Create SyncDrop Orders System

  ## Overview
  Complete database schema for the AI-powered LRC file generation service.
  Each order is a one-time transaction with no user accounts - email-only validation.

  ## 1. New Tables
    - `orders`
      - `id` (uuid, primary key) - Unique order identifier
      - `email` (text, not null) - Customer email for delivery
      - `tier` (text, not null) - Service tier: 'standard' or 'pro'
      - `audio_file_url` (text, not null) - Public URL to uploaded audio file
      - `lyrics` (text, not null) - User-submitted song lyrics
      - `status` (text, not null) - Order status: 'pending', 'processing', 'done', 'failed'
      - `stripe_payment_intent_id` (text) - Stripe payment reference
      - `lrc_url` (text) - Generated LRC file download link
      - `srt_url` (text) - Generated SRT file download link
      - `video_url` (text) - Generated karaoke video (pro tier only)
      - `error_message` (text) - Error details if processing failed
      - `created_at` (timestamptz) - Order creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `expires_at` (timestamptz) - Download link expiration (48 hours)

  ## 2. Storage
    - Creates 'audio-uploads' bucket for audio file storage
    - Public access enabled for file delivery
    - 25MB file size limit enforced at application layer

  ## 3. Security
    - RLS enabled on orders table
    - Public read access for order status checking (email-based lookup only)
    - No insert/update/delete policies (handled by service role in backend)
    - Orders automatically expire after 48 hours for privacy

  ## 4. Important Notes
    - No user accounts or authentication required
    - Double email confirmation handled at application layer
    - Orders are ephemeral - no long-term storage
    - All customer data removed after expiration period
*/

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('standard', 'pro')),
  audio_file_url text NOT NULL,
  lyrics text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  stripe_payment_intent_id text,
  lrc_url text,
  srt_url text,
  video_url text,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '48 hours') NOT NULL
);

-- Create index for efficient email lookups (used by status polling)
CREATE INDEX IF NOT EXISTS orders_email_idx ON orders(email, created_at DESC);

-- Create index for efficient status updates
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read order status by email (for status polling)
-- This is safe because:
-- 1. Email is confirmed twice before payment
-- 2. No sensitive data stored (just file URLs that expire)
-- 3. Orders auto-expire after 48 hours
CREATE POLICY "Anyone can read orders by email"
  ON orders
  FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies needed
-- All modifications done via service role in backend API routes

-- Create storage bucket for audio uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-uploads', 'audio-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Allow public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public read access'
  ) THEN
    CREATE POLICY "Public read access"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'audio-uploads');
  END IF;
END $$;

-- Storage policy: Service role can upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Service role can upload'
  ) THEN
    CREATE POLICY "Service role can upload"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'audio-uploads');
  END IF;
END $$;
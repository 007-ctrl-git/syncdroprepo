/*
  # Add lyrics column to orders table

  1. Changes
    - Add `lyrics` column to store song lyrics submitted by the user
    - This allows the webhook to access lyrics for API processing

  2. Notes
    - Column is nullable for backward compatibility with existing orders
    - Text type supports lyrics of any reasonable length
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'lyrics'
  ) THEN
    ALTER TABLE orders ADD COLUMN lyrics text;
  END IF;
END $$;

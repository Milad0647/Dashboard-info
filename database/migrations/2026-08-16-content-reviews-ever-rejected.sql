-- Add ever_rejected flag for permanent half-score after one rejection.
ALTER TABLE content_reviews
  ADD COLUMN IF NOT EXISTS ever_rejected BOOLEAN NOT NULL DEFAULT false;

UPDATE content_reviews
SET ever_rejected = true
WHERE rejected_at IS NOT NULL AND ever_rejected = false;

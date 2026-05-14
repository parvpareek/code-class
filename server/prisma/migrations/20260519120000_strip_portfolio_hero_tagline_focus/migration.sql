-- Remove deprecated hero keys from stored portfolio JSON (tagline / currentFocus).
UPDATE "PortfolioProfile"
SET "content" = jsonb_set(
  "content"::jsonb,
  '{hero}',
  ("content"::jsonb->'hero') - 'tagline' - 'currentFocus'
)
WHERE jsonb_typeof("content"::jsonb->'hero') = 'object';

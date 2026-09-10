-- New QuerySource values for the "How did they reach us?" picker on Add/Edit
-- Query — SEO (organic search) and SOCIAL_MEDIA (organic social), as distinct
-- from the existing paid channels (META, WHATSAPP_GOOGLE). Purely additive:
-- no existing rows change, so no data migration needed.
ALTER TYPE "QuerySource" ADD VALUE IF NOT EXISTS 'SEO';
ALTER TYPE "QuerySource" ADD VALUE IF NOT EXISTS 'SOCIAL_MEDIA';

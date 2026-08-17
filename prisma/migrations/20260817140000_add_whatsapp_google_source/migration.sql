-- New QuerySource value for click-to-WhatsApp leads from Google Ads, as
-- distinct from WHATSAPP (now labelled "WhatsApp Meta" in the UI — most
-- existing WhatsApp leads arrive via Meta's WhatsApp Business API). Purely
-- additive: WHATSAPP itself is untouched, so no data migration needed.
ALTER TYPE "QuerySource" ADD VALUE IF NOT EXISTS 'WHATSAPP_GOOGLE';

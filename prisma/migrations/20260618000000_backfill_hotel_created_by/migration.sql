-- Backfill hotels.created_by and hotels.updated_by from the activity_logs table.
-- For hotels created before the created_by column was added, pull the userName
-- from the earliest CREATE log for that hotel.
-- This is a data-only migration — no schema changes.

UPDATE hotels AS h
SET
  created_by = sub.creator,
  updated_by = COALESCE(h.updated_by, sub.creator)
FROM (
  SELECT DISTINCT ON ("entityId")
    "entityId" AS hotel_entity_id,
    "userName"  AS creator
  FROM activity_logs
  WHERE entity   = 'Hotel'
    AND action   = 'CREATE'::"LogAction"
    AND "userName" IS NOT NULL
    AND "userName" <> ''
  ORDER BY "entityId", "actionAt" ASC
) sub
WHERE h.id::TEXT = sub.hotel_entity_id
  AND h.created_by IS NULL;

# Channel Management — Phase 5: Channel Mapping & Connection Model

**Status:** ✅ DATA LAYER COMPLETE (schema + service verified). Channels-tab UI + content
standardization ride with Phase 7 (when they become functional against a real provider).

## Delivered — schema

- **`hotel_channel_connection`** (migration `20260702030000_add_channel_mapping`) — one row per
  `(hotel, channel)`: `provider` (default `channex`), `external_id`, `status`
  (`DRAFT`/`CONNECTED`/`ERROR`/`PAUSED`), `settings` (non-secret JSON), `last_synced_at`,
  `last_error`. **No OTA secrets stored** — the connectivity provider holds them. Unique
  `(hotel_id, channel)`.
- **`hotel_channel_room_mapping`** — maps our `room_id` (+ optional `pricing_id` rate plan) to the
  channel's `channel_room_id` / `channel_rate_id`. Unique `(connection_id, room_id, pricing_id)`;
  cascade-deletes with the connection.

## Delivered — service `app/lib/hotel-inventory/channels.ts`

| Function | Purpose |
|---|---|
| `listChannelConfig(hotelId)` | connections + their mappings |
| `upsertConnection(hotelId, channel, patch)` | create/update by `(hotel, channel)` |
| `setConnectionStatus(id, status, error?)` | record sync outcome |
| `upsertRoomMapping(connectionId, m)` | find-then-write (handles nullable `pricing_id`, which Prisma `upsert` can't target) |
| `removeRoomMapping(id)` | delete a mapping |
| `getPushTargets(hotelId)` | CONNECTED connections + active mappings + room — **what a Phase 6/7 sync job iterates** |

## Verified (fresh client, dev DB) — 8/8

upsert creates then updates the same row (no dup); unique `(hotel_id, channel)` enforced (raw
duplicate insert rejected); room-mapping upsert with null `pricing_id` creates then updates one
row; `getPushTargets` returns the connection + mapping joined to the room ("Luxe Queen Room");
cascade delete removes mappings. Cleaned up.

## Deferred (intentionally)

- **Channels tab UI** (connect / map rooms / view status) — it's non-functional until a real
  provider is wired, so it lands with **Phase 7 (Channex)**. The service is UI-ready.
- **Content standardization** (amenity/bed/geo → channel taxonomy) — needs the provider's code
  lists; also Phase 7.

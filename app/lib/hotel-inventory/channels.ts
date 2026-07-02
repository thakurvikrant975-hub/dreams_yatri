import "server-only";
import { db } from "@/app/lib/db";
import type { ChannelConnectionStatus } from "@/app/generated/prisma/client";

/**
 * Channel-management Phase 5 — connection & mapping layer.
 *
 * The data layer that links our hotels/rooms/rate-plans to external channels
 * (via a connectivity provider such as Channex). No OTA secrets live here — the
 * provider holds them; we keep the provider's `external_id` + sync status.
 *
 * This is plumbing for later phases: Phase 6 enqueues ARI pushes for CONNECTED
 * connections, Phase 7 wires the real provider. `getPushTargets` is what a sync
 * job iterates.
 */

export type ConnectionPatch = {
  provider?: string;
  externalId?: string | null;
  status?: ChannelConnectionStatus;
  settings?: unknown;
  isActive?: boolean;
};

/** List a hotel's channel connections with their room mappings. */
export function listChannelConfig(hotelId: number) {
  return db.hotel_channel_connection.findMany({
    where: { hotel_id: hotelId },
    orderBy: { channel: "asc" },
    include: { room_mappings: true },
  });
}

/** Create or update the connection for (hotel, channel). Unique on (hotel_id, channel). */
export async function upsertConnection(hotelId: number, channel: string, patch: ConnectionPatch = {}) {
  const data = {
    provider: patch.provider,
    external_id: patch.externalId ?? undefined,
    status: patch.status,
    settings: patch.settings === undefined ? undefined : (patch.settings as object),
    is_active: patch.isActive,
  };
  return db.hotel_channel_connection.upsert({
    where: { hotel_id_channel: { hotel_id: hotelId, channel } },
    create: {
      hotel_id: hotelId,
      channel,
      provider: patch.provider ?? "channex",
      external_id: patch.externalId ?? null,
      status: patch.status ?? "DRAFT",
      settings: (patch.settings as object) ?? undefined,
      is_active: patch.isActive ?? true,
    },
    update: data,
  });
}

/** Record sync outcome on a connection. */
export function setConnectionStatus(connectionId: string, status: ChannelConnectionStatus, error?: string | null) {
  return db.hotel_channel_connection.update({
    where: { id: connectionId },
    data: {
      status,
      last_error: error ?? null,
      last_synced_at: status === "CONNECTED" ? new Date() : undefined,
    },
  });
}

export type RoomMappingInput = {
  roomId: number;
  pricingId?: number | null; // null = room-level mapping
  channelRoomId: string;
  channelRateId?: string | null;
  isActive?: boolean;
};

/**
 * Upsert a room/rate mapping. Done via find-then-write (not Prisma `upsert`)
 * because the unique key includes a nullable `pricing_id`, which Prisma's upsert
 * can't target when null.
 */
export async function upsertRoomMapping(connectionId: string, m: RoomMappingInput) {
  const pricingId = m.pricingId ?? null;
  const existing = await db.hotel_channel_room_mapping.findFirst({
    where: { connection_id: connectionId, room_id: m.roomId, pricing_id: pricingId },
    select: { id: true },
  });
  const data = {
    channel_room_id: m.channelRoomId,
    channel_rate_id: m.channelRateId ?? null,
    is_active: m.isActive ?? true,
  };
  if (existing) {
    return db.hotel_channel_room_mapping.update({ where: { id: existing.id }, data });
  }
  return db.hotel_channel_room_mapping.create({
    data: { connection_id: connectionId, room_id: m.roomId, pricing_id: pricingId, ...data },
  });
}

export function removeRoomMapping(id: string) {
  return db.hotel_channel_room_mapping.delete({ where: { id } });
}

/**
 * Active push targets for a hotel: CONNECTED connections with their active
 * mappings joined to room name + num_rooms. A sync job (Phase 6/7) iterates this
 * to push ARI per mapped room.
 */
export function getPushTargets(hotelId: number) {
  return db.hotel_channel_connection.findMany({
    where: { hotel_id: hotelId, status: "CONNECTED", is_active: true },
    include: {
      room_mappings: {
        where: { is_active: true },
        include: { room: { select: { id: true, name: true, num_rooms: true } } },
      },
    },
  });
}

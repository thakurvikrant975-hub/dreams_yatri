"use client";

import { useEffect, useRef } from "react";
import Ably from "ably";

export type LiveConversationMessage = {
  id: number;
  sender: "HOST" | "GUEST" | "SYSTEM" | "AGENT";
  body: string;
  createdAt: string; // ISO — Ably payloads are JSON, dates travel as strings
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  attachmentSize?: number | null;
  isDeleted?: boolean;
};

/**
 * Subscribes to a single conversation's Ably channel for the lifetime of the
 * component. Auth goes through /api/ably/token (authCallback), which re-checks
 * ownership + payment status on every token request — so a booking that gets
 * refunded mid-conversation loses realtime access the next time the token
 * would otherwise renew, not just at initial connect.
 */
export function useConversationChannel(
  bookingId: string | null,
  hotelId: number | null,
  onMessage: (msg: LiveConversationMessage) => void,
) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!bookingId || hotelId == null) return;

    const client = new Ably.Realtime({
      authCallback: (_tokenParams, callback) => {
        fetch("/hotel-connect/api/ably/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, hotelId }),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`Token request failed (${res.status})`);
            return res.json();
          })
          .then((tokenRequest) => callback(null, tokenRequest))
          .catch((err) => callback(err instanceof Error ? err.message : String(err), null));
      },
    });

    if (typeof window !== "undefined" && (window as any).__ABLY_DEBUG__) {
      client.connection.on((stateChange) => {
        console.log("[ably] connection", stateChange.current, stateChange.reason ?? "");
      });
    }

    const channelName = `conversation:${bookingId}:${hotelId}`;
    const channel = client.channels.get(channelName);
    if (typeof window !== "undefined" && (window as any).__ABLY_DEBUG__) {
      channel.on((stateChange) => {
        console.log("[ably] channel", channelName, stateChange.current, stateChange.reason ?? "");
      });
    }
    const handler = (msg: Ably.Message) => {
      if (typeof window !== "undefined" && (window as any).__ABLY_DEBUG__) {
        console.log("[ably] message received", JSON.stringify(msg.data));
      }
      onMessageRef.current(msg.data as LiveConversationMessage);
    };
    channel.subscribe("message", handler);

    return () => {
      channel.unsubscribe("message", handler);
      client.close();
    };
  }, [bookingId, hotelId]);
}

export type VerificationCounts = { hotelsPending: number; cabsPending: number; bookingsUnconfirmed: number };

/**
 * Subscribes to the shared dashboard "pending verification" counts channel
 * for the component's lifetime — Verify Hotels / Verify Cabs push a fresh
 * count over Ably after any booking/hotel/cab confirmation changes it, so
 * every open dashboard tab updates live with zero polling requests. Auth
 * goes through /dashboard/api/ably/token, gated on an active team member.
 */
export function useVerificationCounts(onUpdate: (counts: VerificationCounts) => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const client = new Ably.Realtime({
      authCallback: (_tokenParams, callback) => {
        fetch("/dashboard/api/ably/token", { method: "POST" })
          .then((res) => {
            if (!res.ok) throw new Error(`Token request failed (${res.status})`);
            return res.json();
          })
          .then((tokenRequest) => callback(null, tokenRequest))
          .catch((err) => callback(err instanceof Error ? err.message : String(err), null));
      },
    });

    const channel = client.channels.get("dashboard:verification-counts");
    const handler = (msg: Ably.Message) => onUpdateRef.current(msg.data as VerificationCounts);
    channel.subscribe("counts", handler);

    return () => {
      channel.unsubscribe("counts", handler);
      client.close();
    };
  }, []);
}

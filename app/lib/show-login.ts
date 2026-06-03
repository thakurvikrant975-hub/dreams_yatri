"use client"

import { useModal } from "@/app/hooks/useModals";
import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

export default function ShowLogin() {
  const { data: session, status } = useSession();
  const openModal = useModal((s) => s.openModal);

  // Tracks whether we've already decided to open the onboarding modal for
  // this authenticated session. Prevents it from re-triggering whenever the
  // session object is refreshed (e.g. during update() / router.refresh()).
  const onboardingOpenedRef = useRef(false);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      onboardingOpenedRef.current = false; // reset on sign-out
      openModal("login-modal");
      return;
    }

    if (status === "authenticated") {
      const hasName = !!session.user.name?.trim();

      if (!hasName && !onboardingOpenedRef.current) {
        onboardingOpenedRef.current = true;
        openModal("onboarding-modal");
      }
    }
  }, [openModal, status, session]);

  return null;
}

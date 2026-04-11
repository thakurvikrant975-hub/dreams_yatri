"use client"

import { useModal } from "@/app/hooks/useModals";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

export default function ShowLogin() {
    const { data: session, status } = useSession();
    const openModal = useModal((s) => s.openModal);



    useEffect(() => {
        if (status === "unauthenticated") {
            openModal('login-modal');
        }

        if (status === "authenticated" && session) {
            openModal('onboarding-modal');
        }

    }, [openModal, status, session]);



    return null;
}
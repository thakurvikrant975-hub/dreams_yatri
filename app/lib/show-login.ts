"use client"

import { useModal } from "@/app/hooks/useModals";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

export default function ShowLogin() {
    const { status } = useSession();
    const openModal = useModal((s) => s.openModal);

    useEffect(() => {
        if (status === "unauthenticated") {
            openModal('login-modal');
        }
    }, [openModal, status]);



    return null;
}
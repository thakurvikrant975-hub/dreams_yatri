"use client"

import { useModal } from "@/app/hooks/useModals";
import { useEffect } from "react";

export default function ShowLogin() {
    const openModal = useModal((s) => s.openModal);

    useEffect(() => {
        openModal('login-modal');
    }, [openModal]);

    return null;
}
'use client';

import { create } from 'zustand';

type ModalData = Record<string, unknown> | null;

export type ModalType =
    | 'login-modal'
    | null;

interface ModalState {
    isOpen: boolean;
    type: ModalType;
    data: ModalData;
    openModal: (type: ModalType, data?: ModalData) => void;
    closeModal: () => void;
}

export const useModal = create<ModalState>((set) => ({
    isOpen: false,
    type: null,
    data: null,

    openModal: (type, data = null) =>
        set({
            isOpen: true,
            type,
            data,
        }),

    closeModal: () =>
        set({
            isOpen: false,
            type: null,
            data: null,
        }),
}));
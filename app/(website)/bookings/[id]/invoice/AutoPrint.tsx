'use client';

import { useEffect } from 'react';

/** Auto-opens the print dialog so the invoice can be saved as a PDF. */
export default function AutoPrint() {
    useEffect(() => {
        const t = setTimeout(() => window.print(), 350);
        return () => clearTimeout(t);
    }, []);

    return null;
}

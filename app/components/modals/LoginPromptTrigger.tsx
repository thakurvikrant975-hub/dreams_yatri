'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useModal } from '@/app/hooks/useModals';

const SESSION_KEY = 'login_prompt_shown';

export default function LoginPromptTrigger() {
  const { status } = useSession();
  const { openModal, isOpen } = useModal();

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'authenticated') return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const timer = setTimeout(() => {
      if (isOpen) return;
      sessionStorage.setItem(SESSION_KEY, '1');
      openModal('login-modal');
    }, 20000);

    return () => clearTimeout(timer);
  }, [status]);

  return null;
}

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PenLine } from 'lucide-react';
import Button from '@/app/components/ui/Button';
import { useModal } from '@/app/hooks/useModals';

export default function WriteButton() {
  const { status } = useSession();
  const router    = useRouter();
  const openModal = useModal((s) => s.openModal);

  function handleClick() {
    if (status === 'authenticated') {
      router.push('/blogs/write');
    } else {
      openModal('login-modal');
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <PenLine className="size-3" />
      Write a Blog
    </Button>
  );
}

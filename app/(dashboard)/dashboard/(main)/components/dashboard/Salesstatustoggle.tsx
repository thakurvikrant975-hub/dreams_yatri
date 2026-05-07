"use client";

import { useTransition, useState, useEffect } from "react";
import { toggleMemberStatus } from "../../actions/member-actions";

interface SalesStatusToggleProps {
  memberId: string;
  initialActive: boolean;
}

export function SalesStatusToggle({
  memberId,
  initialActive,
}: SalesStatusToggleProps) {
  const [isActive, setIsActive] = useState(initialActive);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleToggle = () => {
    if (isPending) return;
    const next = !isActive;
    setIsActive(next);

    startTransition(async () => {
      const result = await toggleMemberStatus(memberId, next);
      if (!result.success) setIsActive(!next);
    });
  };

  if (!mounted) return null;

  return (
<button
  onClick={handleToggle}
  disabled={isPending}
  aria-pressed={isActive}
  className={`
    relative flex items-center
    w-24 h-9 rounded-full px-1
    transition-all duration-300
    ${isActive ? "bg-green-400" : "bg-gray-400"}
    ${isPending ? "opacity-70 cursor-wait" : "cursor-pointer"}
  `}
>
  {/* Label */}
  <span
    className={`
      w-full text-white font-bold text-xs
      transition-all duration-300 select-none
      ${isActive ? "text-left pl-2" : "text-right pr-2"}
    `}
  >
    {isPending ? "..." : isActive ? "Active" : "Inactive"}
  </span>

  {/* Thumb */}
  <span
    className={`
      absolute top-1
      w-7 h-7 bg-white rounded-full
      transition-all duration-300
      ${isActive ? "translate-x-15" : "translate-x-0"}
    `}
  />
</button>
  );
}
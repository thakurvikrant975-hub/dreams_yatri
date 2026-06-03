'use client';

import { useState } from 'react';
import { Link2, Check } from 'lucide-react';
import { toast } from 'sonner';

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.527 5.847L.057 23.077a.75.75 0 00.866.866l5.23-1.47A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.68-.513-5.21-1.408l-.374-.222-3.882 1.09 1.09-3.882-.222-.374A9.953 9.953 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
  </svg>
);

export default function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(`${title} — ${window.location.href}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={shareWhatsApp}
        title="Share on WhatsApp"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-600 border border-green-200 text-xs font-medium hover:bg-green-100 transition-colors cursor-pointer"
      >
        <WhatsAppIcon />
        WhatsApp
      </button>
      <button
        type="button"
        onClick={copyLink}
        title="Copy link"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 text-xs font-medium hover:bg-neutral-200 transition-colors cursor-pointer"
      >
        {copied ? <Check className="size-3.5 text-green-600" /> : <Link2 className="size-3.5" />}
        {copied ? 'Copied!' : 'Copy link'}
      </button>
    </div>
  );
}

'use client'

import { useState } from 'react'
import { LinkIcon, CheckIcon } from 'lucide-react'
import Modal, { ModalBody } from './Modal_Structure'
import { useModal } from '@/app/hooks/useModals'
import { cn } from '@/app/lib/utils'

// ── Social platform definitions ───────────────────────────────────────────────

const SOCIALS = [
    {
        name: 'Facebook',
        bg: '#1877F2',
        getUrl: (url: string) =>
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        icon: (
            <svg viewBox="0 0 24 24" fill="white" className="size-6">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
            </svg>
        ),
    },
    {
        name: 'X',
        bg: '#000000',
        getUrl: (url: string, title: string) =>
            `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
        icon: (
            <svg viewBox="0 0 24 24" fill="white" className="size-5">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.738l7.737-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
        ),
    },
    {
        name: 'Whatsapp',
        bg: '#25D366',
        getUrl: (url: string, title: string) =>
            `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
        icon: (
            <svg viewBox="0 0 24 24" fill="white" className="size-6">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.558 4.121 1.532 5.855L.057 23.25l5.532-1.451A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.733 9.733 0 01-4.965-1.361l-.357-.212-3.683.966.982-3.588-.232-.37A9.749 9.749 0 012.25 12C2.25 6.589 6.589 2.25 12 2.25S21.75 6.589 21.75 12 17.411 21.75 12 21.75z" />
            </svg>
        ),
    },
    {
        name: 'Telegram',
        bg: '#26A5E4',
        getUrl: (url: string, title: string) =>
            `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
        icon: (
            <svg viewBox="0 0 24 24" fill="white" className="size-6">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
        ),
    },
    {
        name: 'Linkedin',
        bg: '#0A66C2',
        getUrl: (url: string) =>
            `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
        icon: (
            <svg viewBox="0 0 24 24" fill="white" className="size-5">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
        ),
    },
] as const

// ── Component ─────────────────────────────────────────────────────────────────

function ShareModal() {
    const { isOpen, type, data, closeModal } = useModal()
    const [copied, setCopied] = useState(false)

    const url = (data as { url?: string } | null)?.url ?? (typeof window !== 'undefined' ? window.location.href : '')
    const title = (data as { title?: string } | null)?.title ?? 'Check out this amazing travel package!'

    if (!isOpen || type !== 'share-modal') return null

    function handleCopy() {
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    function openShare(shareUrl: string) {
        window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=500')
    }

    return (
        <Modal open={isOpen} onClose={closeModal} maxWidth="md">
            <ModalBody className="px-8 pt-10 pb-8 overflow-visible!">
                {/* Chain icon */}
                <div className="flex flex-col items-center text-center mb-7">
                    <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4 shadow-sm">
                        <LinkIcon className="size-7 text-neutral-500" strokeWidth={1.8} />
                    </div>
                    <h2 className="text-2xl font-bold text-neutral-900 mb-1.5">Share with Friends</h2>
                    <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
                        Travel is more fun when you plan it together!
                    </p>
                </div>

                {/* Close button */}
                <button
                    type="button"
                    onClick={closeModal}
                    className="cursor-pointer absolute top-4 right-4 w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:border-neutral-300 transition-colors"
                    aria-label="Close"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* URL copy input */}
                <div className="mb-7">
                    <p className="text-sm font-semibold text-neutral-800 mb-2">Share your link</p>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200">
                        <span className="flex-1 text-sm text-neutral-600 truncate select-all">{url}</span>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className={cn(
                                'cursor-pointer shrink-0 p-1.5 rounded-lg transition-all',
                                copied
                                    ? 'text-green-600 bg-green-50'
                                    : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200'
                            )}
                            aria-label="Copy link"
                        >
                            {copied
                                ? <CheckIcon className="size-4" strokeWidth={2.5} />
                                : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                                        <rect x="9" y="9" width="13" height="13" rx="2" />
                                        <path strokeLinecap="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                    </svg>
                                )
                            }
                        </button>
                    </div>
                </div>

                {/* Social icons — fixed 5-column grid, no wrapping */}
                <div>
                    <p className="text-sm font-semibold text-neutral-800 mb-4">Share to</p>
                    <div className="grid grid-cols-5 gap-3">
                        {SOCIALS.map((social) => (
                            <button
                                key={social.name}
                                type="button"
                                onClick={() => openShare(social.getUrl(url, title))}
                                className="cursor-pointer flex flex-col items-center gap-1.5 group"
                            >
                                <div
                                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200"
                                    style={{ backgroundColor: social.bg }}
                                >
                                    {social.icon}
                                </div>
                                <span className="text-xs text-neutral-500 group-hover:text-neutral-700 transition-colors">
                                    {social.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </ModalBody>
        </Modal>
    )
}

export default ShareModal

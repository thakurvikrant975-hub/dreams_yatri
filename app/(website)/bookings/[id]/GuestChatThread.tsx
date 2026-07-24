'use client';
/* eslint-disable @next/next/no-img-element -- chat attachment thumbnails are small, arbitrary-sized uploads, not layout-critical assets */

import { useEffect, useRef, useState, useTransition } from 'react';
import { PaperPlaneTiltIcon, ChatCircleDotsIcon, PaperclipIcon, FileIcon, XIcon, DotsThreeVerticalIcon, TrashIcon } from '@phosphor-icons/react';
import { useConversationChannel } from '@/app/lib/ably-client';
import {
    getGuestConversation,
    sendGuestMessage,
    sendGuestAttachment,
    deleteGuestMessage,
    markGuestConversationRead,
    type GuestConversationMessage,
} from './conversation-actions';

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentCard({ msg }: { msg: GuestConversationMessage }) {
    if (!msg.attachmentUrl) return null;
    const isImage = msg.attachmentType?.startsWith('image/');
    if (isImage) {
        return (
            <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block mb-1.5 -mx-1 -mt-1">
                <img src={msg.attachmentUrl} alt={msg.attachmentName ?? 'Attachment'} className="max-h-48 w-auto rounded-lg object-cover" />
            </a>
        );
    }
    return (
        <a
            href={msg.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-1.5 flex items-center gap-2 rounded-lg bg-black/5 px-2.5 py-2 hover:bg-black/10 transition-colors"
        >
            <FileIcon size={18} weight="fill" className="shrink-0 opacity-70" />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{msg.attachmentName ?? 'File'}</span>
                {msg.attachmentSize != null && <span className="block text-[10px] opacity-70">{formatBytes(msg.attachmentSize)}</span>}
            </span>
        </a>
    );
}

function MessageBubble({ msg, isMine, onDelete }: { msg: GuestConversationMessage; isMine: boolean; onDelete: (id: number) => void }) {
    const [menuOpen, setMenuOpen] = useState(false);

    if (msg.sender === 'SYSTEM') {
        return (
            <div className="flex justify-center my-3">
                <span className="text-[10px] text-neutral-400 bg-neutral-100 px-3 py-1 rounded-full font-medium">{msg.body}</span>
            </div>
        );
    }
    const isGuest = msg.sender === 'GUEST';

    if (msg.isDeleted) {
        return (
            <div className={`flex gap-2 mb-2 ${isGuest ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="max-w-[75%] px-4 py-2.5 rounded-2xl text-xs italic text-neutral-400 bg-neutral-50 border border-(--border-muted)">
                    This message was deleted
                </div>
            </div>
        );
    }

    return (
        <div className={`group flex gap-1.5 mb-2 items-center ${isGuest ? 'flex-row-reverse' : 'flex-row'}`}>
            <div
                className={`relative max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    isGuest ? 'bg-primary-500 text-white rounded-tr-sm' : 'bg-neutral-100 text-neutral-800 rounded-tl-sm'
                }`}
            >
                <AttachmentCard msg={msg} />
                {msg.body}
                <div className={`mt-1 text-[10px] ${isGuest ? 'text-primary-200' : 'text-neutral-400'} ${isGuest ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                </div>
            </div>
            {isMine && (
                <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => setMenuOpen((o) => !o)}
                        aria-label="Message options"
                        className="flex size-6 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
                    >
                        <DotsThreeVerticalIcon size={14} weight="bold" />
                    </button>
                    {menuOpen && (
                        <div className="absolute z-10 top-full mt-1 right-0 rounded-lg border border-(--border-muted) bg-white shadow-md py-1 min-w-[110px]">
                            <button
                                onClick={() => { setMenuOpen(false); onDelete(msg.id); }}
                                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-error-600 hover:bg-error-50"
                            >
                                <TrashIcon size={13} weight="bold" /> Delete
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function GuestChatThread({ bookingId }: { bookingId: string }) {
    const [hotelId, setHotelId] = useState<number | null>(null);
    const [hotelName, setHotelName] = useState<string>('your host');
    const [messages, setMessages] = useState<GuestConversationMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [isSending, startSending] = useTransition();
    const [uploading, setUploading] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getGuestConversation(bookingId)
            .then((res) => {
                if (res.error) {
                    setError(res.error);
                    setLoading(false);
                    return;
                }
                setHotelId(res.hotelId ?? null);
                setHotelName(res.hotelName ?? 'your host');
                setMessages(res.messages ?? []);
                setLoading(false);
            })
            .catch((err) => {
                console.error('[GuestChatThread] failed to load conversation', err);
                setError('Could not load chat. Please refresh the page.');
                setLoading(false);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bookingId]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    // Upsert by id — a live-delivered update (e.g. a delete) replaces the
    // matching bubble in place instead of only ever appending new ones.
    function upsertMessage(prev: GuestConversationMessage[], incoming: GuestConversationMessage): GuestConversationMessage[] {
        const idx = prev.findIndex((m) => m.id === incoming.id);
        if (idx === -1) return [...prev, incoming];
        const next = prev.slice();
        next[idx] = incoming;
        return next;
    }

    useConversationChannel(bookingId, hotelId, (msg) => {
        setMessages((prev) => upsertMessage(prev, { ...msg, createdAt: new Date(msg.createdAt) }));
        if (msg.sender === 'HOST') markGuestConversationRead(bookingId).catch(() => {});
    });

    function handleSend() {
        const body = draft.trim();
        if (!body) return;
        startSending(async () => {
            const res = await sendGuestMessage(bookingId, body);
            if (res.error) {
                setError(res.error);
                return;
            }
            if (res.message) {
                setMessages((prev) => upsertMessage(prev, res.message!));
            }
            setDraft('');
            setError(null);
        });
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await sendGuestAttachment(bookingId, fd);
            if (res.error) {
                setError(res.error);
            } else if (res.message) {
                setMessages((prev) => upsertMessage(prev, res.message!));
            }
        } catch (err) {
            console.error('[GuestChatThread] attachment upload failed', err);
            setError('Could not send the file. Please try again.');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }

    function handleDelete(messageId: number) {
        if (!window.confirm('Delete this message for everyone?')) return;
        const prevMessages = messages;
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true, body: '', attachmentUrl: null } : m)));
        deleteGuestMessage(bookingId, messageId).then((res) => {
            if (res.error) {
                setError(res.error);
                setMessages(prevMessages);
            }
        });
    }

    if (loading) {
        return <p className="text-sm text-neutral-400 text-center py-6">Loading chat…</p>;
    }
    if (error && hotelId == null) {
        return null; // Not paid yet, or no stay to chat about — don't show a broken panel.
    }

    return (
        <div className="flex flex-col rounded-xl border border-(--border-muted) overflow-hidden">
            <div className="border-b border-(--border-muted) bg-neutral-50 px-4 py-2.5 flex items-center gap-2">
                <ChatCircleDotsIcon size={14} weight="fill" className="text-primary-500" />
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Message {hotelName}</p>
            </div>

            <div className="flex-1 max-h-80 overflow-y-auto px-4 py-3 bg-white">
                {messages.length === 0 ? (
                    <p className="text-xs text-neutral-400 text-center py-4">No messages yet — ask about check-in, parking, anything.</p>
                ) : (
                    messages.map((m) => <MessageBubble key={m.id} msg={m} isMine={m.sender === 'GUEST'} onDelete={handleDelete} />)
                )}
                <div ref={endRef} />
            </div>

            {error && <p className="px-4 pt-2 text-xs text-error-600">{error}</p>}

            <div className="border-t border-(--border-muted) bg-white p-3 flex items-end gap-2">
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    aria-label="Attach file"
                    className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
                >
                    {uploading ? <XIcon size={15} className="animate-spin" /> : <PaperclipIcon size={17} weight="bold" />}
                </button>
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Type a message…"
                    rows={1}
                    maxLength={4000}
                    className="flex-1 resize-none px-3 py-2 text-sm rounded-lg border border-(--border-muted) bg-neutral-50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-200 max-h-24 overflow-y-auto"
                />
                <button
                    onClick={handleSend}
                    disabled={!draft.trim() || isSending}
                    className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                        draft.trim() && !isSending ? 'bg-primary-500 text-white hover:bg-primary-600' : 'bg-neutral-100 text-neutral-300 cursor-not-allowed'
                    }`}
                    aria-label="Send message"
                >
                    <PaperPlaneTiltIcon size={15} weight="fill" />
                </button>
            </div>
        </div>
    );
}

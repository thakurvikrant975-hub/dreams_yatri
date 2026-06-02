'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage, LANGUAGES } from '@/app/hooks/useLanguage';

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home',         href: '/' },
  { label: 'Destinations', href: '/destinations' },
  { label: 'Packages',     href: '/packages' },
  { label: 'About',        href: '/about' },
  { label: 'Contact',      href: '/contact' },
];

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { currentLanguage, setLanguage } = useLanguage();

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <style>{`
        @keyframes blob-morph {
          0%,100% { border-radius: 63% 37% 54% 46% / 55% 48% 52% 45%; }
          14%      { border-radius: 40% 60% 54% 46% / 49% 60% 40% 51%; }
          28%      { border-radius: 54% 46% 38% 62% / 49% 70% 30% 51%; }
          42%      { border-radius: 61% 39% 55% 45% / 61% 38% 62% 39%; }
          56%      { border-radius: 61% 39% 67% 33% / 70% 50% 50% 30%; }
          70%      { border-radius: 50% 50% 34% 66% / 56% 68% 32% 44%; }
          84%      { border-radius: 46% 54% 50% 50% / 35% 61% 39% 65%; }
        }

        /* Blob — absolutely positioned inside the header's relative container */
        .dy-blob {
          position: absolute;
          /* vertically center in header, pin to right edge */
          top: 50%;
          right: 16px;
          transform: translateY(-50%);
          width: 52px;
          height: 52px;
          background-color: #ffffff;
          overflow: hidden;
          z-index: 90;
          box-shadow: 0 8px 30px rgba(0,0,0,0.15);
          animation: blob-morph 7s linear infinite;
          /* CLOSE transitions: size shrinks first (400ms), then position (1100ms) */
          transition:
            top      350ms 1100ms cubic-bezier(0.23, 1, 0.32, 1),
            right    350ms 1100ms cubic-bezier(0.23, 1, 0.32, 1),
            width    650ms  400ms cubic-bezier(0.23, 1, 0.32, 1),
            height   650ms  400ms cubic-bezier(0.23, 1, 0.32, 1),
            transform 250ms 1100ms ease;
        }

        /* OPEN: blob expands to cover full viewport from its anchor point */
        .dy-blob.open {
          animation-play-state: paused;
          top: 50%;
          right: 50%;
          transform: translate(50%, -50%);
          width: 200vw;
          height: 200vh;
          box-shadow: none;
          /* OPEN transitions: position first (700ms), then size expands (1000ms) */
          transition:
            top      350ms  700ms cubic-bezier(0.23, 1, 0.32, 1),
            right    350ms  700ms cubic-bezier(0.23, 1, 0.32, 1),
            width    750ms 1000ms cubic-bezier(0.23, 1, 0.32, 1),
            height   750ms 1000ms cubic-bezier(0.23, 1, 0.32, 1),
            transform 250ms 700ms ease;
        }

        /* Nav links */
        .dy-nav-list {
          position: absolute;
          top: 50%;
          left: 0;
          width: 100%;
          padding: 0;
          margin: 0;
          list-style: none;
          text-align: center;
          transform: translateY(-50%);
        }
        .dy-nav-item {
          display: block;
          width: 100%;
          margin: 6px 0;
          opacity: 0;
          visibility: hidden;
          transform: translateY(30px);
          pointer-events: none;
          transition: opacity 250ms linear, transform 250ms linear, visibility 0ms 250ms;
        }
        /* stagger OUT — reverse */
        .dy-nav-item:nth-child(5) { transition-delay: 0ms; }
        .dy-nav-item:nth-child(4) { transition-delay: 50ms; }
        .dy-nav-item:nth-child(3) { transition-delay: 100ms; }
        .dy-nav-item:nth-child(2) { transition-delay: 150ms; }
        .dy-nav-item:nth-child(1) { transition-delay: 200ms; }

        .dy-blob.open .dy-nav-item {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
          pointer-events: auto;
          transition: opacity 350ms ease, transform 250ms ease;
        }
        /* stagger IN */
        .dy-blob.open .dy-nav-item:nth-child(1) { transition-delay: 1400ms; }
        .dy-blob.open .dy-nav-item:nth-child(2) { transition-delay: 1480ms; }
        .dy-blob.open .dy-nav-item:nth-child(3) { transition-delay: 1560ms; }
        .dy-blob.open .dy-nav-item:nth-child(4) { transition-delay: 1640ms; }
        .dy-blob.open .dy-nav-item:nth-child(5) { transition-delay: 1720ms; }

        .dy-nav-link {
          display: inline-block;
          position: relative;
          font-family: 'Montserrat', sans-serif;
          font-size: clamp(2rem, 8vh, 5rem);
          font-weight: 800;
          text-transform: uppercase;
          line-height: 1.2;
          color: #1a1a1a;
          text-decoration: none;
          transition: color 250ms linear;
        }
        .dy-nav-link:hover { color: #FB2B37; }
        .dy-nav-link::after {
          content: '';
          display: block;
          position: absolute;
          top: 50%;
          left: 0;
          height: 3px;
          margin-top: -1.5px;
          width: 0;
          background-color: #FB2B37;
          opacity: 0.2;
          transition: width 250ms linear;
        }
        .dy-nav-link:hover::after { width: 100%; }

        /* Language selector row */
        .dy-lang-row {
          position: absolute;
          bottom: 14vh;
          left: 0;
          width: 100%;
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          padding: 0 24px;
          opacity: 0;
          visibility: hidden;
          transform: translateY(20px);
          pointer-events: none;
          transition: opacity 250ms linear, transform 250ms linear, visibility 0ms 250ms;
          transition-delay: 100ms;
        }
        .dy-blob.open .dy-lang-row {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
          pointer-events: auto;
          transition: opacity 350ms ease, transform 250ms ease;
          transition-delay: 1820ms;
        }
        .dy-lang-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 8px 12px;
          border-radius: 12px;
          border: 1.5px solid transparent;
          background: transparent;
          cursor: pointer;
          transition: background 200ms, border-color 200ms;
        }
        .dy-lang-btn.active {
          background: rgba(251, 43, 55, 0.08);
          border-color: rgba(251, 43, 55, 0.3);
        }
        .dy-lang-badge {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: white;
          margin-bottom: 2px;
        }
        .dy-lang-name {
          font-size: 10px;
          font-weight: 600;
          color: #404040;
          white-space: nowrap;
        }
        .dy-lang-btn.active .dy-lang-name { color: #FB2B37; }

        /* Hamburger — absolutely positioned, same anchor as blob, higher z */
        .dy-hamburger {
          position: absolute;
          top: 50%;
          right: 16px;
          transform: translateY(-50%);
          width: 52px;
          height: 52px;
          z-index: 100;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
          background: transparent;
          border: none;
          padding: 0;
        }
        .dy-bar {
          display: block;
          width: 22px;
          height: 2px;
          background-color: #404040;
          transform-origin: center;
          transition: transform 200ms ease, opacity 200ms ease, width 200ms ease;
          border-radius: 2px;
        }
        .dy-hamburger.open .dy-bar-top    { transform: translateY(7px) rotate(45deg); }
        .dy-hamburger.open .dy-bar-mid    { opacity: 0; transform: scaleX(0); }
        .dy-hamburger.open .dy-bar-bottom { transform: translateY(-7px) rotate(-45deg); }
      `}</style>

      {/* Blob — lives inside the header's relative container */}
      <div
        className={`dy-blob${open ? ' open' : ''}`}
        aria-hidden={!open}
      >
        <ul className="dy-nav-list">
          {NAV_ITEMS.map((item) => (
            <li key={item.href} className="dy-nav-item">
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="dy-nav-link"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Language selector */}
        <div className="dy-lang-row">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { setLanguage(lang.code); setOpen(false); }}
              className={`dy-lang-btn${currentLanguage === lang.code ? ' active' : ''}`}
            >
              <span
                className="dy-lang-badge"
                style={{ backgroundColor: lang.color }}
              >
                {lang.shortCode}
              </span>
              <span className="dy-lang-name">{lang.labelEn}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Hamburger — same anchor, higher z */}
      <button
        className={`dy-hamburger${open ? ' open' : ''}`}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span className="dy-bar dy-bar-top" />
        <span className="dy-bar dy-bar-mid" />
        <span className="dy-bar dy-bar-bottom" />
      </button>
    </>
  );
}
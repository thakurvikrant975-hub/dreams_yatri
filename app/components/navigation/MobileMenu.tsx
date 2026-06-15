'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const NAV_ITEMS = [
  { label: 'Home',         href: '/' },
  { label: 'Packages',     href: '/packages' },
  { label: 'Destinations', href: '/destination' },
  { label: 'Regions',      href: '/region' },
  { label: 'Blogs',        href: '/blogs' },
  { label: 'About',        href: '/about' },
  { label: 'Contact',      href: '/contact' },
];

const QUICK_LINKS = [
  { label: 'FAQs',         href: '/faqs' },
  { label: 'Our Story',    href: '/our-story' },
  { label: 'Testimonials', href: '/testimonials' },
  { label: 'Careers',      href: '/careers' },
];

interface MobileMenuProps {
  isSolid?: boolean;
}

export default function MobileMenu({ isSolid = true }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <>
      <style>{`
        /* Hamburger button */
        .dy-hamburger {
          position: absolute;
          top: 50%;
          right: 16px;
          transform: translateY(-50%);
          width: 44px;
          height: 44px;
          z-index: 200;
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
          background-color: currentColor;
          transform-origin: center;
          transition: transform 200ms ease, opacity 150ms ease;
          border-radius: 2px;
          will-change: transform;
        }
        .dy-hamburger.open .dy-bar-top    { transform: translateY(7px) rotate(45deg); }
        .dy-hamburger.open .dy-bar-mid    { opacity: 0; transform: scaleX(0); }
        .dy-hamburger.open .dy-bar-bottom { transform: translateY(-7px) rotate(-45deg); }

        /* Backdrop */
        .dy-backdrop {
          position: fixed;
          inset: 0;
          z-index: 150;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(2px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 250ms ease;
          will-change: opacity;
        }
        .dy-backdrop.open {
          opacity: 1;
          pointer-events: auto;
        }

        /* Slide-in panel */
        .dy-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          z-index: 160;
          width: min(85vw, 360px);
          background: #ffffff;
          transform: translateX(100%);
          transition: transform 280ms cubic-bezier(0.32, 0, 0.12, 1);
          will-change: transform;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          overscroll-behavior: contain;
          box-shadow: -8px 0 40px rgba(0,0,0,0.18);
        }
        .dy-panel.open {
          transform: translateX(0);
        }

        /* Close button inside panel */
        .dy-close-btn {
          position: absolute;
          top: 14px;
          right: 16px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: #f5f5f5;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #404040;
          transition: background 150ms;
        }
        .dy-close-btn:hover { background: #ebebeb; }

        /* Nav links */
        .dy-panel-nav {
          padding: 72px 28px 24px;
          flex: 1;
        }
        .dy-panel-nav-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 0;
          border-bottom: 1px solid #f0f0f0;
          font-family: 'Montserrat', sans-serif;
          font-size: 1.125rem;
          font-weight: 700;
          color: #1a1a1a;
          text-decoration: none;
          transition: color 150ms;
        }
        .dy-panel-nav-link:last-child { border-bottom: none; }
        .dy-panel-nav-link:hover { color: #FB2B37; }
        .dy-panel-nav-link svg { opacity: 0.3; transition: opacity 150ms, transform 150ms; }
        .dy-panel-nav-link:hover svg { opacity: 1; transform: translateX(3px); }

        /* Quick links */
        .dy-panel-footer {
          border-top: 1px solid #f0f0f0;
          padding: 20px 28px 32px;
        }
        .dy-quick-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #a0a0a0;
          margin-bottom: 12px;
        }
        .dy-quick-links {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .dy-quick-link {
          display: inline-flex;
          padding: 6px 14px;
          border-radius: 100px;
          border: 1.5px solid #e8e8e8;
          font-size: 13px;
          font-weight: 600;
          color: #404040;
          text-decoration: none;
          transition: border-color 150ms, color 150ms, background 150ms;
        }
        .dy-quick-link:hover {
          border-color: rgba(251,43,55,0.35);
          color: #FB2B37;
          background: rgba(251,43,55,0.04);
        }

        /* CTA at top of panel */
        .dy-panel-cta {
          display: block;
          margin: 0 28px 24px;
          padding: 13px 20px;
          border-radius: 14px;
          background: linear-gradient(135deg, #FB2B37 0%, #ff6b35 100%);
          color: #fff;
          font-family: 'Montserrat', sans-serif;
          font-size: 0.9rem;
          font-weight: 700;
          text-decoration: none;
          text-align: center;
          letter-spacing: 0.02em;
          transition: opacity 150ms;
          box-shadow: 0 4px 14px rgba(251,43,55,0.3);
        }
        .dy-panel-cta:hover { opacity: 0.92; }
      `}</style>

      {/* Backdrop */}
      <div
        className={`dy-backdrop${open ? ' open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        className={`dy-panel${open ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <button
          type="button"
          className="dy-close-btn"
          onClick={close}
          aria-label="Close menu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Main nav */}
        <nav className="dy-panel-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className="dy-panel-nav-link"
            >
              {item.label}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <Link href="/packages" onClick={close} className="dy-panel-cta">
          Explore All Packages →
        </Link>

        {/* Quick links */}
        <div className="dy-panel-footer">
          <p className="dy-quick-label">More</p>
          <div className="dy-quick-links">
            {QUICK_LINKS.map((item) => (
              <Link key={item.href} href={item.href} onClick={close} className="dy-quick-link">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Hamburger — always visible, above everything */}
      <button
        type="button"
        className={`dy-hamburger${open ? ' open' : ''}`}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        style={{ color: open ? '#1a1a1a' : isSolid ? '#404040' : '#ffffff' }}
      >
        <span className="dy-bar dy-bar-top" />
        <span className="dy-bar dy-bar-mid" />
        <span className="dy-bar dy-bar-bottom" />
      </button>
    </>
  );
}

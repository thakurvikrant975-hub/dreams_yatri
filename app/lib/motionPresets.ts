// ============================================================
// motionPresets.ts
// Framer Motion animation presets for Next.js
// Usage: import { fadeUp, zoomPop, ... } from '@/lib/motionPresets'
// ============================================================

import type { Variants, Transition } from 'framer-motion'

// ── BASE TRANSITIONS ─────────────────────────────────────────

export const transitions = {
  smooth: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } satisfies Transition,
  spring: { type: 'spring', stiffness: 300, damping: 24 } satisfies Transition,
  springBouncy: { type: 'spring', stiffness: 400, damping: 18 } satisfies Transition,
  springSnappy: { type: 'spring', stiffness: 500, damping: 30 } satisfies Transition,
  expo: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } satisfies Transition,
  expoFast: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } satisfies Transition,
  slow: { duration: 1.1, ease: [0.25, 0.46, 0.45, 0.94] } satisfies Transition,
  instant: { duration: 0.2, ease: 'easeOut' } satisfies Transition,
} as const


// ── FADE VARIANTS ────────────────────────────────────────────

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: transitions.expo },
  exit: { opacity: 0, y: 20, transition: transitions.expoFast },
}

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -40 },
  visible: { opacity: 1, y: 0, transition: transitions.expo },
  exit: { opacity: 0, y: -20, transition: transitions.expoFast },
}

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0, transition: transitions.expo },
  exit: { opacity: 0, x: 30, transition: transitions.expoFast },
}

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0, transition: transitions.expo },
  exit: { opacity: 0, x: -30, transition: transitions.expoFast },
}

export const fadeDiagonal: Variants = {
  hidden: { opacity: 0, x: 40, y: 40 },
  visible: { opacity: 1, x: 0, y: 0, transition: transitions.expo },
  exit: { opacity: 0, x: 20, y: 20, transition: transitions.expoFast },
}

export const fadeUpFar: Variants = {
  hidden: { opacity: 0, y: 100 },
  visible: { opacity: 1, y: 0, transition: { ...transitions.expo, duration: 0.9 } },
  exit: { opacity: 0, y: 50, transition: transitions.expoFast },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.smooth },
  exit: { opacity: 0, transition: transitions.instant },
}

export const fadeOut: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 0, transition: transitions.smooth },
}


// ── ZOOM VARIANTS ────────────────────────────────────────────

export const zoomIn: Variants = {
  hidden: { opacity: 0, scale: 0.75 },
  visible: { opacity: 1, scale: 1, transition: transitions.expo },
  exit: { opacity: 0, scale: 0.9, transition: transitions.expoFast },
}

export const zoomOut: Variants = {
  hidden: { opacity: 0, scale: 1.25 },
  visible: { opacity: 1, scale: 1, transition: transitions.expo },
  exit: { opacity: 0, scale: 1.1, transition: transitions.expoFast },
}

export const zoomPop: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: { opacity: 1, scale: 1, transition: transitions.springBouncy },
  exit: { opacity: 0, scale: 0.8, transition: transitions.instant },
}

export const zoomLeft: Variants = {
  hidden: { opacity: 0, scale: 0.8, x: 60 },
  visible: { opacity: 1, scale: 1, x: 0, transition: transitions.expo },
  exit: { opacity: 0, scale: 0.9, x: 30, transition: transitions.expoFast },
}

export const zoomRight: Variants = {
  hidden: { opacity: 0, scale: 0.8, x: -60 },
  visible: { opacity: 1, scale: 1, x: 0, transition: transitions.expo },
  exit: { opacity: 0, scale: 0.9, x: -30, transition: transitions.expoFast },
}

export const zoomRotate: Variants = {
  hidden: { opacity: 0, scale: 0.6, rotate: -8 },
  visible: { opacity: 1, scale: 1, rotate: 0, transition: transitions.springBouncy },
  exit: { opacity: 0, scale: 0.8, rotate: 4, transition: transitions.instant },
}


// ── FLIP VARIANTS ────────────────────────────────────────────

export const flipX: Variants = {
  hidden: { opacity: 0, rotateX: 80, transformOrigin: 'top center' },
  visible: { opacity: 1, rotateX: 0, transition: transitions.expo },
  exit: { opacity: 0, rotateX: 40, transition: transitions.expoFast },
}

export const flipY: Variants = {
  hidden: { opacity: 0, rotateY: 80 },
  visible: { opacity: 1, rotateY: 0, transition: transitions.expo },
  exit: { opacity: 0, rotateY: 40, transition: transitions.expoFast },
}

export const flipYBack: Variants = {
  hidden: { opacity: 0, rotateY: -80 },
  visible: { opacity: 1, rotateY: 0, transition: transitions.expo },
  exit: { opacity: 0, rotateY: -40, transition: transitions.expoFast },
}


// ── BLUR VARIANTS ────────────────────────────────────────────

export const blurIn: Variants = {
  hidden: { opacity: 0, filter: 'blur(20px)', scale: 1.05 },
  visible: { opacity: 1, filter: 'blur(0px)', scale: 1, transition: transitions.slow },
  exit: { opacity: 0, filter: 'blur(10px)', scale: 1.02, transition: transitions.expoFast },
}

export const blurUp: Variants = {
  hidden: { opacity: 0, filter: 'blur(16px)', y: 30 },
  visible: { opacity: 1, filter: 'blur(0px)', y: 0, transition: transitions.slow },
  exit: { opacity: 0, filter: 'blur(8px)', y: 15, transition: transitions.expoFast },
}

export const blurFocus: Variants = {
  hidden: { opacity: 0, filter: 'blur(30px) brightness(0.4)' },
  visible: { opacity: 1, filter: 'blur(0px) brightness(1)', transition: { duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, filter: 'blur(15px) brightness(0.6)', transition: transitions.smooth },
}


// ── SKEW VARIANTS ────────────────────────────────────────────

export const skewUp: Variants = {
  hidden: { opacity: 0, y: 50, skewY: 8 },
  visible: { opacity: 1, y: 0, skewY: 0, transition: transitions.expo },
  exit: { opacity: 0, y: 20, skewY: 3, transition: transitions.expoFast },
}

export const skewLeft: Variants = {
  hidden: { opacity: 0, x: 50, skewX: -10 },
  visible: { opacity: 1, x: 0, skewX: 0, transition: transitions.expo },
  exit: { opacity: 0, x: 20, skewX: -4, transition: transitions.expoFast },
}


// ── CLIP / WIPE VARIANTS ──────────────────────────────────────
// Note: clipPath in Framer Motion — wrap element in overflow:hidden container

export const clipLeft: Variants = {
  hidden: { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
  visible: { clipPath: 'inset(0 0% 0 0)', opacity: 1, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
  exit: { clipPath: 'inset(0 100% 0 0)', transition: transitions.expoFast },
}

export const clipRight: Variants = {
  hidden: { clipPath: 'inset(0 0 0 100%)', opacity: 1 },
  visible: { clipPath: 'inset(0 0 0 0%)', opacity: 1, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
  exit: { clipPath: 'inset(0 0 0 100%)', transition: transitions.expoFast },
}

export const clipUp: Variants = {
  hidden: { clipPath: 'inset(100% 0 0 0)', opacity: 1 },
  visible: { clipPath: 'inset(0% 0 0 0)', opacity: 1, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
  exit: { clipPath: 'inset(100% 0 0 0)', transition: transitions.expoFast },
}

export const clipCenter: Variants = {
  hidden: { clipPath: 'inset(0 50%)', opacity: 1 },
  visible: { clipPath: 'inset(0 0%)', opacity: 1, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
  exit: { clipPath: 'inset(0 50%)', transition: transitions.expoFast },
}


// ── SPECIAL / SIGNATURE VARIANTS ─────────────────────────────

export const tiltIn: Variants = {
  hidden: { opacity: 0, rotateX: 30, y: 40, transformOrigin: 'bottom center', transformPerspective: 1200 },
  visible: { opacity: 1, rotateX: 0, y: 0, transition: transitions.expo },
  exit: { opacity: 0, rotateX: 15, y: 20, transition: transitions.expoFast },
}

export const swing: Variants = {
  hidden: { opacity: 0, rotateY: 40, x: 30, transformOrigin: 'left center', transformPerspective: 800 },
  visible: { opacity: 1, rotateY: 0, x: 0, transition: transitions.expo },
  exit: { opacity: 0, rotateY: 20, x: 15, transition: transitions.expoFast },
}

export const unfold: Variants = {
  hidden: { opacity: 0, scaleY: 0, transformOrigin: 'top center' },
  visible: { opacity: 1, scaleY: 1, transition: transitions.springBouncy },
  exit: { opacity: 0, scaleY: 0, transition: transitions.expoFast },
}

export const rise: Variants = {
  hidden: { opacity: 0, y: 60, rotate: 3 },
  visible: { opacity: 1, y: 0, rotate: 0, transition: transitions.expo },
  exit: { opacity: 0, y: 30, rotate: 1, transition: transitions.expoFast },
}

export const glitch: Variants = {
  hidden: { opacity: 0, x: 8, filter: 'blur(4px) saturate(3)' },
  visible: { opacity: 1, x: 0, filter: 'blur(0px) saturate(1)', transition: transitions.expoFast },
  exit: { opacity: 0, x: -4, filter: 'blur(2px)', transition: { duration: 0.15 } },
}

export const float: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: [0, -10, 0],
    transition: { opacity: { duration: 0.5 }, y: { duration: 3, repeat: Infinity, ease: 'easeInOut' } },
  },
}

export const pulse: Variants = {
  hidden: { opacity: 0, scale: 1 },
  visible: {
    opacity: 1,
    scale: [1, 1.04, 1],
    transition: { opacity: { duration: 0.4 }, scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' } },
  },
}

export const slideUp: Variants = {
  hidden: { opacity: 0, y: '100%' },
  visible: { opacity: 1, y: '0%', transition: transitions.expo },
  exit: { opacity: 0, y: '100%', transition: transitions.expoFast },
}

export const slideLeft: Variants = {
  hidden: { opacity: 0, x: '100%' },
  visible: { opacity: 1, x: '0%', transition: transitions.expo },
  exit: { opacity: 0, x: '100%', transition: transitions.expoFast },
}


// ── STAGGER CONTAINER VARIANTS ────────────────────────────────
// Wrap children in this — each child gets a staggered delay

export const staggerContainer = (staggerChildren = 0.1, delayChildren = 0): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren, delayChildren, when: 'beforeChildren' },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.05, staggerDirection: -1 },
  },
})

// Stagger child — pair with staggerContainer
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: transitions.expo },
  exit: { opacity: 0, y: 12, transition: transitions.expoFast },
}

export const staggerItemFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.smooth },
  exit: { opacity: 0, transition: transitions.instant },
}

export const staggerItemLeft: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0, transition: transitions.expo },
  exit: { opacity: 0, x: 15, transition: transitions.expoFast },
}

export const staggerItemZoom: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: transitions.spring },
  exit: { opacity: 0, scale: 0.9, transition: transitions.instant },
}


// ── PAGE TRANSITION VARIANTS ──────────────────────────────────

export const pageSlideUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { ...transitions.expo, duration: 0.5 } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: [0.7, 0, 0.84, 0] } },
}

export const pageFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.25, ease: 'easeIn' } },
}

export const pageScale: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { ...transitions.expo, duration: 0.5 } },
  exit: { opacity: 0, scale: 1.02, transition: { duration: 0.3, ease: [0.7, 0, 0.84, 0] } },
}


// ── HOVER / TAP INTERACTION PROPS ────────────────────────────
// Use directly on motion components: <motion.div {...hoverLift}>

export const hoverLift = {
  whileHover: { y: -6, scale: 1.03, transition: transitions.springSnappy },
  whileTap: { scale: 0.97, transition: transitions.instant },
}

export const hoverScale = {
  whileHover: { scale: 1.06, transition: transitions.springSnappy },
  whileTap: { scale: 0.95, transition: transitions.instant },
}

export const hoverGlow = {
  whileHover: { scale: 1.04, filter: 'brightness(1.12)', transition: transitions.springSnappy },
  whileTap: { scale: 0.97, transition: transitions.instant },
}

export const hoverTilt = {
  whileHover: { rotate: 2, scale: 1.04, transition: transitions.springSnappy },
  whileTap: { rotate: -1, scale: 0.97, transition: transitions.instant },
}

export const hoverPress = {
  whileHover: { y: -3, transition: transitions.spring },
  whileTap: { y: 1, scale: 0.98, transition: transitions.instant },
}


// ── SCROLL-LINKED HELPERS ─────────────────────────────────────
// Use with useScroll + useTransform — import separately from framer-motion
// These are transform range definitions, not Variants

export const scrollTransforms = {
  // useTransform(scrollYProgress, [0, 1], scrollTransforms.fadeOut)
  fadeOut: [1, 0] as [number, number],
  fadeIn: [0, 1] as [number, number],
  // useTransform(scrollYProgress, [0, 1], scrollTransforms.slideUpSlow)
  slideUpSlow: ['0%', '-15%'] as [string, string],
  slideUpMedium: ['0%', '-30%'] as [string, string],
  slideDownSlow: ['0%', '15%'] as [string, string],
  zoomInSlow: [1, 1.15] as [number, number],
  zoomOutSlow: [1.15, 1] as [number, number],
  rotateSlow: [0, 8] as [number, number],
}


// ── VIEWPORT CONFIG ───────────────────────────────────────────
// Pass to whileInView: viewport={viewportOnce}

export const viewportOnce = { once: true, amount: 0.15 }
export const viewportRepeat = { once: false, amount: 0.15 }
export const viewportEager = { once: true, amount: 0.05 }
export const viewportStrict = { once: true, amount: 0.4 }
'use client'


import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import type { HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'

import {
    fadeUp, fadeDown, fadeLeft, fadeRight, fadeDiagonal, fadeIn, fadeUpFar,
    zoomIn, zoomOut, zoomPop, zoomRotate,
    flipX, flipY,
    blurIn, blurUp, blurFocus,
    skewUp, skewLeft,
    clipLeft, clipRight, clipUp, clipCenter,
    tiltIn, swing, unfold, rise, glitch, float, pulse, slideUp, slideLeft,
    staggerContainer, staggerItem, staggerItemFade, staggerItemLeft, staggerItemZoom,
    hoverLift, hoverScale, hoverGlow, hoverTilt, hoverPress,
    viewportOnce, viewportRepeat, viewportEager,
    scrollTransforms,
} from '@/app/lib/motionPresets'


type MotionDivProps = HTMLMotionProps<'div'> & {
    children: ReactNode
    delay?: number
    duration?: number
    className?: string
    once?: boolean
}

// ── Generic helper to inject delay/duration into any variant ──
function injectTiming(variants: object, delay = 0, duration?: number) {
    if (!delay && !duration) return variants
    return {
        ...variants as any,
        visible: {
            ...(variants as any).visible,
            transition: {
                ...(variants as any).visible?.transition,
                ...(delay ? { delay: delay / 1000 } : {}),
                ...(duration ? { duration: duration / 1000 } : {}),
            }
        }
    }
}


// ══════════════════════════════════════════════════════════════
// SCROLL-TRIGGERED (whileInView) COMPONENTS
// ══════════════════════════════════════════════════════════════

// ── Fade ──────────────────────────────────────────────────────

export function FadeUp({ children, delay = 0, duration, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(fadeUp, delay, duration)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function FadeDown({ children, delay = 0, duration, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(fadeDown, delay, duration)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function FadeLeft({ children, delay = 0, duration, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(fadeLeft, delay, duration)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function FadeRight({ children, delay = 0, duration, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(fadeRight, delay, duration)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function FadeIn({ children, delay = 0, duration, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(fadeIn, delay, duration)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function FadeUpFar({ children, delay = 0, duration, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(fadeUpFar, delay, duration)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportEager : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}


// ── Zoom ──────────────────────────────────────────────────────

export function ZoomIn({ children, delay = 0, duration, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(zoomIn, delay, duration)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function ZoomOut({ children, delay = 0, duration, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(zoomOut, delay, duration)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function ZoomPop({ children, delay = 0, duration, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(zoomPop, delay, duration)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function ZoomRotate({ children, delay = 0, duration, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(zoomRotate, delay, duration)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}


// ── Blur ──────────────────────────────────────────────────────

export function BlurIn({ children, delay = 0, duration, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(blurIn, delay, duration)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function BlurUp({ children, delay = 0, duration, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(blurUp, delay, duration)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function BlurFocus({ children, delay = 0, duration, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(blurFocus, delay, duration)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}


// ── Flip ──────────────────────────────────────────────────────

export function FlipX({ children, delay = 0, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(flipX, delay)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            style={{ perspective: 800 }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function FlipY({ children, delay = 0, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(flipY, delay)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            style={{ perspective: 800 }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}


// ── Skew ──────────────────────────────────────────────────────

export function SkewUp({ children, delay = 0, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(skewUp, delay)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function SkewLeft({ children, delay = 0, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(skewLeft, delay)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}


// ── Clip / Wipe ───────────────────────────────────────────────

export function ClipLeft({ children, delay = 0, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(clipLeft, delay)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function ClipRight({ children, delay = 0, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(clipRight, delay)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function ClipUp({ children, delay = 0, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(clipUp, delay)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function ClipCenter({ children, delay = 0, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(clipCenter, delay)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}


// ── Special ───────────────────────────────────────────────────

export function TiltIn({ children, delay = 0, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(tiltIn, delay)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            style={{ perspective: 1200 }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function Rise({ children, delay = 0, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(rise, delay)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function Glitch({ children, delay = 0, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(glitch, delay)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function Float({ children, delay = 0, className, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(float, delay)}
            initial="hidden"
            animate="visible"
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function Pulse({ children, delay = 0, className, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(pulse, delay)}
            initial="hidden"
            animate="visible"
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}

export function SlideUp({ children, delay = 0, className, once = false, ...props }: MotionDivProps) {
    return (
        <motion.div
            variants={injectTiming(slideUp, delay)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            style={{ overflow: 'hidden' }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    )
}


// ══════════════════════════════════════════════════════════════
// STAGGER CONTAINER
// ══════════════════════════════════════════════════════════════

type StaggerProps = {
    children: ReactNode
    staggerDelay?: number
    delayChildren?: number
    className?: string
    once?: boolean
}

export function Stagger({ children, staggerDelay = 0.1, delayChildren = 0, className, once = false }: StaggerProps) {
    return (
        <motion.div
            variants={staggerContainer(staggerDelay, delayChildren)}
            initial="hidden"
            whileInView="visible"
            exit="exit"
            viewport={once ? viewportOnce : viewportRepeat}
            className={className}
        >
            {children}
        </motion.div>
    )
}

// Stagger child variants — use these on children inside <Stagger>
export const StaggerVariants = {
    item: staggerItem,
    fade: staggerItemFade,
    left: staggerItemLeft,
    zoom: staggerItemZoom,
}


// ══════════════════════════════════════════════════════════════
// SCROLL PARALLAX WRAPPER
// ══════════════════════════════════════════════════════════════

type ParallaxProps = {
    children: ReactNode
    speed?: 'slow' | 'medium' | 'fast'
    direction?: 'up' | 'down'
    className?: string
}

export function Parallax({ children, speed = 'slow', direction = 'up', className }: ParallaxProps) {
    const ref = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })

    const ranges: Record<string, [string, string]> = {
        'up-slow': ['0%', '-12%'],
        'up-medium': ['0%', '-25%'],
        'up-fast': ['0%', '-40%'],
        'down-slow': ['0%', '12%'],
        'down-medium': ['0%', '25%'],
        'down-fast': ['0%', '40%'],
    }

    const y = useTransform(scrollYProgress, [0, 1], ranges[`${direction}-${speed}`])

    return (
        <div ref={ref} className={className} style={{ overflow: 'hidden' }}>
            <motion.div style={{ y }}>
                {children}
            </motion.div>
        </div>
    )
}


// ══════════════════════════════════════════════════════════════
// SCROLL FADE OUT (element fades as you scroll past it)
// ══════════════════════════════════════════════════════════════

export function ScrollFadeOut({ children, className }: { children: ReactNode; className?: string }) {
    const ref = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
    const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])
    const y = useTransform(scrollYProgress, [0, 1], ['0%', '-20%'])

    return (
        <motion.div ref={ref} style={{ opacity, y }} className={className}>
            {children}
        </motion.div>
    )
}


// ══════════════════════════════════════════════════════════════
// HOVER WRAPPERS
// ══════════════════════════════════════════════════════════════

export function HoverLift({ children, className, ...props }: MotionDivProps) {
    return (
        <motion.div {...hoverLift} className={className} {...props}>
            {children}
        </motion.div>
    )
}

export function HoverScale({ children, className, ...props }: MotionDivProps) {
    return (
        <motion.div {...hoverScale} className={className} {...props}>
            {children}
        </motion.div>
    )
}

export function HoverGlow({ children, className, ...props }: MotionDivProps) {
    return (
        <motion.div {...hoverGlow} className={className} {...props}>
            {children}
        </motion.div>
    )
}

export function HoverTilt({ children, className, ...props }: MotionDivProps) {
    return (
        <motion.div {...hoverTilt} className={className} {...props}>
            {children}
        </motion.div>
    )
}

export function HoverPress({ children, className, ...props }: MotionDivProps) {
    return (
        <motion.div {...hoverPress} className={className} {...props}>
            {children}
        </motion.div>
    )
}


// ── Re-export raw variants + helpers for advanced use ─────────
export {
    fadeUp, fadeDown, fadeLeft, fadeRight, fadeDiagonal, fadeIn, fadeUpFar,
    zoomIn, zoomOut, zoomPop, zoomRotate,
    flipX, flipY,
    blurIn, blurUp, blurFocus,
    skewUp, skewLeft,
    clipLeft, clipRight, clipUp, clipCenter,
    tiltIn, swing, unfold, rise, glitch, float, pulse, slideUp, slideLeft,
    staggerContainer, staggerItem, staggerItemFade, staggerItemLeft, staggerItemZoom,
    hoverLift, hoverScale, hoverGlow, hoverTilt, hoverPress,
    viewportOnce, viewportRepeat, viewportEager,
    scrollTransforms,
}
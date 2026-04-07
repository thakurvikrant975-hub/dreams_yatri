import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/app/lib/utils'
import React from 'react'


const textVariants = cva('', {
    variants: {
        intent: {
            primary: 'text-primary',
            secondary: 'text-secondary',
            muted: 'text-muted',
            disabled: 'text-disabled',
            inverse: 'text-inverse',
            brand: 'text-brand ',
            error: 'text-error-500',
            success: 'text-success-600',
            warning: 'text-warning-500',
            info: 'text-info-600'
        },
        align: {
            left: 'text-left',
            center: 'text-center',
            right: 'text-right',
        },
        truncate: {
            true: 'truncate',
            false: '',
        },
        balance: {
            true: 'text-balance',
            false: '',
        },
    },
    defaultVariants: {
        intent: 'primary',
        align: 'left',
        truncate: false,
        balance: false,
    },
})

// ─── Heading variants ─────────────────────────────────────────────────────────
const headingVariants = cva('font-heading font-bold tracking-tight leading-tight', {
    variants: {
        level: {
            1: 'text-xl  md:text-3xl',
            2: 'text-xl sm:text-2xl',
            3: 'text-lg sm:text-xl',
            4: 'text-base sm:text-lg',
            5: 'text-sm sm:text-base',
            6: 'text-xs sm:text-sm',
        },
        size: {
            xss: 'text-[8px] sm:text-[10px]',
            xs: 'text-[10px] sm:text-xs',
            sm: 'text-xs sm:text-sm',
            base: 'text-sm sm:text-base',
            lg: 'text-base sm:text-lg',
            xl: 'text-lg sm:text-xl',
            '2xl': 'text-xl sm:text-2xl',
            '3xl': 'text-2xl sm:text-3xl',
        },
        weight: {
            normal: 'font-normal',
            medium: 'font-medium',
            semibold: 'font-semibold',
            bold: 'font-bold',
            extrabold: 'font-extrabold',
        },
    },
    defaultVariants: {
        level: 1,
        weight: 'bold',
    },
})

// ─── Body / paragraph variants ────────────────────────────────────────────────
const textBodyVariants = cva('font-body leading-relaxed', {
    variants: {
        size: {
            xss: 'text-[8px] sm:text-[10px]',
            xs: 'text-[10px] sm:text-xs',
            sm: 'text-xs sm:text-sm',
            base: 'text-sm sm:text-base',
            lg: 'text-base sm:text-lg',
            xl: 'text-lg sm:text-xl',
            '2xl': 'text-xl sm:text-2xl',
            '3xl': 'text-2xl sm:text-3xl',
        },
        weight: {
            normal: 'font-normal',
            medium: 'font-medium',
            semibold: 'font-semibold',
            bold: 'font-bold',
            extrabold: 'font-extrabold'
        },
    },
    defaultVariants: {
        size: 'base',
        weight: 'normal',
    },
})

// ─── Types ────────────────────────────────────────────────────────────────────
type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

interface HeadingProps
    extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants>,
    VariantProps<typeof textVariants> {
    /** Override the rendered HTML tag while keeping visual level styling */
    as?: HeadingTag
}

interface TextProps
    extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof textBodyVariants>,
    VariantProps<typeof textVariants> {
    as?: 'p' | 'span' | 'label' | 'div' | 'li'
}

// ─── Heading ──────────────────────────────────────────────────────────────────
/**
 * Heading component — renders h1–h6 with full variant control.
 *
 * @example
 * <Heading level={2} intent="primary" balance>Our Destinations</Heading>
 * <Heading level={3} as="h2" weight="semibold">Section Title</Heading>
 */
export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
    (
        {
            children,
            className,
            level = 1,
            weight,
            size,
            intent,
            align,
            truncate,
            balance,
            as,
            ...props
        },
        ref
    ) => {
        const Tag = (as ?? (`h${level}` as HeadingTag))

        return (
            <Tag
                ref={ref}
                className={cn(
                    headingVariants({  level, weight, size }),
                    textVariants({ intent, align, truncate, balance }),
                    className
                )}
                {...props}
            >
                {children}
            </Tag>
        )
    }
)
Heading.displayName = 'Heading'

// ─── Text ─────────────────────────────────────────────────────────────────────
/**
 * Text component — renders body copy with full variant control.
 *
 * @example
 * <Text size="sm" intent="muted">8 days & 7 nights</Text>
 * <Text size="lg" weight="semibold" intent="primary">INR 34,000</Text>
 * <Text as="span" size="xs" intent="error">Required</Text>
 */
export const Text = React.forwardRef<HTMLElement, TextProps>(
    (
        {
            children,
            className,
            size,
            weight,
            intent,
            align,
            truncate,
            balance,
            as: Tag = 'p',
            ...props
        },
        ref
    ) => {
        return (
            <Tag
                ref={ref as React.Ref<never>}
                className={cn(
                    textBodyVariants({ size, weight }),
                    textVariants({ intent, align, truncate, balance }),
                    className
                )}
                {...props}
            >
                {children}
            </Tag>
        )
    }
)
Text.displayName = 'Text'

// ─── Label ────────────────────────────────────────────────────────────────────
/**
 * Label — form field label with consistent sizing.
 * Forwards ref to <label> element.
 *
 * @example
 * <Label htmlFor="email" intent="muted">Email Address</Label>
 */
interface LabelProps
    extends React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof textBodyVariants>,
    VariantProps<typeof textVariants> { }

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
    ({ children, className, size = 'sm', weight = 'medium', intent, align, ...props }, ref) => {
        return (
            <label
                ref={ref}
                className={cn(
                    textBodyVariants({ size, weight }),
                    textVariants({ intent, align }),
                    'leading-none',
                    className
                )}
                {...props}
            >
                {children}
            </label>
        )
    }
)
Label.displayName = 'Label'


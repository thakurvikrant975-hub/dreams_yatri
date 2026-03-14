import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'

const cardVariants = cva(
    'relative bg-white transition-all duration-300',
    {
        variants: {
            variant: {
                default: 'border border-(--border-muted)',
                elevated: 'shadow-xl shadow-neutral-300/60 ring-1 ring-inset ring-(--border-default)',
                flat: 'bg-neutral-50',
                ghost: 'bg-transparent',
            },
            radius: {
                none: 'rounded-none',
                sm: 'rounded-lg',
                md: 'rounded-xl',
                lg: 'rounded-2xl',
                xl: 'rounded-3xl',
            },
            padding: {
                none: 'p-0',
                sm: 'p-3',
                md: 'p-4',
                lg: 'p-5',
                xl: 'p-6',
            },
            hoverable: {
                true: 'hover:-translate-y-2 hover:shadow-xl hover:shadow-neutral-200/70 cursor-pointer',
            },
        },
        defaultVariants: {
            variant: 'elevated',
            radius: 'xl',
            padding: 'none',
        },
    }
)

export interface CardProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
    asArticle?: boolean
}

export function CardMedia({
    children,
    className = '',
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={`relative overflow-hidden ${className}`}>
            {children}
        </div>
    )
}

export function CardBody({
    children,
    className = '',
}: {
    children: React.ReactNode
    className?: string
}) {
    return <div className={`px-4 py-3 ${className}`}>{children}</div>
}

export function CardFooter({
    children,
    className = '',
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={`px-4 pb-4 ${className}`}>
            {children}
        </div>
    )
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
    (
        {
            children,
            className,
            variant,
            radius,
            padding,
            hoverable,
            asArticle = false,
            ...props
        },
        ref
    ) => {
        const Tag = asArticle ? 'article' : 'div'

        return (
            <Tag
                ref={ref as React.Ref<HTMLDivElement>}
                className={cardVariants({ variant, radius, padding, hoverable, className })}
                {...(props as React.HTMLAttributes<HTMLDivElement>)}
            >
                {children}
            </Tag>
        )
    }
)

Card.displayName = 'Card'

export { Card, cardVariants }
export default Card
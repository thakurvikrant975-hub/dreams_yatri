'use client'

import { useEffect } from 'react'
import { Heading, Text } from '@/app/components/ui/Typography'
import Button from '@/app/components/ui/Button'

export default function DestinationError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Destination page error:', error)
    }, [error])

    return (
        <div className="screen-space py-24 flex flex-col items-center text-center">
            <Heading level={2} weight="semibold">Something went wrong</Heading>
            <Text size="sm" intent="secondary" className="mt-2 max-w-md">
                We couldn&apos;t load this destination right now. Please try again.
            </Text>
            <Button variant="primary" className="mt-6" onClick={reset}>
                Try again
            </Button>
        </div>
    )
}

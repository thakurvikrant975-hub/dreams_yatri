import { cn } from '@/app/lib/utils';

/**
 * Dreams Yatri wordmark, rendered as a CSS mask of /dy_logo.svg so its colour
 * follows `currentColor`. Set the colour with a text utility (e.g.
 * `text-primary-500`, `text-white`) and the size with a width OR height utility
 * — the aspect ratio is baked in.
 *
 *   <DyLogo className="w-36 text-primary-500" />
 *   <DyLogo className="h-8 text-white" />
 */
export default function DyLogo({ className }: { className?: string }) {
    return (
        <span
            role="img"
            aria-label="Dreams Yatri"
            className={cn('inline-block shrink-0 bg-current aspect-[12781/3121]', className)}
            style={{
                WebkitMaskImage: 'url(/dy_logo.svg)',
                maskImage: 'url(/dy_logo.svg)',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
            }}
        />
    );
}

'use client'

import { useRouter } from 'next/navigation'
import PackageCard, { type PackageCardProps } from '@/app/components/packages/Packages'

type Props = Omit<PackageCardProps, 'onClick'> & { href: string }

export default function RelatedPackageCard({ href, ...props }: Props) {
    const router = useRouter()
    return <PackageCard {...props} onClick={() => router.push(href)} />
}
